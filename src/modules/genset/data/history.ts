import type {GensetRun} from '../types/run.type';
import type {ReadingSeries, Sample, SeriesThreshold} from '../types/series.type';
import {GENSETS} from './fleet';
import {LITRES_PER_KWH, READING_SWING, gensetById, gensetDetail} from './detail';
import {lossRateOf, lossStartedHoursAgo} from './fuelInstruments';
import {spread, spreadBetween} from './spread';

/**
 * The past, in place of the time-series API this prototype doesn't have.
 *
 * The home page needs one number per reading; the analysis tab needs a fortnight
 * of them, and inventing that is where a mock data layer usually starts lying.
 * Three rules keep it honest:
 *
 *  1. **The present is a given, not an output.** Every series is generated
 *     backwards from the value `detail.ts` already publishes and eased onto it at
 *     the right-hand edge, so the chart's last point and the home page's gauge
 *     are the same number. Two independently plausible histories that disagree
 *     about *now* would be worse than no history at all.
 *  2. **A reading that does not exist is `null`, never zero.** The run log says
 *     when the engine was turning; everything that only exists in motion is a gap
 *     outside those windows. See `Reading.engineOnly`.
 *  3. **Same generator as everything else.** `spread()` from `./spread`, seeded
 *     on the genset's id, so a reload redraws the identical fortnight. A chart
 *     that reshuffles on refresh cannot be reasoned about, and this one is meant
 *     to be looked at twice.
 *
 * The cost is that nothing here is a recording. It is a *consistent* invention —
 * the load on a run implies its fuel burn implies the tank's slope, all the way
 * down — which is the property the screen needs to be worth reviewing.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How far back the run log goes. Two months of standby duty is ~25 starts. */
const LOG_DAYS = 60;

/**
 * The longest a single run gets, in hours.
 *
 * A set does not turn indefinitely, and the ceiling is a fact about how these
 * machines are worked rather than a display convenience. Continuous sites run
 * **two sets in turn** — while one carries the load the other rests, cools and is
 * serviced, then they swap — so a run there ends at a handover rather than at a
 * fault. Standby sets ride out an outage, and outages long enough to need a
 * changeover are the ones that get a second set started. Either way a run is a
 * shift, not a season.
 *
 * `detail.ts` caps the open run to match. The two have to agree: the newest entry
 * in this log **is** `detail.run`, so a ceiling applied to only one of them would
 * put the single longest run in the fleet at the head of every list.
 */
const RUN_HOURS_MAX = 14.5;

/**
 * One clock reading for the whole history layer, taken at module load.
 *
 * Same rule as `detail.ts`: the fleet's snapshot is built against a single
 * `Date.now()` so two units cannot disagree about what time it is. The fuel
 * ladder below is anchored to the same instant, so the tank curve does not
 * shift under the chart between one navigation and the next.
 */
const CLOCK = Date.now();

// ─── The run log ─────────────────────────────────────────────────────────────

/**
 * Every run this genset has closed, newest first, with the open one at the head
 * when the engine is turning.
 *
 * The newest entry **is** `detail.run` — the same object, not a copy built to
 * match. The home page's run card and the first row of this log cannot drift,
 * because there is nothing to drift from.
 *
 * Earlier runs are dealt backwards from it: a gap, then a run, then a gap, each
 * length drawn from `spread()`. A standby set's shape is periods of nothing
 * broken by an outage, so the gaps are the long part.
 */
