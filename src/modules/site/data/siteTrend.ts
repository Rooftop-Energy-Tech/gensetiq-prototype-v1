import {runTotalsIn} from '@/modules/genset/data/history';

import {loadShape} from './load';
import type {SiteSeed} from './siteSeed';

/**
 * The series behind the site page's diagnostics band — one quantity, over one
 * window, for one site.
 *
 * ## Why this exists rather than a second solar chart
 *
 * The design's band draws solar generation and is annotated *"quick diagnostics of
 * the site; load, genset, battery, and solar generation"*. Those four are the whole
 * point of the band: an operator opening a site wants to know what the day looked
 * like, and at a hybrid the answer is never in one of them alone — an array that
 * made its usual energy while the genset also ran for six hours is a site with a
 * problem, and neither curve says so on its own.
 *
 * So the band is a **metric picker over one chart**, not four charts. Every series
 * below is `Array<TrendPoint>` with a unit, which is what lets one chart draw all
 * of them and what will let a fifth metric be added by extending a switch rather
 * than by drawing another axis.
 *
 * ## Everything here is read off the existing model
 *
 * Nothing is seeded and nothing is re-derived. Solar comes from `intradayKw` and
 * `solarDays`/`solarMonths`, the bank's state of charge comes from `hybridState`,
 * and the genset's runtime comes from its **own run log** in the genset module. That
 * is deliberate and it is the same rule `hybrid.ts` states about itself: the node
 * on the diagram, the figure on the device card and the point on this chart have to
 * be three readings of one quantity, or the page contradicts itself in front of the
 * reader.
 *
 * `hybridState` is called at synthetic timestamps — the same day, a different hour
 * — rather than reimplementing its charge cycle here. It is a pure function of
 * (seed, role, instant), so walking the clock through it is exactly what a
 * historian would do, and it makes a drifting copy of the cycle impossible.
 */

/** Half-hourly, which is the grain `solarIntraday` already publishes. */
const DAY_STEP_HOURS = 0.5;

export const SITE_TREND_METRICS = ['GENSET', 'LOAD'] as const;

export type SiteTrendMetric = (typeof SITE_TREND_METRICS)[number];

export const SITE_TREND_PERIODS = ['day', 'month', 'year', 'lifetime'] as const;

export type SiteTrendPeriod = (typeof SITE_TREND_PERIODS)[number];

export const SITE_TREND_PERIOD_LABEL: Record<SiteTrendPeriod, string> = {
  day: 'Day',
  month: 'Month',
  year: 'Year',
  lifetime: 'Lifetime',
};

/**
 * What the picker calls each series.
 *
 * `LOAD` is **Site Load**, which is also what `OVERVIEW_SERIES_LABEL` calls it on the
 * energy-overview chart the same band draws. It read `Consumption` here, and the two
 * labels were the same quantity under two names on one page — a reader stepping from the
 * overview's legend to the picker beside it had no way to know that. `Site Load` is the
 * one that survives, because it names the thing rather than the act: the site's own draw
 * is what the other three series are measured against, and it is a load whether or not
 * anybody is consuming anything at that moment.
 *
 * Title Case throughout, which is the other three's own convention as of the same day —
 * the merge that brought them in is what settled the casing, and a table with one entry
 * in sentence case would have read as an oversight rather than as a distinction.
 */
export const SITE_TREND_METRIC_LABEL: Record<SiteTrendMetric, string> = {
  GENSET: 'Genset Fuel Consumption',
  LOAD: 'Site Load',
};

/**
 * Which token each series is drawn in.
 *
 * The plant colours the app already uses — `--solar`, `--battery`, `--fuel` — so a
 * reader who has learnt that orange is the array on the diagram does not have to
 * learn it again here. The site load takes `text-primary` rather than a fifth hue: it is
 * the quantity the other three are measured *against*, not another source.
 */
export const SITE_TREND_METRIC_TOKEN: Record<SiteTrendMetric, string> = {
  GENSET: 'text-fuel',
  LOAD: 'text-primary',
};

