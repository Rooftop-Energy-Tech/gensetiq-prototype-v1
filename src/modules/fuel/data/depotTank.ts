import {subscribeDeployments} from '@/modules/deployment/data/store';
import {historyNow, historyStart} from '@/modules/genset/data/history';
import {spread, spreadBetween} from '@/modules/genset/data/spread';
import {DEPOTS} from './depots';
import {depotFills} from './fills';
import type {Depot} from './depots';

export {DEPOTS};
export type {Depot};

/**
 * The depot's bulk tank, and what reconciling it against the fleet can and cannot
 * say.
 *
 * ## Two level sensors, one at each end of a pipe
 *
 * The yard has a liquid level sensor on its bulk tank, and every genset has one on
 * its own tank. So everything here is derived from levels: fuel out of the depot is
 * its tank's falls, and fuel that arrived is the gensets' rises (`fills.ts`). Same
 * technique, opposite sign.
 *
 * ## The pipe model (Jeff, 2026-10-05)
 *
 * Trucks were removed (Jeff, 2026-10-05); the depot is now reconciled against the
 * gensets it supplied. Whatever carries the fuel between them — a bowser, a jerry
 * can, a set driving in to the yard — is one pipe the app does not track. Each fill
 * is charged to the depot nearest where the genset stood (`fills.ts`), so over a
 * window: **fuel out of the depot vs fuel that arrived in its gensets**. If they do
 * not match, something went wrong in the chain between the two, and the gap is
 * `Missing in transit`.
 *
 * Until then the gap was told from the depot's side only (Jeff, 2026-10-01): what
 * left the tank against what the yard's own pump log said it gave, the rest
 * `Unlogged`.
 *
 * ## What a fall means, and what a rise means
 *
 * A **fall** is fuel issued. A **rise** is the supplier delivering into the depot,
 * which is not fuel out and must not count towards it; a reconciliation that summed
 * absolute change would net a 20,000 L delivery against the week's issues and
 * report a surplus.
 *
 * ## Why the two sides do not agree, and why they should not
 *
 * The seed walks the depot down by every fill charged to it, yard and field alike,
 * and then by a little more: a slow ullage loss on the bulk tank, plus one larger
 * unexplained drop, both scaled to what the yard issues, and on one Express Mission
 * yard a level sensor that over-reads (`Depot.sensorDriftFraction`). Without that
 * the two totals would match to the litre and the alarm this page exists for could
 * never fire. The gap is what a real operation argues about — a meter reading long,
 * fuel drawn for a plant nobody logged, or a genuine loss on the way.
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

  const to = historyNow();
  const from = historyStart();
  const MONTH = 30 * 24 * HOUR;
  const issues = depotIssues(depotId);

  // Every 30-day window in the record, stepped a day at a time, and the fullest of
  // them. One fixed month would miss a busy fortnight that straddles two.
  let heaviest = 0;
  for (let start = from; start + MONTH <= to; start += 24 * HOUR) {
    let month = 0;
    for (const issue of issues) {
      if (issue.at >= start && issue.at < start + MONTH) month += issue.litres;
    }
    heaviest = Math.max(heaviest, month);
  }

  const sized = Math.max(20_000, Math.ceil((heaviest * 1.5) / 10_000) * 10_000);
  capacities.set(depotId, sized);
  return sized;
};

/**
 * Below this the supplier is called, and the tank steps back up. Exported for a
 * `Low stock` card that was cut on 2026-10-01; only this file reads it now.
 */
export const REORDER_FRACTION = 0.18;

/**
 * One draw on the bulk tank: a fill this depot supplied, at what the genset's own
 * sensor saw arrive. The seed has the depot give exactly that, so the two ends of
 * the pipe differ only by the losses it plants (`buildSeries`).
 */
type DepotIssue = {at: number; litres: number};

