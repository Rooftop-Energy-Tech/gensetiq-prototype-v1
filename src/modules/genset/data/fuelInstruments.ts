import {useSyncExternalStore} from 'react';

import {
  FUEL_INTEGRITY,
  canReconcile,
  thresholdFloorPercent,
} from '../types/fuelIntegrity.type';
import type {GensetFuelInstruments} from '../types/fuelIntegrity.type';
import {GENSETS} from './fleet';

/**
 * Which fuel instruments each genset carries, and how much diesel it is losing.
 *
 * ## Why the fitment is seeded at all
 *
 * Because it is the point. A leak alarm needs a level sensor *and* a flow meter,
 * and the second is an option most customers have never bought — so a fleet where
 * every unit could reconcile would be a fleet that never exercises the state this
 * feature spends most of its time in. Ten of the twenty-four carry both here, which
 * is roughly the proportion the metering estate shows for power meters and roughly
 * what a real fleet looks like.
 *
 * ## The loss rate is the only invented quantity
 *
 * `lossLitresPerHour` is what makes any of this observable. Before it, the tank
 * curve *was* the burn curve — `history.ts` integrated one from the other — so the
 * level and the flow could not disagree and a leak was assertable but not
 * representable. The rate is applied inside the ladder, so the tank the analysis
 * chart draws, the discrepancy the Settings tab quotes and the litres-per-hour the
 * alarm states are one fact rendered three ways rather than three numbers typed
 * separately.
 *
 * A **negative** rate is a tank gaining fuel it was not given. It stands in for a
 * probe reading progressively high, which is one of the two things a surplus can
 * mean — the other being a delivery nobody wrote down, which this prototype has no
 * screen to record.
 *
 * ## What the seed is arranged to show
 *
 * Every one of the seven states, on a real unit, without touching the two fixtures
 * that are diffed against the Figma:
 *
 * | Unit | State | Why |
 * | --- | --- | --- |
 * | `BRF9540` | `ok` | Both instruments, nothing wrong — the design's own unit, so the panel is demonstrable without moving its pinned alarm counts |
 * | `PNG6015` | `ok` | A second healthy one, so `ok` does not read as a special case |
 * | `TPG1188` | `warning` | A loss that started this morning — over the line in the open window, clean in the one before it |
 * | `KLC1027` | `critical` | A steady loss while the engine turns, escalated by **standing across two windows** rather than by size |
 * | `AMP8890` | `critical` | Escalated by **size** — past three times the threshold on its own — and stopped 31 minutes ago, so it is just outside blanking |
 * | `JHB5503` | `surplus` | Gaining fuel it was not given |
 * | `IPH7724` | `unavailable` | Meter fitted and silent — the case that needs somebody to walk out, not a purchase order |
 * | `ASR2260` | `unavailable` | Offline, so both instruments are quiet at once |
 * | `SGP7756` | `suspended` | Meter fitted three hours ago; the window is not covered yet |
 * | `SHA7731` | `suspended` | Stopped twelve minutes ago, so the tank is still settling |
 *
 * The two criticals arrive by the two different routes on purpose: one is too big
 * to be anything but a burst, the other is small and has not stopped. A fixture
 * where every critical came from size would leave the persistence rule untested.
 *
 * The two suspended cases are **derived, not flagged**. `SHA7731` is inside the
 * blanking period because `fleet.ts` already says its telemetry is twelve minutes
 * old and `detail.ts` anchors a stopped set's last run to that; `AMP8890` sits at
 * thirty-one minutes and is therefore just outside. Neither carries a "settling"
 * field, and the one-minute margin between them is the sort of thing that only
 * stays true if nothing is hand-set.
 *
 * One state the seed does **not** reach is a loss spanning purely stopped hours.
 * It needs a set that has not run in a full day and is still reporting, and this
 * fleet has none: `detail.ts` anchors a stopped unit's last run to its telemetry
 * age, so any set idle for 24 hours is also a set that has been silent for 24
 * hours — which this app calls `OFFLINE`, and an offline panel cannot report a
 * tank. The `STOPPED` branch is live and correct; the fixture simply has no unit
 * that can exercise it.
 */

type InstrumentSeed = {
  /** No flow meter fitted. Every unit in this fleet carries a level probe. */
  flowMeter?: {model: string; accuracyOfReading: number; fittedMinutesAgo?: number};
  levelSensor: {model: string; accuracyOfFullScale: number};
  /** Litres per hour leaving the tank without being burned. Negative is a gain. */
  lossLitresPerHour?: number;
  /**
   * When the loss began, in hours before now. Absent means "always".
   *
   * This is what separates a warning from a critical, and it is not a display
   * trick. The detector escalates a shortfall that has stood across two
   * consecutive windows, so a **constant** leak is critical by definition once
   * it is a day old — which is right, and which makes every constant-rate unit
   * critical and leaves the warning state unreachable.
   *
   * A leak that started this morning is the warning: over the threshold in the
   * window that is open, and nothing at all in the one before it. That is also
   * what a fresh leak actually looks like.
   */
  lossStartedHoursAgo?: number;
  /**
   * The flow meter is fitted and not talking.
   *
   * Separate from the unit's own telemetry age, because it genuinely is: an
   * auxiliary instrument on its own bus can fail while the controller beside it
   * keeps reporting perfectly. That is the case an operator has to be able to tell
   * from a panel that has gone quiet altogether.
   */
  flowMeterSilent?: true;
};