export type TrendPoint = {
  /** Axis label — `13:30`, `4 Sep`, `Mar`. */
  label: string;
  /**
   * The reading, or `null` where the record does not reach.
   *
   * `null` rather than `0`, for the reason `SolarPoint.kw` is: a curve drawn to
   * zero across the rest of the afternoon reports a plant that has failed, which
   * at ten in the morning is every plant on the estate.
   */
  value: number | null;
  /**
   * Which of the series' `tints` this segment is drawn in, if it is not the
   * series' own colour.
   *
   * The segment *ending* at this point — a tint belongs to the stretch between two
   * readings, and this is the far end of it. `undefined` is the ordinary case and
   * means the series' own token.
   */
  tint?: string;
};

export type SiteTrend = {
  metric: SiteTrendMetric;
  period: SiteTrendPeriod;
  points: Array<TrendPoint>;
  /**
   * How the points should be drawn — and the series says it, not the chart.
   *
   * It used to be derivable from the period: a day was a continuous reading and
   * every longer window was buckets. Runtime broke that. A day of engine hours has
   * no instantaneous value to trace, so it is bucketed like a month is, and the
   * chart cannot tell that from the period alone. The series knows which of the two
   * it built; this is it saying so.
   */
  shape: 'curve' | 'bars';
  /** `kW`, `kWh`, `h`, `min` or `%`. */
  unit: string;
  /**
   * A fixed axis ceiling where the quantity has one.
   *
   * State of charge is a percentage of a known bank, so its axis is 0–100 whatever
   * the day did. Letting it auto-scale would draw a bank that moved between 71%
   * and 74% as a mountain range.
   */
  axisMax?: number;
  /** What the band says under the chart — the window and the grain, in a phrase. */
  caption: string;
  /** The one figure the series adds up to, for the readout beside the picker. */
  total: {label: string; value: string} | undefined;
  /**
   * A second window figure beside the total — a companion fact in another unit.
   * The genset views carry it: the fuel bars say what the running cost, and this
   * says how long it ran.
   */
  extra?: {label: string; value: string};
  /**
   * The bank's day as one line of movement: the initial state of charge as a
   * marker, what discharged laid to its left, what charged (by source) to its
   * right, ending at the state the bank holds now. Every length is in points of
   * capacity. `endPct` is the SoC curve's own last reading rather than
   * `initial − out + in`: the in-segments are what the sources offered at the
   * bus, and the round-trip loss keeps part of that from ever becoming stored
   * charge — the bar shows the movement, the bank says where it landed.
   *
   * Day only, by physics rather than by choice: a month moves several times the
   * bank's capacity through it, and lengths like that laid against a 0–100
   * marker would run off their own axis. The longer windows keep the charge
   * split as shares.
   */
  flow?: {
    initialPct: number;
    /** The percentage as stored energy — capacity × the level. */
    initialEnergy: string;
    endPct: number;
    endEnergy: string;
    out: {label: string; token: string; energy: string; pct: number};
    in: Array<{label: string; token: string; energy: string; pct: number}>;
  };
  /**
   * What each bucket *should* have made, aligned index-for-index with `points` —
   * drawn as a stepped dashed line over the bars, so a bar is judged against the
   * piece of the line directly above it. Per bucket rather than one flat rule
   * because the expectation genuinely moves: the monsoon factor and 28-versus-31
   * day months shift it about 15% across a year, and a flat line would report a
   * short February as a poor one. `null` over the bucket still in progress, whose
   * part-window bar has no full-window promise to be held against.
   *
   * `value` is the mean of the drawn steps — the one figure the staircase comes
   * to, stated beside the average's so the strip reads promised-versus-delivered.
   */
  reference?: {label: string; values: Array<number | null>; value: number};
  /**
   * Shaded slices of the series — each the region between its `from` and `to`,
   * index-aligned with `points`, in its own token, stacked bottom-up.
   *
   * The array's views carry one (the part of the generation charging the bank, in
   * the bank's blue); the bank's bars carry two (its charge attributed to solar
   * and to the genset, in their own colours). On a curve each slice is an area
   * between two lines; on bars each is a segment of the bar. The series' own fill
   * runs up to the first slice's `from`, so the slices and the fill always close
   * on the series exactly. `value` is each slice integrated over the window, for
   * the strip.
   */
  bands?: Array<{
    label: string;
    token: string;
    from: Array<number | null>;
    to: Array<number | null>;
    value: string;
  }>;
  /** The first column's heading on the `mix` table — `Destination`, `Source`. */
  mixHeading?: string;
  /**
   * A second bar beside each bucket's own, drawn lighter — the other half of a
   * balance. The bank's bars carry it: charge in beside discharge out to the
   * load, so a bucket reads as flow through the bank rather than a fill from
   * empty. Same unit as the axis; `value` is the window's total, for the strip.
   */
  paired?: {label: string; token: string; values: Array<number | null>; value: string};
  /**
   * The series split into where it went, as a table under the chart — each row a
   * destination with its energy and its share, closed by the total at 100%. The
   * array's views carry it: generation is one figure until it is divided into
   * what the tower took and what the bank was offered, and that division is the
   * same dispatch the band above shades.
   */
  mix?: Array<{label: string; token: string; energy: string; share: string}>;
  /**
   * The colours a point may name in `TrendPoint.tint`, and what each one means.
   *
   * Only the bank's level uses this so far: its curve is drawn in the source that
   * is charging it, so a night on diesel and a morning on the roof are two colours
   * of the same line. Left `undefined` by every other series, which is one colour
   * throughout — a metric that is *always* one quantity has nothing to say here,
   * and the chart falls back to its token.
   */
  tints?: Record<string, {token: string; label: string}>;
};

