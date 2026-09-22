import {GENSETS} from '@/modules/genset/data/fleet';
import {historyStart, refuelsIn} from '@/modules/genset/data/history';
import {spread, spreadBetween} from '@/modules/genset/data/spread';

/**
 * The depot's bulk tank, and what reconciling it against the fleet can and cannot
 * say.
 *
 * ## One instrument, and it only measures a level
 *
 * The yard has a liquid level sensor on its bulk tank and nothing else — no dispatch
 * note, no tanker meter, no record of which machine a load was headed for. So
 * everything here is derived from a level falling, exactly as a genset's deliveries
 * are derived from its level rising. Same technique, opposite sign.
 *
 * That instrument sets a hard limit on what the page may claim. **The depot can say
 * how much left the yard and never where it went.** A variance is therefore a fleet
 * figure: this many litres left the bulk tank, this many arrived in machine tanks,
 * and the difference is unaccounted for somewhere across the estate. Attributing it
 * to a machine would be the page inventing the one thing the sensor cannot see.
 *
 * ## What a fall means, and what a rise means
 *
 * A **fall** is fuel issued — a tanker filling up to go out on a round. A **rise** is
 * the supplier delivering into the depot, which is not fuel out and must not count
 * towards it; a reconciliation that summed absolute change would net a 20,000 L
 * delivery against the week's issues and report a surplus.
 *
 * ## Why the two sides do not agree, and why they should not
 *
 * The seed walks the depot down by every delivery the fleet took, and then by a
 * little more: a slow ullage loss on the bulk tank, plus one larger unexplained
 * drop. Without that the two totals would match to the litre and the alarm this page
 * exists for could never fire. The gap is what a real yard argues about — a meter
 * reading long, fuel drawn for a plant nobody logged, or a genuine loss.
 */

const HOUR = 3_600_000;
// Hourly, not six-hourly. The step has to be fine enough that a supplier delivery
// never shares one with the day's issues: a step holding both nets to a rise, the
// fall inside it disappears, and the week's outflow reads short by everything that
// went out that morning. At six hours this estate lost a third of its issues that
// way.
const STEP = HOUR;

/**
 * A depot's tank: **half again the heaviest month its own catchment has drawn.**
 *
 * The rule Afifah set for the single depot, applied per yard now that there are
 * four. Half again over the worst month is the headroom that stops a tank reaching
 * the floor mid-fall — which is the failure that makes this whole page lie, because
 * a clipped fall reads as fuel arriving at machines that the yard never released.
 *
 * Rounded up to the nearest 10,000 L. A bulk tank comes in whole sizes, and a
 * capacity reading `47,431 L` would look computed in the one place a reader expects
 * a nameplate. A yard with an unusual tank states it on its own row instead.
 */
const capacities = new Map<string, number>();

export const depotCapacityLitres = (depotId: string): number => {
  const stated = DEPOTS.find((depot) => depot.id === depotId)?.capacityLitres;
  if (stated !== undefined) return stated;

  const held = capacities.get(depotId);
  if (held !== undefined) return held;

  const to = Date.now();
  const from = historyStart();
  const MONTH = 30 * 24 * HOUR;
  const served = new Set(depotFleet(depotId));

  // Every 30-day window in the record, stepped a day at a time, and the fullest of
  // them. One fixed month would miss a busy fortnight that straddles two.
  let heaviest = 0;
  for (let start = from; start + MONTH <= to; start += 24 * HOUR) {
    let month = 0;
    for (const genset of GENSETS) {
      if (!served.has(genset.id)) continue;
      for (const refuel of refuelsIn(genset.id, start, start + MONTH)) month += refuel.litres;
    }
    heaviest = Math.max(heaviest, month);
  }

  const sized = Math.max(20_000, Math.ceil((heaviest * 1.5) / 10_000) * 10_000);
  capacities.set(depotId, sized);
  return sized;
};

/** Below this the supplier is called, and the tank steps back up. */
const REORDER_FRACTION = 0.18;

