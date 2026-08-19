import {
  FUEL_INTEGRITY,
  fuelLeakNotice,
  isLeak,
  reconcile,
} from '../types/fuelIntegrity.type';
import type {
  FuelIntegrityState,
  FuelLeakNotice,
  FuelLossSpan,
  FuelWindow,
  InstrumentFeed,
} from '../types/fuelIntegrity.type';
import type {GensetCondition} from '../types/alert.type';
import {gensetById, gensetDetail} from './detail';
import {
  flowMeterAgeMinutes,
  flowMeterSilent,
  instrumentsOf,
  leakAlarmEnabled,
  thresholdPercentOf,
  useLeakSettings,
} from './fuelInstruments';
import {fuelAt, lastEngineTransition, lossLitresIn, meteredBurn, refuelsIn, runSpan} from './history';
import {sfcLitresPerKwh} from './detail';
import {runLoadKw} from './history';
import type {GensetRun} from '../types/run.type';

/**
 * The leak verdict, assembled from the two instruments' histories.
 *
 * ## Why this is its own module rather than a field on `GensetDetail`
 *
 * A cycle. `history.ts` reads `detail.ts` — it integrates the tank backwards from
 * the level the snapshot publishes — so `detail.ts` cannot read `history.ts` back
 * without the two initialising into each other. And `detail.ts` builds every unit's
 * snapshot eagerly at module load, so the cycle would not be the harmless kind that
 * resolves before anybody calls anything.
 *
 * The reconciliation genuinely needs both sides: today's level from the snapshot,
 * and yesterday's level and the burn between them from the history. So it sits
 * downstream of both and is asked for by id, exactly as a page asks for a run log.
 *
 * ## One clock
 *
 * `now` is threaded rather than read here, for the reason `detail.ts` states about
 * its own: a page rendering a fleet has to measure every unit against one instant,
 * or two rows a millisecond apart disagree about the same window.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Module-load clock, matching the one `detail.ts` and `history.ts` each take. */
const NOW = Date.now();

/**
 * Whether an instrument is fitted, and whether anything is coming from it.
 *
 * Both readings arrive over the same link, so the panel governs both: a controller
 * that has stopped talking has stopped relaying its tank level, whatever the probe
 * on that tank is doing.
 *
 * **`OFFLINE` is the test, not a staleness limit in minutes.** An earlier version
 * used a fifteen-minute cutoff and marked most of the fleet silent — `BRF9540`'s
 * telemetry is fifty-seven minutes old in the seed and the design draws it as a
 * live, running machine. This app already has one concept for "the panel has
 * stopped reporting" and `docs/how-it-works.md` is emphatic that it is the run
 * state; inventing a second, tighter one here would have produced two screens
 * disagreeing about whether the same genset was talking.
 *
 * The flow meter has one extra way to fail: it can go quiet on its own while the
 * controller beside it reports perfectly. That is the case that needs somebody to
 * walk out to a device already bolted on, rather than a purchase order.
 */
const feeds = (gensetId: string): {levelFeed: InstrumentFeed; flowFeed: InstrumentFeed} => {
  const instruments = instrumentsOf(gensetId);
  const genset = gensetById(gensetId);

  const panelSilent = genset === undefined || genset.runState === 'OFFLINE';

  const levelFeed: InstrumentFeed =
    instruments.levelSensor === null ? 'not-fitted' : panelSilent ? 'no-reading' : 'reporting';

  const flowFeed: InstrumentFeed =
    instruments.flowMeter === null
      ? 'not-fitted'
      : panelSilent || flowMeterSilent(gensetId)
        ? 'no-reading'
        : 'reporting';

  return {levelFeed, flowFeed};
};

const spanOf = (gensetId: string, from: number, to: number): FuelLossSpan => {
  const {ran, stopped} = runSpan(gensetId, from, to);
  if (ran && stopped) return 'BOTH';
  return ran ? 'RUNNING' : 'STOPPED';
};

/**
 * One window's measurements, ending at `endedAt`.
 *
 * The window is shortened by a flow meter that has not been fitted long enough to
 * cover it. That is a real limit rather than a courtesy: a meter installed this
 * morning has no yesterday to be reconciled against, and integrating from before it
 * existed would count every litre burned by the old arrangement as unaccounted for.
 */