/** The two probes the fleet is fitted with, so the models are not retyped per unit. */
const REED_CHAIN = {model: 'Rochester R3D reed chain', accuracyOfFullScale: 0.01};
const CAPACITIVE = {model: 'Gems XT-1000 capacitive', accuracyOfFullScale: 0.015};

/** And the two meters. Both read net of the return line. */
const CORIOLIS = {model: 'AIC S-Flow FM120 Coriolis', accuracyOfReading: 0.005};
const GEAR = {model: 'Piusi K600 differential', accuracyOfReading: 0.01};

const INSTRUMENT_SEED: Record<string, InstrumentSeed> = {
  // — Both instruments, reconciling cleanly.
  brf9540: {levelSensor: REED_CHAIN, flowMeter: CORIOLIS},
  png6015: {levelSensor: REED_CHAIN, flowMeter: CORIOLIS},

  // — Losing fuel.
  //
  // The rates are picked against each tank's own threshold rather than being
  // uniform: 2% of a 900 L tank is 18 L and 2% of a 3,000 L one is 60 L, so the
  // same litres-per-hour would be critical on one and invisible on the other.
  // Started this morning: over the line in the window that is open, and clean in
  // the one before it, so it is a warning rather than an escalation.
  tpg1188: {
    levelSensor: CAPACITIVE,
    flowMeter: GEAR,
    lossLitresPerHour: 4,
    lossStartedHoursAgo: 10,
  },
  klc1027: {levelSensor: REED_CHAIN, flowMeter: CORIOLIS, lossLitresPerHour: 6},
  amp8890: {levelSensor: CAPACITIVE, flowMeter: GEAR, lossLitresPerHour: 4},

  // — Gaining it. A probe drifting high, or a delivery nobody recorded.
  jhb5503: {levelSensor: CAPACITIVE, flowMeter: CORIOLIS, lossLitresPerHour: -2.5},

  // — Fitted, and nothing to read.
  iph7724: {levelSensor: REED_CHAIN, flowMeter: GEAR, flowMeterSilent: true},
  asr2260: {levelSensor: REED_CHAIN, flowMeter: GEAR},

  // — Fitted three hours ago. Not enough window to say anything yet.
  sgp7756: {levelSensor: CAPACITIVE, flowMeter: {...GEAR, fittedMinutesAgo: 180}},

  // — Both instruments, but stopped twelve minutes ago: still settling.
  sha7731: {levelSensor: REED_CHAIN, flowMeter: CORIOLIS},
};

/** Level probes only — the other fourteen units. */
const LEVEL_ONLY: InstrumentSeed = {levelSensor: REED_CHAIN};

const seedFor = (gensetId: string): InstrumentSeed => INSTRUMENT_SEED[gensetId] ?? LEVEL_ONLY;

/** What this genset is fitted with. */
export const instrumentsOf = (gensetId: string): GensetFuelInstruments => {
  const seed = seedFor(gensetId);
  return {
    levelSensor: seed.levelSensor,
    flowMeter: seed.flowMeter ?? null,
  };
};

/**
 * How long this genset's flow meter has been fitted, in minutes.
 *
 * `Infinity` for the ordinary case — a meter that has been there longer than any
 * window cares about. A finite value is what puts `SGP7756` in `suspended`, and it
 * is a real condition rather than a flag: a meter fitted this morning genuinely has
 * no yesterday to reconcile against.
 */
export const flowMeterAgeMinutes = (gensetId: string): number =>
  seedFor(gensetId).flowMeter?.fittedMinutesAgo ?? Number.POSITIVE_INFINITY;

/** Whether the fitted flow meter has stopped reporting on its own. */
export const flowMeterSilent = (gensetId: string): boolean =>
  seedFor(gensetId).flowMeterSilent === true;

/**
 * Litres per hour this genset loses without burning. Negative is a gain.
 *
 * Read by `history.ts` when it builds the tank ladder, which is the only place it
 * is applied — so every figure downstream is a consequence of the curve rather than
 * a second opinion about it.
 */
export const lossRateOf = (gensetId: string): number =>
  seedFor(gensetId).lossLitresPerHour ?? 0;

/**
 * Hours before now that this genset's loss began, or `Infinity` for "always".
 *
 * Read by the ladder, which applies the loss only to steps after it — so a fresh
 * leak bends the tank curve at the hour it started rather than for the whole
 * fortnight the chart draws.
 */