/** Every fill charged to this yard, yard and field alike — see `fills.ts`. */
const depotIssues = (depotId: string): Array<DepotIssue> =>
  depotFills(depotId).map((fill) => ({at: fill.at, litres: fill.litres}));

export type DepotSample = {
  t: number;
  litres: number;
  /**
   * What arrived this hour in the gensets this depot supplied, and what the seed
   * lost on the way (ullage, the unexplained drop), both before the sensor's drift.
   * `lost` is the seed's truth only; the page never reads it, since nobody logs
   * fuel that went missing.
   *
   * Carried on the sample rather than looked up again at reconciliation time, and
   * that is the whole fix for a bug that survived four wrong diagnoses. The two
   * sides were timestamped differently: a fall is recorded at its sample, a fill
   * at the minute it happened, and the two can land either side of a window edge.
   * A single large fill just before `now` — counted as arrived, its fall dated after
   * the edge — put every window out by about 1,850 L. Attributing both to the same
   * sample makes them consistent by construction, so what is left in the gap is
   * only what the seed put there: the ullage, the drift and the one unexplained
   * drop.
   */
  arrived: number;
  lost: number;
};

/** A rise, or a sample that issued nothing. */
const NO_ISSUE = {arrived: 0, lost: 0};

/**
 * The depot's level, hourly, oldest first.
 *
 * Built forward rather than backwards — unlike a genset's ladder, which is anchored
 * to a level the fleet seed publishes for *now*. The depot has no published present,
 * so it is dealt from a full tank at the horizon and the level today is wherever the
 * walk lands. That is also the honest shape: a yard's tank is a consequence of what
 * it has issued, not a figure somebody states.
 *
 * `loadScale` shrinks or grows every round's load — see `Depot.stockFraction`.
 */