/** Midnight local on the day `at` falls in. */
const startOfDay = (at: number): number => {
  const day = new Date(at);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
};

/** `07:30`, from hours-since-midnight. */
const clockLabel = (hour: number): string =>
  `${String(Math.floor(hour)).padStart(2, '0')}:${hour % 1 === 0 ? '00' : '30'}`;

/**
 * Engine hours across `[from, to)`, summed over this site's sets.
 *
 * ## Why hours and not kilowatts
 *
 * Because the band is a diagnostic, and diesel *output* is not a fault signal. A
 * set delivers roughly what the site draws whenever it is turning, so its kW curve
 * is a rectangle at the load — the same rectangle on the morning the mains failed
 * for twenty minutes and on the week the changeover stuck closed. Hours run
 * separate those two immediately: a site whose bars sit at two hours a week and
 * then post fourteen has something wrong with it, and that is legible from across
 * the room without knowing what the set is rated at.
 *
 * It is also the figure the rest of the estate is managed in — services fall due on
 * engine hours, and fuel is planned against them — so a reader comparing this chart
 * to a service interval is comparing like with like.
 *
 * ## Why every set is summed
 *
 * Summed rather than taken from the duty machine, and that is right here where
 * `siteDrawKw` sums nothing: that function answers "what is the customer drawing",
 * where only the set on the bus counts. This answers "how much diesel running did
 * this site do", and a second set turning off-load has still put hours on an engine
 * — which is exactly what a diagnostics band is for.
 *
 * `runTotalsIn` owns the split of a run across a boundary: one that started at
 * eleven last night belongs to two days rather than being counted whole in both.
 * Keeping that arithmetic in one place is what stops this chart and the runs tab's
 * totals quoting different mornings.
 */
export const gensetHoursIn = (
  gensetIds: Array<string>,
  from: number,
  to: number,
  now: number,
): number => {
  let runtimeMs = 0;
  for (const gensetId of gensetIds) {
    runtimeMs += runTotalsIn(gensetId, from, to, now).runtimeMs;
  }
  // A tenth of an hour is six minutes, which is about the finest a start is worth
  // reporting at. A second decimal would be precision the run log's own timestamps
  // do not carry.
  return Math.round((runtimeMs / 3_600_000) * 10) / 10;
};