const buildRuns = (gensetId: string): Array<GensetRun> => {
  const detail = gensetDetail(gensetId);
  if (detail === undefined) return [];

  const runs: Array<GensetRun> = [detail.run];
  const oldest = new Date(detail.run.startedAt).getTime() - LOG_DAYS * DAY;

  let cursor = new Date(detail.run.startedAt).getTime();

  for (let index = 1; cursor > oldest && index < 200; index += 1) {
    // Utility here is good but not perfect: outages cluster a few days apart in
    // the wet season and weeks apart otherwise, which is what the wide gap range
    // is standing in for.
    const gapHours = spreadBetween(gensetId, `run-gap-${index}`, 14, 132);
    const runHours = spreadBetween(gensetId, `run-hours-${index}`, 1.5, RUN_HOURS_MAX);
    // Each run carries its own load — the site's draw at the time. This is the
    // single most useful thing the analysis tab can show, so it must not be
    // constant across the log.
    const loadKw = Math.round(
      detail.ratedKw * spreadBetween(gensetId, `run-load-${index}`, 0.18, 0.62),
    );

    const endedMs = cursor - gapHours * HOUR;
    const startedMs = endedMs - runHours * HOUR;
    cursor = startedMs;

    runs.push({
      id: `${gensetId}-run-${index}`,
      gensetId,
      startedAt: new Date(startedMs).toISOString(),
      endedAt: new Date(endedMs).toISOString(),
      // The same relationship `detail.ts` uses for the current run: energy is
      // the load over the hours, and fuel is that energy costed at
      // `LITRES_PER_KWH`. A run in this log can be checked against the one on
      // the home page with a calculator.
      energyProducedKwh: Math.round(loadKw * runHours),
      fuelConsumedLitres: Math.round(LITRES_PER_KWH * loadKw * runHours),
    });
  }

  return runs;
};

const RUN_LOG: Record<string, Array<GensetRun>> = Object.fromEntries(
  GENSETS.map((genset) => [genset.id, buildRuns(genset.id)]),
);

/**
 * The oldest instant this layer can speak about.
 *
 * Everything here is generated backwards from now over a fixed span, so there is
 * a hard edge — before it there is no run log and the fuel ladder has nothing to
 * integrate. The date picker clamps to it rather than letting a reader select a
 * February that would come back as a flat line and read as "the machine did
 * nothing" instead of "we do not hold this".
 */
export const historyStart = (): number => CLOCK - LOG_DAYS * DAY;

/** Every run for a genset, newest first. */
export const gensetRuns = (gensetId: string): Array<GensetRun> => RUN_LOG[gensetId] ?? [];

/** The runs overlapping a window — what the chart shades as "engine turning". */
export const runsInWindow = (
  gensetId: string,
  from: number,
  to: number,
): Array<GensetRun> =>
  gensetRuns(gensetId).filter((run) => {
    const startedMs = new Date(run.startedAt).getTime();
    const endedMs = run.endedAt === null ? Number.POSITIVE_INFINITY : new Date(run.endedAt).getTime();
    return startedMs < to && endedMs > from;
  });

/** A run's average electrical load — the figure its energy total implies. */
export const runLoadKw = (run: GensetRun, now: number): number => {
  const endedMs = run.endedAt === null ? now : new Date(run.endedAt).getTime();
  const hours = (endedMs - new Date(run.startedAt).getTime()) / HOUR;
  return hours > 0 ? run.energyProducedKwh / hours : 0;
};

// ─── Sampling ────────────────────────────────────────────────────────────────

/**
 * How coarsely to sample a window.
 *
 * Chosen so every window lands between 200 and 800 points. Below 200 a chart
 * starts drawing straight lines through events that happened; above ~800 it is
 * drawing more points than the plot has pixels, which costs a frame and shows
 * nobody anything.
 */
export const bucketFor = (span: number): number => {
  if (span <= 6 * HOUR) return MINUTE;
  if (span <= 36 * HOUR) return 5 * MINUTE;
  if (span <= 8 * DAY) return 30 * MINUTE;
  return 2 * HOUR;
};

/**
 * Value noise: a smooth 0–1 wandering with the given period.
 *
 * Interpolating between hashed control points rather than hashing each sample —
 * white noise per bucket would draw a solid band of fuzz, and a reading is a
 * physical quantity with inertia. Two of these at different periods, summed, is
 * what gives a trace both a slow shape and a bit of texture.
 *
 * Keyed off absolute time, not the sample's index in the window, so switching
 * from 24 h to 7 d resamples the *same* signal rather than generating a new one.
 * A feature you spotted at one zoom has to still be there at the next.
 */
const wobble = (gensetId: string, key: string, t: number, periodMinutes: number): number => {
  const position = t / (periodMinutes * MINUTE);
  const index = Math.floor(position);
  const fraction = position - index;

  const from = spread(gensetId, `${key}/${periodMinutes}/${index}`);
  const to = spread(gensetId, `${key}/${periodMinutes}/${index + 1}`);
  // Smoothstep, so the joins between control points have no visible corner.
  return from + (to - from) * fraction * fraction * (3 - 2 * fraction);
};