const buildSeries = (depotId: string, loadScale = 1): Array<DepotSample> => {
  const from = historyStart();
  // The fleet's clock, not this call's: the genset ladder stamps its newest fill at
  // that instant, and a later `to` put this walk's last reading past a page's
  // window, which then dropped that hour from Out while the level kept it.
  const to = historyNow();

  // Every fill this depot supplied, as a lookup by the step it falls in. Each one is
  // fuel that left this tank at that moment.
  const capacity = depotCapacityLitres(depotId);
  const drift = DEPOTS.find((depot) => depot.id === depotId)?.sensorDriftFraction ?? 0;

  const arrivedByStep = new Map<number, number>();
  let issuedInRecord = 0;
  for (const issue of depotIssues(depotId)) {
    if (issue.at < from || issue.at > to) continue;
    const step = Math.floor((issue.at - from) / STEP);
    arrivedByStep.set(step, (arrivedByStep.get(step) ?? 0) + issue.litres);
    issuedInRecord += issue.litres;
  }

  // The unaccounted side. A slow ullage loss every step — evaporation, the dregs of
  // a hose, a meter reading long — and one larger drop that nobody wrote down.
  //
  // Both scale with what the yard issues. They were flat litres, sized for Express
  // Mission's yards issuing 50,000–70,000 L a month; a carrier yard issuing 2,000 L
  // then lost half its month to the one drop and a twentieth to the ullage alone,
  // and every yard on that estate read as missing fuel.
  const steps = (to - from) / STEP;
  const issuedPerStep = steps > 0 ? issuedInRecord / steps : 0;
  const ullagePerStep = issuedPerStep * spreadBetween(depotId, 'ullage', 0.0012, 0.0025);
  const mysteryStep = Math.floor(spread(depotId, 'mystery-when') * steps);
  // The drifting yard takes no mystery drop. Its story is an instrument, and a
  // four-figure loss landing inside the window would swamp the drift — the card
  // would then cry theft at the one depot where nothing is missing.
  const mysteryLitres =
    drift > 0 ? 0 : issuedPerStep * 30 * 24 * spreadBetween(depotId, 'mystery-litres', 0.015, 0.025);

  const samples: Array<DepotSample> = [];
  let level = capacity;
  // The round: when the last load came, what the yard has issued since, and how
  // many have been taken — the last of those only to salt the jitter.
  let lastDelivery = 0;
  let issuedSinceDelivery = 0;
  let deliveries = 0;

  for (let step = 0; from + step * STEP <= to; step += 1) {
    const t = from + step * STEP;

    const arrived = arrivedByStep.get(step) ?? 0;
    const lost = ullagePerStep + (step === mysteryStep ? mysteryLitres : 0);
    const issued = arrived + lost;
    // What the sensor writes down. Every figure below is the instrument's, because
    // the instrument is all this page has — the level, the reorder, and the size of
    // the next load a yard orders against what it believes it has issued.
    const sensed = issued * (1 + drift);

    // ## The supplier comes on a round, not when the tank nearly empties
    //
    // This filled to the brim only once the level fell past 18% of capacity, which
    // on Klang's 210,000 L is one delivery every six weeks — so a reader narrowing
    // to a week saw `Received: no delivery` at a yard issuing 37,000 L in it. No
    // depot runs that way: there is a standing order, the tanker comes round, and
    // the tank sits in a band rather than sawtoothing between empty and full.
    //
    // So a delivery is due roughly weekly, jittered per yard so four cards do not
    // all take one on the same morning, and it is sized to what the yard has
    // actually issued since the last one. Capped at the ullage the tank has left,
    // because a depot does not overflow.
    const sinceLast = step - lastDelivery;
    const dueEvery = spreadBetween(depotId, `round-${deliveries}`, 5.5, 8.5) * 24;

    if (lastDelivery >= 0 && sinceLast >= dueEvery && level < capacity * 0.97) {
      const load = Math.min(
        capacity - level,
        issuedSinceDelivery * spreadBetween(depotId, `load-${deliveries}`, 0.95, 1.2) * loadScale,
      );
      if (load > 0) {
        level += load;
        // A rise gets a sample of its own: one carrying both a fill and a draw nets
        // to whichever is larger and the other vanishes from the reconciliation.
        samples.push({t, litres: Math.round(level), ...NO_ISSUE});
        lastDelivery = step;
        issuedSinceDelivery = 0;
        deliveries += 1;
      }
    }

    // The floor still holds. If a round is late and the hour would take the tank
    // past its reserve, the supplier is called out: a tank that reaches the floor
    // mid-fall loses the rest of the drop, and the page then reports fuel arriving
    // at machines the yard never released.
    if (level - sensed < capacity * REORDER_FRACTION) {
      level = capacity;
      samples.push({t, litres: Math.round(level), ...NO_ISSUE});
      lastDelivery = step;
      issuedSinceDelivery = 0;
      deliveries += 1;
    }

    level -= sensed;
    issuedSinceDelivery += sensed;
    samples.push({
      // Mid-step, except the hour still running, which reads as of now. Stamped half
      // an hour ahead, it was the level the tank showed while the window's right
      // edge (`reconcile`) left it out — so Balance and the level disagreed by that
      // hour's fills, and the yard's fills outran its own breakdown.
      t: Math.min(t + STEP / 2, to),
      litres: Math.round(level),
      arrived,
      lost,
    });
  }

  return samples;
};

const seriesByDepot = new Map<string, Array<DepotSample>>();

// A deployment edit moves fills between depots (`fills.ts`), and with them what each
// tank issued — so the walks, and the sizes read off them, are dealt again.
subscribeDeployments(() => {
  seriesByDepot.clear();
  capacities.clear();
});

/** Dealt on first access, for the reason `deployment/data/seed.ts` gives. */
export const depotSeries = (depotId: string): ReadonlyArray<DepotSample> => {
  const held = seriesByDepot.get(depotId);
  if (held !== undefined) return held;

  const built = buildSeries(depotId, loadScaleFor(depotId));
  seriesByDepot.set(depotId, built);
  return built;
};