const windowAt = (gensetId: string, endedAt: number): FuelWindow => {
  const meterHours = flowMeterAgeMinutes(gensetId) / 60;
  const coveredHours = Math.min(FUEL_INTEGRITY.windowHours, meterHours);
  const from = endedAt - coveredHours * HOUR;

  const refuels = refuelsIn(gensetId, from, endedAt);

  // Settling covers both disturbances, because the probe cannot tell them apart:
  // a tank filled twenty minutes ago is foaming, and one that stopped drawing
  // twenty minutes ago is still sloshing. Either moves a level reading by volumes
  // comparable with the thresholds this detector works to.
  const transition = lastEngineTransition(gensetId, endedAt);
  const newestRefuel = refuels.at(-1)?.at;
  const disturbed = Math.max(transition ?? -Infinity, newestRefuel ?? -Infinity);
  const settling = endedAt - disturbed < FUEL_INTEGRITY.blankingMinutes * MINUTE;

  return {
    coveredHours,
    openingLitres: fuelAt(gensetId, from),
    measuredLitres: fuelAt(gensetId, endedAt),
    meteredBurnLitres: meteredBurn(gensetId, from, endedAt),
    refuelledLitres: refuels.reduce((total, refuel) => total + refuel.litres, 0),
    span: spanOf(gensetId, from, endedAt),
    settling,
  };
};

/**
 * Whether the same loss was already standing a window ago.
 *
 * Computed rather than remembered, because there is nowhere to remember it: this
 * prototype has no store of yesterday's verdicts, and one that recomputed on every
 * render would give a different answer on the second paint. Running the arithmetic
 * over the preceding window costs one more pass and cannot drift.
 *
 * Deliberately shallow — it asks only whether the shortfall cleared the threshold,
 * not what verdict the window produced, so escalation cannot recurse.
 */
const sustainedAt = (gensetId: string, endedAt: number, thresholdPercent: number): boolean => {
  const instruments = instrumentsOf(gensetId);
  const detail = gensetDetail(gensetId);
  if (instruments.levelSensor === null || instruments.flowMeter === null || detail === undefined) {
    return false;
  }

  const previous = windowAt(gensetId, endedAt - FUEL_INTEGRITY.windowHours * HOUR);
  if (previous.coveredHours < FUEL_INTEGRITY.minimumCoverageHours) return false;

  const capacity = detail.fuel.maxLitres;
  const expected =
    previous.openingLitres + previous.refuelledLitres - previous.meteredBurnLitres;
  const tolerance =
    instruments.levelSensor.accuracyOfFullScale * capacity +
    instruments.flowMeter.accuracyOfReading * previous.meteredBurnLitres;

  const shortfall = Math.max(0, expected - previous.measuredLitres - tolerance);
  return shortfall > (thresholdPercent / 100) * capacity;
};

/**
 * Where this genset stands on fuel integrity.
 *
 * The whole verdict is one call to the pure `reconcile()`; everything above is the
 * job of getting the measurements to it. That split is deliberate — the arithmetic
 * is the part worth being able to reason about without a fleet in front of you.
 */
export const fuelIntegrityOf = (gensetId: string, now: number = NOW): FuelIntegrityState => {
  const detail = gensetDetail(gensetId);
  if (detail === undefined) {
    return {kind: 'unavailable', levelSensor: 'not-fitted', flowMeter: 'not-fitted'};
  }

  const thresholdPercent = thresholdPercentOf(gensetId);

  return reconcile({
    enabled: leakAlarmEnabled(gensetId),
    instruments: instrumentsOf(gensetId),
    ...feeds(gensetId),
    capacityLitres: detail.fuel.maxLitres,
    thresholdPercent,
    window: windowAt(gensetId, now),
    sustained: sustainedAt(gensetId, now, thresholdPercent),
  });
};

/**
 * The verdict, live.
 *
 * Subscribing to the settings store and then recomputing is what makes the spec's
 * "lowering the threshold raises the alarm without a reload" true. `useLeakSettings`
 * is called for the subscription rather than the values — `fuelIntegrityOf` reads
 * the same store synchronously, so by the time this line runs it is already looking
 * at the version that woke the component up.
 */