/**
 * The same sum, in minutes — the grain an hour of the day needs.
 *
 * Tenths of an hour is the right precision for a week or a service interval and
 * the wrong one inside a single hour: a set that ran eight minutes at half past
 * two is 0.1 h, which draws the same bar as one that ran four. Minutes are what
 * the run log's timestamps actually resolve at this zoom, so the day view counts
 * in them and only converts back for the total beside the picker.
 */
export const gensetMinutesIn = (
  gensetIds: Array<string>,
  from: number,
  to: number,
  now: number,
): number => {
  let runtimeMs = 0;
  for (const gensetId of gensetIds) {
    runtimeMs += runTotalsIn(gensetId, from, to, now).runtimeMs;
  }
  return Math.round(runtimeMs / 60_000);
};

/** Which metrics this site can actually draw. See `SiteTrend` for why it matters. */
export const siteTrendMetrics = (gensetCount: number): Array<SiteTrendMetric> =>
  SITE_TREND_METRICS.filter((metric) =>
    // Every site has a load, including one nothing is currently feeding — which is
    // the case a reader most wants a curve for. A set it has not got, it has not got.
    metric === 'GENSET' ? gensetCount > 0 : true,
  );

const NUMBER = new Intl.NumberFormat('en-MY', {maximumFractionDigits: 0});

/**
 * An hours figure for a readout — `6.2 h` while a tenth means something, `1,284 h`
 * once it does not. A hundred hours is roughly where a reader stops thinking in
 * starts and shifts and starts thinking in service intervals.
 */
const hoursLabel = (hours: number): string =>
  hours < 100 ? `${Math.round(hours * 10) / 10} h` : `${NUMBER.format(Math.round(hours))} h`;

/** The series, for one metric over one window. */
export const siteTrend = (
  seed: SiteSeed,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  period: SiteTrendPeriod,
  /** Midnight of the day the stepper is parked on. Only `day` reads it. */
  dayAt: number,
  now: number = Date.now(),
): SiteTrend => {
  if (period === 'day') return dayTrend(seed, gensetIds, metric, dayAt, now);
  return periodTrend(seed, gensetIds, metric, period, now);
};

/**
 * Half-hourly through one day — **what was happening**, not how much, and that is
 * the whole reason the day gets its own function.
 *
 * At every longer window the useful quantity is how much over a bucket; at a day it
 * is the reading at an instant, because the shape is the information. An array
 * shaded from three o'clock and an array that tripped at three make the same daily
 * total and completely different curves — the same argument `SolarTodayChart` makes
 * for drawing a curve rather than another bar.
 *
 * ## The genset's day is bars, and it is elsewhere
 *
 * Runtime has no instantaneous value worth plotting, so it is not drawn as a
 * reading at all — see `gensetDayTrend`, which owns the whole of that view.
 */
const dayTrend = (
  seed: SiteSeed,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  dayAt: number,
  now: number,
): SiteTrend => {
  if (metric === 'GENSET') return gensetDayTrend(gensetIds, dayAt, now);

  const start = startOfDay(dayAt);
  const today = startOfDay(now);
  const nowHour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  // Only the day in progress has an edge to stop at. A past day is complete and a
  // future one has nothing at all — and the stepper is clamped so it cannot reach
  // one.
  const edgeHour = start === today ? nowHour : 24;

  const points: Array<TrendPoint> = [];
  for (let hour = 0; hour < 24; hour += DAY_STEP_HOURS) {
    const at = start + hour * 3_600_000;
    const known = hour <= edgeHour;
    points.push({label: clockLabel(hour), value: known ? dayValue(seed, at) : null});
  }

  const readings = points.map((point) => point.value).filter((v): v is number => v !== null);
  const peak = readings.length === 0 ? 0 : Math.max(...readings);

  return {
    metric,
    period: 'day',
    points,
    shape: 'curve',
    unit: 'kW',
    caption: 'Power through the day, half-hourly',
    total: {label: 'Peak', value: `${Math.round(peak * 10) / 10} kW`},
  };
};