/**
 * The yards fuel is issued from.
 *
 * Four, placed where the estate's machines actually are: the Klang valley holds
 * seventeen of the thirty-eight, and Perak, Penang and Johor take the rest between
 * them. A single national depot would be a fiction on an estate 700 km end to end —
 * nobody trucks diesel from Klang to Bayan Lepas — and it would also make the one
 * number on this page an average that no yard manager recognises.
 *
 * Their tanks are **not** the same size, because their catchments are not. Klang
 * fuels twenty-one machines and the others five or six, so a uniform 200,000 L gave
 * the three smaller yards five months of cover — tanks that never took a delivery in
 * the whole record and sat there draining. Each is sized from what it actually
 * issues; see `depotCapacityLitres`.
 */
export type Depot = {
  id: string;
  name: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  /**
   * Written down only where a yard's tank is not what its catchment implies.
   * Absent, the capacity is derived — see `depotCapacityLitres`.
   */
  capacityLitres?: number;
};

export const DEPOTS: ReadonlyArray<Depot> = [
  {id: 'klang', name: 'Klang', locationLabel: 'Klang, Selangor', latitude: 3.0449, longitude: 101.4455},
  {id: 'ipoh', name: 'Ipoh', locationLabel: 'Ipoh, Perak', latitude: 4.5975, longitude: 101.0901},
  {id: 'butterworth', name: 'Butterworth', locationLabel: 'Butterworth, Pulau Pinang', latitude: 5.3991, longitude: 100.3639},
  {id: 'pasir-gudang', name: 'Pasir Gudang', locationLabel: 'Pasir Gudang, Johor', latitude: 1.4716, longitude: 103.8914},
];

/**
 * Which depot serves a machine: the nearest one, by straight-line distance.
 *
 * Distance on the raw coordinates rather than a great circle. Over 700 km of one
 * peninsula the two answers differ by a rounding, and the question here is only
 * *which of four is closest* — a figure that would have to be wrong by 200 km to
 * change the answer.
 */
const depotFor = (latitude: number, longitude: number): Depot => {
  let nearest = DEPOTS[0];
  let best = Number.POSITIVE_INFINITY;

  for (const depot of DEPOTS) {
    const dx = depot.latitude - latitude;
    const dy = depot.longitude - longitude;
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      best = distance;
      nearest = depot;
    }
  }

  return nearest;
};

/** The machines each depot fuels, by id. */
export const depotFleet = (depotId: string): ReadonlyArray<string> =>
  GENSETS.filter((genset) => depotFor(genset.latitude, genset.longitude).id === depotId).map(
    (genset) => genset.id,
  );

export type DepotSample = {
  t: number;
  litres: number;
  /**
   * Litres of fleet deliveries this sample's fall accounts for.
   *
   * Carried on the sample rather than looked up again at reconciliation time, and
   * that is the whole fix for a bug that survived four wrong diagnoses. The two
   * sides were timestamped differently: a fall is recorded at its sample, a
   * delivery at the minute it happened, and the two can land either side of a
   * window edge. A single large delivery just before `now` — counted as delivered,
   * its fall dated after the edge — put every window out by about 1,850 L in the
   * one direction that is impossible, machines receiving fuel the yard never
   * released.
   *
   * Attributing both to the same sample makes them consistent by construction, so
   * what is left in the variance is only what the seed actually put there: the
   * ullage and the one unexplained drop.
   */
  delivered: number;
};

/**
 * The depot's level, six-hourly, oldest first.
 *
 * Built forward rather than backwards — unlike a genset's ladder, which is anchored
 * to a level the fleet seed publishes for *now*. The depot has no published present,
 * so it is dealt from a full tank at the horizon and the level today is wherever the
 * walk lands. That is also the honest shape: a yard's tank is a consequence of what
 * it has issued, not a figure somebody states.
 */