export const useFuelIntegrity = (gensetId: string, now: number = NOW): FuelIntegrityState => {
  useLeakSettings(gensetId);
  return fuelIntegrityOf(gensetId, now);
};

/** The alarm this genset is carrying, if it is carrying one. */
export const leakNoticeOf = (gensetId: string, now: number = NOW): FuelLeakNotice | undefined =>
  fuelLeakNotice(gensetId, fuelIntegrityOf(gensetId, now));

/**
 * The genset's condition, with the leak alarm counted.
 *
 * **This is the reading every screen should use**, not `detail.condition`. That one
 * is the register map's verdict alone, which was the whole verdict until an alarm
 * existed that the register map does not carry.
 *
 * A leak moves it and an overdue service does not, and the asymmetry is the point.
 * A service falling due is a chore nobody has done yet; a tank losing eighty litres
 * a night is a machine actively spilling its consumable onto the ground. A genset
 * doing that while its page reads `Optimum` would cost the reader their trust in
 * every other verdict on the screen — which is a far more expensive failure than
 * one over-coloured badge.
 */
export const gensetCondition = (gensetId: string, now: number = NOW): GensetCondition => {
  const detail = gensetDetail(gensetId);
  if (detail === undefined) return 'OPTIMUM';

  const state = fuelIntegrityOf(gensetId, now);
  if (state.kind === 'critical') return 'CRITICAL';
  if (state.kind === 'warning' && detail.condition === 'OPTIMUM') return 'ATTENTION';

  return detail.condition;
};

/** Whether this genset is carrying a leak alarm at all — for counts and filters. */
export const hasLeak = (gensetId: string, now: number = NOW): boolean =>
  isLeak(fuelIntegrityOf(gensetId, now));

// ─── Per-run SFC anomaly ──────────────────────────────────────────────────────

/**
 * How far over expectation a run's *tank* draw was, for its loading.
 *
 * Two figures exist for every run: what the flow meter passed through the
 * engine, and what the tank actually gave up. The first is the run's own
 * `fuelConsumedLitres`; the second adds whatever the standing loss took while
 * the run was open. A healthy machine returns the SFC its load predicts (see
 * `sfcLitresPerKwh`); a tank giving up meaningfully more per kWh than the
 * model says that loading costs is fuel leaving without reaching the engine.
 *
 * `undefined` below the threshold, so a table can render the flag with one
 * truthiness check and a clean fleet shows nothing.
 */
export type RunSfcAnomaly = {
  /** kWh per litre the tank's own draw works out to. */
  tankSfcKwhPerL: number;
  /** kWh per litre this model returns at the run's load fraction. */
  expectedKwhPerL: number;
  /** Whole percent the tank draw exceeded the expected litres. */
  overPercent: number;
  /** Litres the tank gave up beyond the metered burn. */
  unaccountedLitres: number;
};

/** Flag a run whose tank draw is this much over its loading's expectation. */
export const SFC_ANOMALY_THRESHOLD_PERCENT = 15;

export const runSfcAnomaly = (run: GensetRun, now: number = NOW): RunSfcAnomaly | undefined => {
  const detail = gensetDetail(run.gensetId);
  if (detail === undefined || run.energyProducedKwh <= 0) return undefined;
  // No level probe, no tank figure — the anomaly is a claim about the tank.
  if (instrumentsOf(run.gensetId).levelSensor === null) return undefined;

  const from = new Date(run.startedAt).getTime();
  const to = run.endedAt === null ? now : new Date(run.endedAt).getTime();

  const unaccountedLitres = lossLitresIn(run.gensetId, from, to);
  const tankLitres = run.fuelConsumedLitres + unaccountedLitres;

  const loadFraction = runLoadKw(run, now) / detail.ratedKw;
  const expectedLPerKwh = sfcLitresPerKwh(loadFraction);
  const tankLPerKwh = tankLitres / run.energyProducedKwh;

  const overPercent = Math.round((tankLPerKwh / expectedLPerKwh - 1) * 100);
  if (overPercent < SFC_ANOMALY_THRESHOLD_PERCENT) return undefined;

  return {
    tankSfcKwhPerL: run.energyProducedKwh / tankLitres,
    expectedKwhPerL: 1 / expectedLPerKwh,
    overPercent,
    unaccountedLitres: Math.round(unaccountedLitres),
  };
};