/**
 * One half-hour's reading of the site's own draw.
 *
 * `GENSET` never reaches here: its day is hourly buckets of litres, not half-hourly
 * samples of kilowatts — see `gensetDayTrend`, which owns the whole of that view.
 * With the load the only continuous series left, this is the load curve and nothing
 * else, so it is a function rather than a switch.
 */
const dayValue = (seed: SiteSeed, at: number): number =>
  Math.round(seed.loadKw * loadShape(at) * 10) / 10;

/**
 * Runtime through one day: **twenty-four bars of minutes run**, one per hour.
 *
 * ## Why bars, and not the running total this replaced
 *
 * Because the quantity is bucketed, and a cumulative curve hides the thing the
 * view is opened for. Accumulated hours only ever climb, so *every* day is the
 * same rising shape and the reader has to compare slopes to compare days — a set
 * that ran a solid six hours and one that started nine times for forty minutes
 * each finish at the same height, and their curves differ only in a steepness
 * nobody can read off an axis. As bars the two are unmistakable: one is a block of
 * full hours, the other is a comb.
 *
 * It also makes the day agree with the month and the year, which were already bars
 * of hours per bucket. One series drawn as a total on one tab and a rate on the
 * next was the odd thing here — stepping from `Day` to `Month` changed what the
 * height of the chart *meant*, which is the one thing a period control should not
 * do.
 *
 * ## Litres, in hourly buckets
 *
 * The day used to be minutes-run-per-hour — a duty profile — and it became fuel
 * when the question the whole tab answers became *what did the running cost*.
 * The run log prices every run through the one SFC curve the tank chart and the
 * reports use, so an hour's bar here is the same litres the fuel ladder loses
 * over that hour. The axis auto-scales: unlike minutes, an hour of burn has no
 * natural ceiling — it depends on what is fitted and how hard it is loaded.
 *
 * A site with two sets sums litres across the yard, exactly as `gensetHoursIn`
 * sums its hours — unrounded per set, rounded once per bar.
 */
const gensetDayTrend = (gensetIds: Array<string>, dayAt: number, now: number): SiteTrend => {
  const start = startOfDay(dayAt);
  const today = startOfDay(now);
  // The hour in progress is drawn, and every hour after it is `null`. A part-hour
  // bar is honest — the burn in it did happen — and the chart marks where the
  // record stops, so a short bar at the right edge is not read as a set that shut
  // down. Hours the day has not reached are absent rather than zero, for the
  // reason `TrendPoint.value` gives.
  const edgeHour = start === today ? new Date(now).getHours() : 23;

  const points: Array<TrendPoint> = Array.from({length: 24}, (_, hour) => {
    const from = start + hour * 3_600_000;

    return {
      label: clockLabel(hour),
      value:
        hour > edgeHour
          ? null
          : Math.round(
              gensetIds.reduce(
                (litres, gensetId) =>
                  litres + runTotalsIn(gensetId, from, from + 3_600_000, now).fuelLitres,
                0,
              ) * 10,
            ) / 10,
    };
  });

  const litres = points.reduce((total, point) => total + (point.value ?? 0), 0);

  return {
    metric: 'GENSET',
    period: 'day',
    points,
    shape: 'bars',
    unit: 'L',
    caption:
      gensetIds.length > 1
        ? 'Fuel consumption in each hour, across the sets here'
        : 'Fuel consumption in each hour of the day',
    total: {label: 'Total', value: `${NUMBER.format(Math.round(litres))} L`},
    extra: {
      label: 'Total genset runtime',
      value: hoursLabel(gensetHoursIn(gensetIds, start, start + 86_400_000, now)),
    },
  };
};

/**
 * A month of days, a year of months, or the whole record — **energy** per bucket,
 * except the bank, which has no energy to add up and reports its mean level, and
 * the sets, which report engine hours.
 *
 * This is the view the runtime series exists for. Thirty bars of hours-per-day is
 * a duty profile, and an abnormal week is a bar that does not match its neighbours
 * — which is a thing the eye does unaided, and which the kW chart this replaced
 * could not show at all.
 */