const buildSeries = (depotId: string): Array<DepotSample> => {
  const from = historyStart();
  const to = Date.now();

  // Every delivery the fleet took, as a lookup by the step it falls in. Each one is
  // fuel that left this tank at that moment.
  const served = new Set(depotFleet(depotId));
  const capacity = depotCapacityLitres(depotId);

  const outByStep = new Map<number, number>();
  for (const genset of GENSETS) {
    if (!served.has(genset.id)) continue;
    for (const refuel of refuelsIn(genset.id, from, to)) {
      const step = Math.floor((refuel.at - from) / STEP);
      outByStep.set(step, (outByStep.get(step) ?? 0) + refuel.litres);
    }
  }

  // The unaccounted side. A slow ullage loss every step — evaporation, the dregs of
  // a hose, a meter reading long — and one larger drop that nobody wrote down.
  const ullagePerStep = spreadBetween(depotId, 'ullage', 0.07, 0.19);
  const mysteryStep = Math.floor(spread(depotId, 'mystery-when') * ((to - from) / STEP));
  const mysteryLitres = spreadBetween(depotId, 'mystery-litres', 700, 1_400);

  const samples: Array<DepotSample> = [];
  let level = capacity;

  for (let step = 0; from + step * STEP <= to; step += 1) {
    const t = from + step * STEP;

    const issued = (outByStep.get(step) ?? 0) + ullagePerStep + (step === mysteryStep ? mysteryLitres : 0);

    // ## The supplier comes *before* the hour that would empty the tank
    //
    // Ordering matters more than it looks. Filling after the outflow let the level
    // reach the floor mid-fall — this fleet can draw 34,000 L in a day against a
    // tank of 60,000 — and `Math.max(0, …)` then swallowed whatever was left of
    // that drop. One such hour cost 1,113 L of the week's outflow, and the page
    // reported machines receiving fuel the yard never released.
    //
    // Refilling first means the tank is never short of the hour it is about to
    // serve, so every litre issued is a fall the sensor can see. The rise gets a
    // sample of its own, because a sample carrying both a fill and a draw nets to
    // whichever is larger and the other vanishes from the reconciliation.
    if (level - issued < capacity * REORDER_FRACTION) {
      level = capacity;
      samples.push({t, litres: Math.round(level), delivered: 0});
    }

    level -= issued;
    samples.push({
      t: t + STEP / 2,
      litres: Math.round(level),
      delivered: outByStep.get(step) ?? 0,
    });
  }

  return samples;
};

const seriesByDepot = new Map<string, Array<DepotSample>>();

/** Dealt on first access, for the reason `deployment/data/seed.ts` gives. */
export const depotSeries = (depotId: string): ReadonlyArray<DepotSample> => {
  const held = seriesByDepot.get(depotId);
  if (held !== undefined) return held;

  const built = buildSeries(depotId);
  seriesByDepot.set(depotId, built);
  return built;
};

export type DepotReconciliation = {
  /** Litres that left the bulk tank — the sum of its falls. */
  outLitres: number;
  /**
   * Litres the supplier put in — the sum of its rises.
   *
   * The other half of what a level sensor can see, and the half the reconciliation
   * deliberately ignores: a delivery into the yard is not fuel going out, and
   * netting the two would let a 50,000 L top-up cancel a week of issues.
   */
  receivedLitres: number;
  /** Litres that arrived in machine tanks — the sum of their rises. */
  deliveredLitres: number;
  /** `out − delivered`. Positive means fuel left the yard and did not arrive. */
  varianceLitres: number;
  /** The variance as a share of what left, or `null` when nothing left. */
  variancePercent: number | null;
  /** How many deliveries the fleet took in the window. */
  deliveries: number;
  /** The depot's level now, for the tank glyph. */
  levelLitres: number;
};

/**
 * Both sides of the window, and the gap between them.
 *
 * Falls only on the depot side — see the note above on why a supplier delivery must
 * not net against the week's issues.
 */