/**
 * The shape of a reading's own restlessness, coarsest first.
 *
 * A machine's numbers move on several timescales at once — a slow thermal drift
 * across a shift, a swing as the site's load changes through the afternoon, and
 * a fine jitter on the sensor. One period alone gives either a trace that
 * wanders with no texture or one that is nothing but texture.
 */
const OCTAVES = [
  // Weeks: seasonal drift, a filter slowly loading up, a battery ageing.
  {minutes: 8 * 24 * 60, weight: 0.26},
  {minutes: 2 * 24 * 60, weight: 0.22},
  // Hours: the working day, and the site's load moving through it.
  {minutes: 480, weight: 0.2},
  {minutes: 120, weight: 0.14},
  // Minutes: the sensor's own restlessness.
  {minutes: 37, weight: 0.11},
  {minutes: 7, weight: 0.07},
];

/**
 * −1 … 1: the octaves the bucket can actually resolve, renormalised.
 *
 * Nyquist, and it is not a nicety. Sampling a 7-minute ripple into half-hour
 * buckets does not draw the ripple — it draws alias, a band of fuzz that changes
 * character with the zoom level and shows nothing that is in the signal. A real
 * logger bucketing to half-hours would have *averaged that ripple away*, so this
 * fades each octave out as the bucket grows past it. Zooming from 30 days to 6
 * hours therefore reveals detail rather than replacing the picture, which is what
 * makes it worth zooming.
 */
const drift = (gensetId: string, key: string, t: number, bucketMinutes: number): number => {
  let total = 0;
  let weights = 0;

  for (const octave of OCTAVES) {
    const resolvable = Math.min(1, octave.minutes / (2 * bucketMinutes));
    const weight = octave.weight * resolvable;
    total += weight * wobble(gensetId, key, t, octave.minutes);
    weights += weight;
  }

  return weights > 0 ? (total / weights - 0.5) * 2 : 0;
};

/**
 * Readings that follow the load rather than sitting at a fixed level.
 *
 * Power, current and fuel rate are all restatements of "how hard is it working",
 * so on a run at 30% load they have to sit near 30% — and the run log gives every
 * run its own load. Without this the most interesting series on the tab would be
 * one flat line repeated, which is exactly the failure that makes a chart
 * decorative.
 */
const LOAD_TRACKING = new Set([
  'active-power',
  'fuel-rate',
  'current-l1',
  'current-l2',
  'current-l3',
]);

/** Samples the trace eases over when landing on the published value. */
const PIN_SAMPLES = 8;

/** How long the trace takes to cross its threshold, either side of `raisedAt`. */
const RAMP_MS = 40 * MINUTE;

/** The run covering an instant, or `undefined` if the engine was stopped. */
const runAt = (runs: Array<GensetRun>, t: number): GensetRun | undefined =>
  runs.find((run) => {
    const startedMs = new Date(run.startedAt).getTime();
    const endedMs =
      run.endedAt === null ? Number.POSITIVE_INFINITY : new Date(run.endedAt).getTime();
    return t >= startedMs && t < endedMs;
  });

/** Resolution of the fuel ladder. Fine enough to place a refuel within an hour. */
const LADDER_STEP = 15 * MINUTE;

const FUEL_LADDERS = new Map<string, Array<number>>();