const periodTrend = (
  seed: SiteSeed,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  period: Exclude<SiteTrendPeriod, 'day'>,
  now: number,
): SiteTrend => {
  const daily = period === 'month';

  /**
   * `lifetime` is the twelve months this prototype's model holds, and it says so.
   *
   * The alternative was to roll those twelve into one or two yearly bars, which
   * would be a chart of two rectangles claiming to be a plant's history. Naming
   * the record's real extent in the caption is the honest version, and the day the
   * model carries five years this is the only line that changes.
   *
   * The windows come off the clock. They used to come off the solar model's own
   * bucket calendar where a site had an array, which is a distinction a
   * genset-only estate no longer has to draw.
   */
  const spine = clockSpine(daily, now);

  const points: Array<TrendPoint> = spine.map((bucket) => ({
    label: bucket.label,
    value: bucketValue(seed, gensetIds, metric, bucket, now),
  }));

  const readings = points.map((point) => point.value).filter((v): v is number => v !== null);
  const sum = readings.reduce((total, value) => total + value, 0);

  const grain = daily ? 'day' : 'month';
  // Only `lifetime` names its own extent — see the note on `buckets`.
  const extent = period === 'lifetime' ? ', across the whole record — twelve months' : '';

  return {
    metric,
    period,
    points,
    shape: 'bars',
    unit: metric === 'GENSET' ? 'L' : 'kWh',
    caption:
      metric === 'GENSET'
        ? `Fuel consumption per ${grain}${extent}`
        : `Energy per ${grain}${extent}`,
    total:
      metric === 'GENSET'
        ? {label: 'Total', value: `${NUMBER.format(Math.round(sum))} L`}
        : {label: 'Total', value: `${NUMBER.format(Math.round(sum))} kWh`},
    extra:
      metric === 'GENSET' && spine.length > 0
        ? {
            label: 'Total genset runtime',
            value: hoursLabel(
              gensetHoursIn(gensetIds, spine[0]!.from, spine[spine.length - 1]!.to, now),
            ),
          }
        : undefined,
  };
};

/** Bucket edges from the calendar, for a site the solar model has nothing for. */
const clockSpine = (
  daily: boolean,
  now: number,
): Array<{from: number; to: number; label: string}> => {
  const spine: Array<{from: number; to: number; label: string}> = [];
  const today = new Date(now);

  if (daily) {
    for (let back = 29; back >= 0; back -= 1) {
      const from = startOfDay(now) - back * 86_400_000;
      spine.push({
        from,
        to: from + 86_400_000,
        label: new Date(from).toLocaleDateString('en-MY', {day: 'numeric', month: 'short'}),
      });
    }
    return spine;
  }

  for (let back = 11; back >= 0; back -= 1) {
    const cursor = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    spine.push({
      from: cursor.getTime(),
      to: next.getTime(),
      label: cursor.toLocaleDateString('en-MY', {month: 'short'}),
    });
  }
  return spine;
};

/** One bucket's figure — litres for the sets, kilowatt-hours for the load. */
const bucketValue = (
  seed: SiteSeed,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  window: {from: number; to: number},
  now: number,
): number => {
  if (metric === 'GENSET') {
    // Fuel rather than hours: the question a month of genset buckets answers is
    // what the running *cost*, and the run log already prices every run through
    // the one SFC curve the tank chart and the reports use. Summed unrounded
    // across the sets, rounded once here — see `runTotalsIn`.
    return Math.round(
      gensetIds.reduce(
        (litres, gensetId) =>
          litres + runTotalsIn(gensetId, window.from, window.to, now).fuelLitres,
        0,
      ),
    );
  }

  // The metered draw over the bucket, one day at a time with each day priced at
  // the slow wave's value at its noon — which is what lets the month's bars rise
  // and fall with the same wave the day curve draws, instead of both pretending
  // the wave is not there. `now + 1 day` keeps today counted in full, as before.
  const end = Math.min(window.to, now + 86_400_000);
  let kwh = 0;
  for (let at = window.from; at < end; at += 86_400_000) {
    kwh += seed.loadKw * 24 * loadShape(at + 43_200_000);
  }
  return Math.round(kwh);
};