export const lossStartedHoursAgo = (gensetId: string): number =>
  seedFor(gensetId).lossStartedHoursAgo ?? Number.POSITIVE_INFINITY;

// ─── The operator's switch and threshold ─────────────────────────────────────

/**
 * The two decisions an operator makes about this alarm, per genset.
 *
 * Same posture as `deployment.ts` and the service schedule store: `localStorage`,
 * **overrides only**, no backend and no sync. A fresh browser gets the fleet as
 * seeded, and clearing site data restores it.
 *
 * Overrides-only matters more than usual here because of what the default is. The
 * alarm is **on wherever both instruments are fitted**, and a customer who has paid
 * for flow meters should not have to discover a switch before getting anything back
 * for them. Off is the deliberate act — taken against a unit with a probe somebody
 * already knows is lying — and because the store holds only genuine decisions,
 * "which sets has somebody switched this off on" stays an answerable question.
 */
const STORAGE_KEY = 'gensetiq.fuelIntegrity';

type LeakSetting = {enabled?: boolean; thresholdPercent?: number};

type LeakSettings = Record<string, LeakSetting>;

const listeners = new Set<() => void>();

const read = (): LeakSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as LeakSettings);
  } catch {
    // Private mode, or a value written in some earlier shape. The seeded defaults
    // are a complete, correct answer — not worth taking the page down for.
    return {};
  }
};

let settings: LeakSettings = read();

const emit = () => {
  settings = read();
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Whether the alarm is raised for this genset.
 *
 * A genset that cannot reconcile is never enabled, whatever the store says. That
 * is not a redundant guard: an operator can switch the alarm on, and the meter can
 * be removed afterwards, and the stored `true` would otherwise outlive the device
 * it was about.
 */
export const leakAlarmEnabled = (gensetId: string): boolean => {
  if (!canReconcile(instrumentsOf(gensetId))) return false;
  return settings[gensetId]?.enabled ?? true;
};

/**
 * This genset's threshold, as a percentage of its tank capacity.
 *
 * Floored at the probe's own accuracy on read as well as on write, so a threshold
 * stored before a probe was swapped for a coarser one cannot go on being finer than
 * the instrument can resolve.
 */
export const thresholdPercentOf = (gensetId: string): number => {
  const stored = settings[gensetId]?.thresholdPercent ?? FUEL_INTEGRITY.defaultThresholdPercent;
  return Math.max(thresholdFloorPercent(instrumentsOf(gensetId)), stored);
};

const write = (next: LeakSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — the change just won't survive a reload. */
  }
  emit();
};

/** Turn the alarm on or off for one genset. Ignored where it cannot reconcile. */
export const setLeakAlarmEnabled = (gensetId: string, enabled: boolean) => {
  if (!canReconcile(instrumentsOf(gensetId))) return;

  const next: LeakSettings = {...settings, [gensetId]: {...settings[gensetId], enabled}};
  // Back to the default means *no* override, so the store keeps holding only
  // decisions somebody actually made.
  if (enabled) delete next[gensetId].enabled;
  if (Object.keys(next[gensetId]).length === 0) delete next[gensetId];

  write(next);
};

/**
 * Set this genset's threshold.
 *
 * Refused below the probe's accuracy percentage rather than clamped silently —
 * the control states the floor, so a value that lands under it is a question the
 * page has already answered rather than a number to quietly rewrite. Returns
 * whether it took, so the caller can say so.
 */
export const setThresholdPercent = (gensetId: string, thresholdPercent: number): boolean => {
  const floor = thresholdFloorPercent(instrumentsOf(gensetId));
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < floor) return false;

  const rounded = Math.round(thresholdPercent * 10) / 10;
  const next: LeakSettings = {
    ...settings,
    [gensetId]: {...settings[gensetId], thresholdPercent: rounded},
  };
  if (rounded === FUEL_INTEGRITY.defaultThresholdPercent) delete next[gensetId].thresholdPercent;
  if (Object.keys(next[gensetId]).length === 0) delete next[gensetId];

  write(next);
  return true;
};

/**
 * The switch and the threshold, live.
 *
 * One hook for both because they are one decision from the reader's side — is this
 * alarm watching this machine, and how closely — and because a component that
 * subscribed twice would render the two halves against different store reads.
 */
export const useLeakSettings = (
  gensetId: string,
): {enabled: boolean; thresholdPercent: number; floorPercent: number} => {
  useSyncExternalStore(
    subscribe,
    () => settings,
    () => settings,
  );

  return {
    enabled: leakAlarmEnabled(gensetId),
    thresholdPercent: thresholdPercentOf(gensetId),
    floorPercent: thresholdFloorPercent(instrumentsOf(gensetId)),
  };
};

/** How many of the fleet can reconcile at all — the Settings tab's context line. */
export const reconcilableCount = (): number =>
  GENSETS.filter((genset) => canReconcile(instrumentsOf(genset.id))).length;