/**
 * The tank over the whole log, integrated backwards from the level the fleet row
 * reports right now.
 *
 * Fuel is the one reading that must not be drawn as noise around a mean. A tank
 * falls at the burn rate whenever the engine turns, holds flat when it doesn't,
 * and jumps when a tanker comes — a sawtooth whose *slope* is a quantity an
 * operator reads off the chart to plan the next visit. Wobble around 1,600 L
 * would look like data and mean nothing.
 *
 * Walking backwards is what keeps rule 1: the right-hand end is the published
 * level, and the history is whatever must have happened to arrive there. When the
 * integration runs past a full tank it has found a refuel, and drops to the
 * reserve line on the far side of it.
 *
 * Built once per genset over a fixed grid rather than over each window's buckets,
 * because the two are not the same curve. Integrating from the right-hand edge of
 * *whatever window is open* would put today's level at the end of a run in April,
 * and every zoom would draw a different tank.
 *
 * ## The tank falls faster than the burn on a leaking set
 *
 * The loss rate from `fuelInstruments.ts` is integrated here alongside the burn,
 * which is what makes this the **tank's** curve rather than the injectors'. Before
 * it, the two were the same line: this ladder was the burn, `fuel-rate` was the
 * burn, and a discrepancy between the level sensor and the flow meter was
 * arithmetically impossible — so a leak could be asserted on a card and never
 * shown on a chart.
 *
 * It applies whether or not the engine is turning, unlike the burn, because that
 * is what a leak is. A hole in a tank does not wait for the set to be started, and
 * the flat stretches between runs are where the loss is most visible: the burn term
 * is zero there, so any slope at all is fuel going somewhere it should not.
 *
 * `meteredBurn()` below is the other half — the same integration without the loss
 * term — and the gap between the two is the whole of what the leak alarm reports.
 */
const fuelLadder = (gensetId: string): Array<number> => {
  const cached = FUEL_LADDERS.get(gensetId);
  if (cached !== undefined) return cached;

  const detail = gensetDetail(gensetId);
  const genset = gensetById(gensetId);
  if (detail === undefined || genset === undefined) return [];

  const capacity = detail.fuel.maxLitres;
  const reserve = detail.fuel.reserveFraction * capacity;
  const runs = gensetRuns(gensetId);
  const steps = Math.ceil((LOG_DAYS * DAY) / LADDER_STEP) + 1;

  const levels = new Array<number>(steps).fill(genset.fuelLitres);
  const hours = LADDER_STEP / HOUR;
  const loss = lossRateOf(gensetId) * hours;
  // A leak has a start. `Infinity` hours ago is the ordinary case — a seep that
  // predates the log — and a finite one bends the curve at the hour it began,
  // which is what makes a *fresh* leak distinguishable from an old one. The
  // detector escalates a shortfall standing across two windows, so without this
  // every leaking unit would be critical and the warning state unreachable.
  const lossFrom = CLOCK - lossStartedHoursAgo(gensetId) * HOUR;

  for (let index = steps - 2; index >= 0; index -= 1) {
    const t = ladderStart() + index * LADDER_STEP;
    const run = runAt(runs, t);
    const burn = run === undefined ? 0 : LITRES_PER_KWH * runLoadKw(run, CLOCK) * hours;

    // Backwards, so the tank *was* higher by everything that has since left it —
    // the fuel the engine burned and the fuel that simply went.
    const candidate = levels[index + 1] + burn + (t >= lossFrom ? loss : 0);
    levels[index] = candidate > capacity ? reserve : candidate;
  }

  FUEL_LADDERS.set(gensetId, levels);
  return levels;
};

/**
 * Litres the flow meter would have totalled between two instants.
 *
 * The burn alone — no loss term — which is precisely what makes it the *other*
 * instrument. Integrated over the same fifteen-minute grid the ladder uses so the
 * two are commensurable: a burn figure taken at a finer resolution than the level
 * it is subtracted from would produce a discrepancy that is an artefact of the
 * sampling rather than of the diesel.
 *
 * Not cached, because it is called with a moving window rather than a fixed one,
 * and one day of a sixty-day grid is ninety-six additions.
 */
export const meteredBurn = (gensetId: string, from: number, to: number): number => {
  const runs = gensetRuns(gensetId);
  const hours = LADDER_STEP / HOUR;

  let total = 0;
  for (let t = from; t < to; t += LADDER_STEP) {
    const run = runAt(runs, t);
    if (run !== undefined) total += LITRES_PER_KWH * runLoadKw(run, CLOCK) * hours;
  }

  return total;
};

/** Whether the engine was turning at any point in a window, and at every point. */
export const runSpan = (
  gensetId: string,
  from: number,
  to: number,
): {ran: boolean; stopped: boolean} => {
  const runs = gensetRuns(gensetId);

  let ran = false;
  let stopped = false;
  for (let t = from; t < to; t += LADDER_STEP) {
    if (runAt(runs, t) === undefined) stopped = true;
    else ran = true;
  }

  return {ran, stopped};
};