export const reconcile = (
  depotId: string,
  from: number,
  to: number,
): DepotReconciliation => {
  const samples = depotSeries(depotId);
  const served = new Set(depotFleet(depotId));

  // ## Both sides are counted on the sensor's grid, not the clock's
  //
  // A level sensor reports on the hour; a delivery happens at 10:50. The walk
  // records that delivery's fall against the 10:00 sample, so a window opening at
  // 10:30 would count the litres arriving in the machine and miss the litres
  // leaving the depot — and report the fleet receiving fuel the yard never
  // released. Over one week that read −1,097 L, an alarm about arithmetic.
  //
  // So the window is snapped back to the sample before it. The figures then answer
  // for whole sensor readings, which is the only period the instrument can actually
  // speak for.
  const gridFrom = samples.reduce(
    (held, sample) => (sample.t <= from && sample.t > held ? sample.t : held),
    Number.NEGATIVE_INFINITY,
  );
  const windowFrom = Number.isFinite(gridFrom) ? gridFrom : from;

  // And the right edge is the last reading the sensor has taken, not the clock. A
  // delivery three minutes ago is already in the fleet's log; the depot has not
  // reported since the top of the hour, so counting it on one side only shows the
  // fleet receiving fuel the yard has not yet been seen to release. Over a 24-hour
  // window that single partial hour read as −1,858 L, an alarm about lag.
  const windowTo = Math.min(to, samples.at(-1)?.t ?? to);

  let outLitres = 0;
  let receivedLitres = 0;
  let deliveredLitres = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (current.t <= windowFrom || current.t > windowTo) continue;

    if (current.litres < previous.litres) outLitres += previous.litres - current.litres;
    if (current.litres > previous.litres) receivedLitres += current.litres - previous.litres;

    // Both sides off the same sample — see `DepotSample.delivered`.
    deliveredLitres += current.delivered;
  }

  // The count is still the fleet's own log, because a reader asking "how many
  // deliveries" means tankers, not sensor readings, and several can share an hour.
  let deliveries = 0;
  for (const genset of GENSETS) {
    if (!served.has(genset.id)) continue;
    deliveries += refuelsIn(genset.id, windowFrom, windowTo).length;
  }

  const variance = outLitres - deliveredLitres;

  return {
    outLitres: Math.round(outLitres),
    receivedLitres: Math.round(receivedLitres),
    deliveredLitres: Math.round(deliveredLitres),
    varianceLitres: Math.round(variance),
    variancePercent: outLitres > 0 ? (variance / outLitres) * 100 : null,
    deliveries,
    levelLitres: samples.at(-1)?.litres ?? 0,
  };
};

/**
 * How loudly to say it, and **the two directions are not the same problem**.
 *
 * A **shortfall** — the depot issued more than the machines received — is fuel that
 * left the yard and did not arrive. That is the case this page exists for, and it
 * gets the critical.
 *
 * A **surplus** is machines recording more than the depot released, which cannot be
 * fuel appearing from nowhere: it is an instrument disagreeing. A float reading
 * long, a drum tipped in that never went through the yard, a delivery logged to the
 * wrong machine. Worth knowing and worth chasing, but it is a data fault rather than
 * a loss, so it warns and says so in different words.
 *
 * Treating them alike is what this returned until 2026-09-22 — `Math.abs` and one
 * label — so a yard whose sensors disagreed by 3% would have been reported as having
 * lost fuel it never lost.
 *
 * **2% of what was issued, or 100 L, whichever is larger**, and half that for the
 * lesser grade. A tanker meter and a tank float never agree exactly, so a threshold
 * in percent alone cries wolf on a quiet week where 40 L of noise is 8% of a small
 * total, and one in litres alone stays silent through a busy month where 90 L is
 * lost in the rounding.
 */
export type VarianceVerdict = {
  severity: 'CRITICAL' | 'WARNING';
  /** `shortfall` — fuel did not arrive. `surplus` — the instruments disagree. */
  kind: 'shortfall' | 'surplus';
};

export const varianceSeverity = (
  outLitres: number,
  varianceLitres: number,
): VarianceVerdict | undefined => {
  const gap = Math.abs(varianceLitres);
  const threshold = Math.max(100, outLitres * 0.02);

  // A surplus is held to the same size but never rises above a warning: it is not
  // a loss, whatever its magnitude.
  if (varianceLitres < 0) {
    return gap >= threshold / 2 ? {severity: 'WARNING', kind: 'surplus'} : undefined;
  }

  if (gap >= threshold) return {severity: 'CRITICAL', kind: 'shortfall'};
  if (gap >= threshold / 2) return {severity: 'WARNING', kind: 'shortfall'};
  return undefined;
};
