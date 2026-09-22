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
 * The heaviest month the fleet has drawn, plus half again — Afifah's rule.
 *
 * Sized from the record rather than picked, because a depot that cannot cover a busy
 * month is a depot that runs dry, and a dry tank is where this model went wrong
 * twice: the level hit the floor mid-fall, `Math.max(0, …)` swallowed the rest of
 * the drop, and the page reported machines receiving fuel the yard never released.
 * Half again over the worst month is the headroom that makes that impossible.
 *
 * Computed on first use rather than written down, so it follows the fleet: add ten
 * machines and the yard gets the tank it would actually need.
 */
let capacity: number | undefined;

export const depotCapacityLitres = (): number => {
  if (capacity !== undefined) return capacity;

  const to = Date.now();
  const from = historyStart();
  const MONTH = 30 * 24 * HOUR;

  // Every 30-day window the record holds, stepped a day at a time, and the fullest
  // of them. A single fixed month would miss a busy fortnight that straddles two.
  let heaviest = 0;
  for (let start = from; start + MONTH <= to; start += 24 * HOUR) {
    let month = 0;
    for (const genset of GENSETS) {
      for (const refuel of refuelsIn(genset.id, start, start + MONTH)) month += refuel.litres;
    }
    heaviest = Math.max(heaviest, month);
  }

  // Rounded up to the nearest 10,000 L: a bulk tank comes in whole sizes, and a
  // capacity reading `344,347 L` would look computed, which it is, in the one place
  // a reader expects a nameplate.
  capacity = Math.max(10_000, Math.ceil((heaviest * 1.5) / 10_000) * 10_000);
  return capacity;
};

/** Below this the supplier is called, and the tank steps back up. */
const REORDER_FRACTION = 0.18;

export type DepotSample = {t: number; litres: number};

/**
 * The depot's level, six-hourly, oldest first.
 *
 * Built forward rather than backwards — unlike a genset's ladder, which is anchored
 * to a level the fleet seed publishes for *now*. The depot has no published present,
 * so it is dealt from a full tank at the horizon and the level today is wherever the
 * walk lands. That is also the honest shape: a yard's tank is a consequence of what
 * it has issued, not a figure somebody states.
 */
const buildSeries = (): Array<DepotSample> => {
  const from = historyStart();
  const to = Date.now();

  // Every delivery the fleet took, as a lookup by the step it falls in. Each one is
  // fuel that left this tank at that moment.
  const outByStep = new Map<number, number>();
  for (const genset of GENSETS) {
    for (const refuel of refuelsIn(genset.id, from, to)) {
      const step = Math.floor((refuel.at - from) / STEP);
      outByStep.set(step, (outByStep.get(step) ?? 0) + refuel.litres);
    }
  }

  // The unaccounted side. A slow ullage loss every step — evaporation, the dregs of
  // a hose, a meter reading long — and one larger drop that nobody wrote down.
  const ullagePerStep = spreadBetween('depot', 'ullage', 0.07, 0.19);
  const mysteryStep = Math.floor(spread('depot', 'mystery-when') * ((to - from) / STEP));
  const mysteryLitres = spreadBetween('depot', 'mystery-litres', 700, 1_400);

  const samples: Array<DepotSample> = [];
  let level = depotCapacityLitres();

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
    if (level - issued < depotCapacityLitres() * REORDER_FRACTION) {
      level = depotCapacityLitres();
      samples.push({t, litres: Math.round(level)});
    }

    level -= issued;
    samples.push({t: t + STEP / 2, litres: Math.round(level)});
  }

  return samples;
};

let series: Array<DepotSample> | undefined;

/** Dealt on first access, for the reason `deployment/data/seed.ts` gives. */
export const depotSeries = (): ReadonlyArray<DepotSample> => (series ??= buildSeries());

export type DepotReconciliation = {
  /** Litres that left the bulk tank — the sum of its falls. */
  outLitres: number;
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
export const reconcile = (from: number, to: number): DepotReconciliation => {
  const samples = depotSeries();

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
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (current.t <= windowFrom || current.t > windowTo) continue;
    if (current.litres < previous.litres) outLitres += previous.litres - current.litres;
  }

  let deliveredLitres = 0;
  let deliveries = 0;
  for (const genset of GENSETS) {
    for (const refuel of refuelsIn(genset.id, windowFrom, windowTo)) {
      deliveredLitres += refuel.litres;
      deliveries += 1;
    }
  }

  const variance = outLitres - deliveredLitres;

  return {
    outLitres: Math.round(outLitres),
    deliveredLitres: Math.round(deliveredLitres),
    varianceLitres: Math.round(variance),
    variancePercent: outLitres > 0 ? (variance / outLitres) * 100 : null,
    deliveries,
    levelLitres: samples.at(-1)?.litres ?? 0,
  };
};

/**
 * How loudly to say it.
 *
 * **2% or 100 L, whichever is larger**, and half that for the warning. A tanker
 * meter and a tank float never agree exactly, so a threshold in percent alone cries
 * wolf on a quiet week where 40 L of noise is 8% of a small total, and one in litres
 * alone stays silent through a busy month where 90 L is lost in the rounding.
 */
export const varianceSeverity = (
  outLitres: number,
  varianceLitres: number,
): 'CRITICAL' | 'WARNING' | undefined => {
  const gap = Math.abs(varianceLitres);
  const alarmAt = Math.max(100, outLitres * 0.02);
  if (gap >= alarmAt) return 'CRITICAL';
  if (gap >= alarmAt / 2) return 'WARNING';
  return undefined;
};