/**
 * Deliveries inside a window, read off the ladder's own step-ups.
 *
 * The ladder already places a refuel wherever backward integration passes a full
 * tank, so these are not seeded a second time. One source, so a delivery cannot
 * exist for the reconciliation and not for the chart every screen draws — and when
 * `/refuel` grows a real log, that becomes the source and this retires.
 *
 * The threshold is a litre rather than zero: the ladder is floating-point, and a
 * tank sitting flat between two steps can differ in the last bit.
 */
export const refuelsIn = (
  gensetId: string,
  from: number,
  to: number,
): Array<{at: number; litres: number}> => {
  const levels = fuelLadder(gensetId);
  const refuels: Array<{at: number; litres: number}> = [];

  for (let index = 0; index < levels.length - 1; index += 1) {
    const at = ladderStart() + (index + 1) * LADDER_STEP;
    if (at < from || at > to) continue;

    const risen = levels[index + 1] - levels[index];
    if (risen > 1) refuels.push({at, litres: risen});
  }

  return refuels;
};

/**
 * When the engine last started or stopped before an instant, or `undefined`.
 *
 * The leak detector blanks a period after each, because a tank that has just
 * stopped drawing is still sloshing and a level probe reports slosh as volume.
 */
export const lastEngineTransition = (gensetId: string, before: number): number | undefined => {
  let latest: number | undefined;

  for (const run of gensetRuns(gensetId)) {
    for (const stamp of [run.startedAt, run.endedAt]) {
      if (stamp === null) continue;
      const at = new Date(stamp).getTime();
      if (at <= before && (latest === undefined || at > latest)) latest = at;
    }
  }

  return latest;
};

const ladderStart = (): number => historyStart();

/** The tank level at an instant, interpolated between ladder steps. */
export const fuelAt = (gensetId: string, t: number): number => {
  const levels = fuelLadder(gensetId);
  if (levels.length === 0) return 0;

  const position = (t - ladderStart()) / LADDER_STEP;
  const index = Math.floor(position);
  if (index < 0) return levels[0];
  if (index >= levels.length - 1) return levels[levels.length - 1];

  return levels[index] + (levels[index + 1] - levels[index]) * (position - index);
};

/**
 * One reading over a window, bucketed.
 *
 * Returns `undefined` for a key that is not a trend — see `ReadingKind`. The
 * caller never has to decide that; the catalogue already has.
 */