/**
 * The round's load scale that lands a yard on its `stockFraction`, by bisection.
 * A smaller load leaves a lower tank, so the search is one-directional — except
 * that a walk which touches the reorder floor is refilled to the brim and ends
 * high. So touching the floor counts as too low, and the search backs off. The walk
 * is 1,440 hourly steps, so thirty passes cost nothing worth caching separately.
 */
const loadScaleFor = (depotId: string): number => {
  const target = DEPOTS.find((depot) => depot.id === depotId)?.stockFraction;
  if (target === undefined) return 1;
  const capacity = depotCapacityLitres(depotId);
  let low = 0;
  let high = 1.5;
  for (let pass = 0; pass < 30; pass += 1) {
    const middle = (low + high) / 2;
    const walk = buildSeries(depotId, middle);
    const level = walk.at(-1)?.litres ?? 0;
    const floored = walk.some((sample) => sample.litres < capacity * (REORDER_FRACTION + 0.01));
    if (floored || level / capacity < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
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
  /**
   * Litres that arrived in the gensets this depot supplied — the sum of their own
   * level sensors' rises (`fills.ts`), on the same samples as the falls.
   */
  arrivedLitres: number;
  /**
   * `Missing in transit` (Jeff, 2026-10-05; `Unlogged fuel` until then):
   * `out − arrived`, fuel that left the bulk tank and never reached a genset. Never
   * below zero: the gensets recording more than the tank fell (a level sensor
   * reading short) is not shown for now (Jeff, 2026-10-01), so that case reads as
   * `0 L`. The figure the verdict grades.
   */
  varianceLitres: number;
  /** The gap as a share of what left, or `null` when nothing left. */
  variancePercent: number | null;
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
  let arrivedLitres = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (current.t <= windowFrom || current.t > windowTo) continue;

    if (current.litres < previous.litres) outLitres += previous.litres - current.litres;
    if (current.litres > previous.litres) receivedLitres += current.litres - previous.litres;

    // What arrived in the gensets this depot supplied, off the same sample as the
    // fall — see `DepotSample.arrived`.
    arrivedLitres += current.arrived;
  }

  // The two ends of the pipe: what the tank lost against what its gensets received.
  // Held at zero — the gensets receiving more is set aside for now; see
  // `varianceLitres`.
  const variance = Math.max(0, outLitres - arrivedLitres);

  return {
    outLitres: Math.round(outLitres),
    receivedLitres: Math.round(receivedLitres),
    arrivedLitres: Math.round(arrivedLitres),
    varianceLitres: Math.round(variance),
    variancePercent: outLitres > 0 ? (variance / outLitres) * 100 : null,
    levelLitres: samples.at(-1)?.litres ?? 0,
  };
};

/**
 * Whether to say it: more than 100 L missing in transit is flagged, at any yard
 * (Jeff, 2026-10-05). Fuel left the tank and never arrived in a genset, which is
 * the case this page exists for.
 *
 * Up to 100 L is quiet: a bulk-tank float and thirty-eight machine floats will
 * never agree exactly, and a page that flagged 40 L would be flagging its own
 * resolution.
 *
 * It was graded until then. Past 100 L and under the line below was an amber
 * `Sensor fault` (Afifah, 2026-09-22; removed 2026-10-05), and *missing in transit*
 * needed 1,000 L, or 0.5% of what the yard issued (Afifah, 2026-09-22, tightened
 * from 2%) — which let a busy yard such as Klang lose about 350 L a month before the
 * page said so.
 */
export type VarianceVerdict = {
  severity: 'CRITICAL';
  /** `shortfall` — fuel missing in transit, the only kind since `calibration` went (2026-10-05). */
  kind: 'shortfall';
};

export const varianceSeverity = (varianceLitres: number): VarianceVerdict | undefined =>
  varianceLitres > 100 ? {severity: 'CRITICAL', kind: 'shortfall'} : undefined;