export const readingSeries = (
  gensetId: string,
  key: string,
  from: number,
  to: number,
  now: number,
): ReadingSeries | undefined => {
  const genset = gensetById(gensetId);
  const detail = gensetDetail(gensetId);
  if (genset === undefined || detail === undefined) return undefined;

  const reading = detail.readings[key];
  if (reading === undefined || reading.kind !== 'instantaneous') return undefined;

  const bucket = bucketFor(to - from);
  const times: Array<number> = [];
  for (let t = from; t <= to; t += bucket) times.push(t);
  if (times.length === 0) times.push(from);

  const runs = gensetRuns(gensetId);
  // A panel that has stopped reporting produces nothing after its last message.
  // The series ends there rather than running flat to the right edge, which
  // would claim the silence was a steady reading.
  const silentFrom =
    genset.runState === 'OFFLINE' ? new Date(genset.lastUpdated).getTime() : undefined;

  const baseline = detail.baseline[key] ?? reading.value;
  const referenceLoad = detail.baseline['active-power'];
  const swing = READING_SWING[key] > 0 ? READING_SWING[key] : Math.abs(baseline) * 0.06;

  const alert = detail.alerts.find((candidate) => candidate.readingKey === key);
  const raisedAt = alert === undefined ? undefined : new Date(alert.raisedAt).getTime();

  const samples: Array<Sample> = times.map((t) => {
    if (silentFrom !== undefined && t > silentFrom) return {t, value: null};

    const run = runAt(runs, t);
    if (reading.engineOnly && run === undefined) return {t, value: null};

    if (key === 'fuel-level') return {t, value: Math.round(fuelAt(gensetId, t))};

    // Where the reading sits when nothing is wrong — scaled to the load of
    // whichever run this bucket falls in, for the readings that follow it.
    let centre = baseline;
    if (LOAD_TRACKING.has(key) && run !== undefined && referenceLoad > 0) {
      centre = baseline * (runLoadKw(run, now) / referenceLoad);
    }

    // An active alert drags the trace onto its tripping value, crossing the
    // threshold at the moment the card says it was raised. A reading that sat in
    // its safe band right up to the right-hand edge, beside an alert claiming it
    // has been out for three hours, would be the page arguing with itself.
    if (raisedAt !== undefined) {
      const progress = Math.min(1, Math.max(0, (t - (raisedAt - RAMP_MS)) / (2 * RAMP_MS)));
      const eased = progress * progress * (3 - 2 * progress);
      centre = centre + (reading.value - centre) * eased;
    }

    return {t, value: centre + drift(gensetId, key, t, bucket / MINUTE) * swing};
  });

  // Ease the tail onto the published value — but only when the tail *is* the
  // present. Two conditions, and both were learned the hard way:
  //
  //   · the window has to end at now. Open a run from last week and its final
  //     sample is last week's; dragging it onto today's figure redraws a run at
  //     400 kW as one that ended at 205, and the axis stretches to cover a
  //     transition that never happened.
  //   · the reading has to exist right now. A stopped set's oil pressure reads 0
  //     because there is no pressure, and pulling Tuesday's trace down to meet
  //     that zero would invent a failure.
  const endsNow = Math.abs(to - now) <= bucket;
  const live = endsNow && (!reading.engineOnly || genset.runState === 'RUNNING');
  const lastDefined = samples.reduce(
    (found, sample, index) => (sample.value === null ? found : index),
    -1,
  );

  if (live && lastDefined >= 0) {
    const gap = reading.value - (samples[lastDefined].value ?? 0);
    for (let offset = 0; offset < PIN_SAMPLES; offset += 1) {
      const index = lastDefined - offset;
      if (index < 0 || samples[index].value === null) break;
      const weight = (PIN_SAMPLES - offset) / PIN_SAMPLES;
      samples[index] = {t: samples[index].t, value: (samples[index].value ?? 0) + gap * weight};
    }
  }

  const precision = reading.precision ?? 0;
  // Stored two digits finer than the reading is *written*. Rounding the samples
  // to the display precision quantises the trace onto the handful of integers
  // its axis spans — coolant temperature across an 8 °C axis becomes eight
  // horizontal steps, and a staircase reads as a control system hunting rather
  // than as a rounding artefact. The crosshair still formats to `precision`; only
  // the geometry keeps the extra digits.
  const stored = precision + 2;
  const rounded = samples.map((sample) => ({
    t: sample.t,
    value:
      sample.value === null ? null : Math.round(sample.value * 10 ** stored) / 10 ** stored,
  }));

  const threshold: SeriesThreshold | undefined =
    alert === undefined || alert.limit === null || raisedAt === undefined
      ? undefined
      : {
          limit: alert.limit,
          comparator: alert.comparator,
          severity: alert.severity,
          name: alert.name,
          raisedAt,
        };

  return {
    key,
    label: reading.label,
    unit: reading.unit,
    precision,
    samples: rounded,
    domain: domainOf(rounded, threshold),
    threshold,
  };
};

/**
 * The axis for a series: its extremes, padded, and always containing its
 * threshold.
 *
 * A trace pressed against the top of its frame reads as clipped even when it
 * isn't, and a dashed alarm line drawn just off the top of the plot is the one
 * mark on the chart that had to be visible. 8% either side is enough to separate
 * both from the frame without flattening the shape.
 */
const domainOf = (
  samples: Array<Sample>,
  threshold: SeriesThreshold | undefined,
): {min: number; max: number} => {
  const values = samples
    .map((sample) => sample.value)
    .filter((value): value is number => value !== null);

  if (values.length === 0) return {min: 0, max: 1};

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (threshold !== undefined) {
    min = Math.min(min, threshold.limit);
    max = Math.max(max, threshold.limit);
  }

  // A dead-flat series still needs a frame with height, or every point lands on
  // the same pixel row and the line vanishes.
  const span = max - min || Math.abs(max) || 1;
  return {min: min - span * 0.08, max: max + span * 0.08};
};
