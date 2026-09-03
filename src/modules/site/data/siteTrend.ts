import {gensetRuns, runLoadKw, runTotalsIn} from '@/modules/genset/data/history';
import type {GensetRun} from '@/modules/genset/types/run.type';

import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {
  hybridPlant,
  hybridState,
  intradayKw,
  solarDays,
  solarMonths,
  todayFullKwh,
} from './hybrid';
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
 * and the genset's output comes from its **own run log** in the genset module. That
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

export const SITE_TREND_METRICS = ['SOLAR', 'BATTERY', 'GENSET', 'LOAD'] as const;

export type SiteTrendMetric = (typeof SITE_TREND_METRICS)[number];

export const SITE_TREND_PERIODS = ['day', 'month', 'year', 'lifetime'] as const;

export type SiteTrendPeriod = (typeof SITE_TREND_PERIODS)[number];

export const SITE_TREND_PERIOD_LABEL: Record<SiteTrendPeriod, string> = {
  day: 'Day',
  month: 'Month',
  year: 'Year',
  lifetime: 'Lifetime',
};

export const SITE_TREND_METRIC_LABEL: Record<SiteTrendMetric, string> = {
  SOLAR: 'Solar generation',
  BATTERY: 'Battery level',
  GENSET: 'Genset power',
  LOAD: 'Consumption',
};

/**
 * Which token each series is drawn in.
 *
 * The plant colours the app already uses — `--solar`, `--battery`, `--fuel` — so a
 * reader who has learnt that orange is the array on the diagram does not have to
 * learn it again here. Consumption takes `text-primary` rather than a fifth hue: it
 * is the quantity the other three are measured *against*, not another source.
 */
export const SITE_TREND_METRIC_TOKEN: Record<SiteTrendMetric, string> = {
  SOLAR: 'text-solar',
  BATTERY: 'text-battery',
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
};

export type SiteTrend = {
  metric: SiteTrendMetric;
  period: SiteTrendPeriod;
  points: Array<TrendPoint>;
  /** `kW`, `kWh` or `%`. */
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
};

/**
 * The shape of a site's own draw across a day, as a multiplier on its metered kW.
 *
 * Deliberately shallow. A telecom site's load is air-conditioning and radios: it
 * does not switch off at night and it does not double at noon, so this runs between
 * about 0.88 and 1.12 with the peak in the afternoon when the cabinet is hottest.
 * A domestic double-peak profile would be the wrong shape borrowed from the wrong
 * kind of customer, and it would make the array look like it was missing an evening
 * demand that these sites do not have.
 *
 * `seed.loadKw` stays the day's mean by construction — the multiplier averages to
 * 1 over 24 hours — so this reshapes the metered figure without inventing energy.
 */
const loadShape = (hour: number): number =>
  1 + 0.12 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);

/** Midnight local on the day `at` falls in. */
const startOfDay = (at: number): number => {
  const day = new Date(at);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
};

/** `07:30`, from hours-since-midnight. */
const clockLabel = (hour: number): string =>
  `${String(Math.floor(hour)).padStart(2, '0')}:${hour % 1 === 0 ? '00' : '30'}`;

/** The run covering `at`, if the set was turning then. */
const runAt = (runs: Array<GensetRun>, at: number): GensetRun | undefined =>
  runs.find((run) => {
    const from = new Date(run.startedAt).getTime();
    const to = run.endedAt === null ? Number.POSITIVE_INFINITY : new Date(run.endedAt).getTime();
    return at >= from && at < to;
  });

/**
 * What the sets at this site were putting into the bus at `at`, kW.
 *
 * Summed across every set, and that is right here where `siteDrawKw` sums nothing:
 * that function answers "what is the customer drawing", where only the duty set
 * counts because only one set is on the bus. This answers "what did the diesel do",
 * and a second set turning off-load has still burned fuel and still put hours on an
 * engine — which is exactly what a diagnostics band is for.
 */
const gensetKwAt = (gensetIds: Array<string>, at: number, now: number): number => {
  let kw = 0;
  for (const gensetId of gensetIds) {
    const run = runAt(gensetRuns(gensetId), at);
    if (run !== undefined) kw += runLoadKw(run, now);
  }
  return Math.round(kw * 10) / 10;
};

/**
 * Diesel energy across `[from, to)`, kWh — the runs' own totals, prorated.
 *
 * Exported because the genset page's summary strip asks the same question of one
 * machine over one day that the chart asks of a yard over a month, and the
 * proration is the part that has to agree: a run that started at eleven last night
 * belongs to two days, and a second implementation of that split is how the strip
 * and the chart under it end up quoting different energies for the same morning.
 */
export const gensetKwhIn = (
  gensetIds: Array<string>,
  from: number,
  to: number,
  now: number,
): number => {
  // `runTotalsIn` owns the midnight split — a run spanning it is shared between
  // the two days rather than counted twice — so this sums and rounds once. It was
  // a second copy of that arithmetic until the genset home page needed the same
  // figure for its own day, which is the point at which two copies start drifting.
  let kwh = 0;
  for (const gensetId of gensetIds) {
    kwh += runTotalsIn(gensetId, from, to, now).energyKwh;
  }
  return Math.round(kwh);
};

/** Which metrics this site can actually draw. See `SiteTrend` for why it matters. */
export const siteTrendMetrics = (
  seed: SiteSeed,
  role: SitePowerRole,
  gensetCount: number,
): Array<SiteTrendMetric> => {
  const plant = hybridPlant(seed, role);

  return SITE_TREND_METRICS.filter((metric) => {
    switch (metric) {
      case 'SOLAR':
        return hasSolar(role) && plant.solarKwp > 0;
      case 'BATTERY':
        return hasBattery(role) && plant.batteryKwh > 0;
      case 'GENSET':
        return gensetCount > 0;
      default:
        // Every site has a load, including one nothing is currently feeding —
        // which is the case a reader most wants a curve for.
        return true;
    }
  });
};

const NUMBER = new Intl.NumberFormat('en-MY', {maximumFractionDigits: 0});

/** The series, for one metric over one window. */
export const siteTrend = (
  seed: SiteSeed,
  role: SitePowerRole,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  period: SiteTrendPeriod,
  /** Midnight of the day the stepper is parked on. Only `day` reads it. */
  dayAt: number,
  now: number = Date.now(),
): SiteTrend => {
  if (period === 'day') return dayTrend(seed, role, gensetIds, metric, dayAt, now);
  return periodTrend(seed, role, gensetIds, metric, period, now);
};

/**
 * Half-hourly through one day — **power**, not energy, and that is the whole
 * reason the day gets its own function.
 *
 * At every longer window the useful quantity is how much (kWh over a bucket); at a
 * day it is what was happening (kW at an instant), because the shape is the
 * information. An array shaded from three o'clock and an array that tripped at
 * three make the same daily total and completely different curves — the same
 * argument `SolarTodayChart` makes for drawing a curve rather than another bar.
 */
const dayTrend = (
  seed: SiteSeed,
  role: SitePowerRole,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  dayAt: number,
  now: number,
): SiteTrend => {
  const start = startOfDay(dayAt);
  const today = startOfDay(now);
  const nowHour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  // Only the day in progress has an edge to stop at. A past day is complete and a
  // future one has nothing at all — and the stepper is clamped so it cannot reach
  // one.
  const edgeHour = start === today ? nowHour : 24;

  // The whole day's solar energy, which is what turns the shape into kilowatts.
  // Read once outside the loop: it is the day's fact, not the half-hour's.
  const dayKwh = todayFullKwh(seed, role, start + 12 * 3_600_000);

  const points: Array<TrendPoint> = [];
  for (let hour = 0; hour < 24; hour += DAY_STEP_HOURS) {
    const at = start + hour * 3_600_000;
    const known = hour <= edgeHour;

    points.push({
      label: clockLabel(hour),
      value: !known ? null : dayValue(seed, role, gensetIds, metric, at, hour, dayKwh, now),
    });
  }

  const readings = points.map((point) => point.value).filter((v): v is number => v !== null);
  const peak = readings.length === 0 ? 0 : Math.max(...readings);

  return {
    metric,
    period: 'day',
    points,
    unit: metric === 'BATTERY' ? '%' : 'kW',
    axisMax: metric === 'BATTERY' ? 100 : undefined,
    caption:
      metric === 'BATTERY'
        ? 'State of charge through the day, half-hourly'
        : 'Power through the day, half-hourly',
    total:
      metric === 'BATTERY'
        ? {
            label: 'Lowest today',
            value: `${readings.length === 0 ? 0 : Math.round(Math.min(...readings))}%`,
          }
        : {label: 'Peak', value: `${Math.round(peak * 10) / 10} kW`},
  };
};

/** One half-hour's reading, for whichever quantity is being drawn. */
const dayValue = (
  seed: SiteSeed,
  role: SitePowerRole,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  at: number,
  hour: number,
  dayKwh: number,
  now: number,
): number => {
  switch (metric) {
    case 'SOLAR':
      return Math.round(intradayKw(dayKwh, hour) * 10) / 10;
    case 'BATTERY':
      // Through `hybridState` rather than a copy of its charge cycle — see the
      // module note. `at` places it on the right hour of the right day.
      return Math.round(hybridState(seed, role, at).soc * 100);
    case 'GENSET':
      return gensetKwAt(gensetIds, at, now);
    default:
      return Math.round(seed.loadKw * loadShape(hour) * 10) / 10;
  }
};

/**
 * A month of days, a year of months, or the whole record — **energy** per bucket,
 * except the bank, which has no energy to add up and reports its mean level.
 */
const periodTrend = (
  seed: SiteSeed,
  role: SitePowerRole,
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
   */
  const buckets = daily
    ? solarDays(seed, role, startOfDay(now) - 29 * 86_400_000, startOfDay(now), now)
    : solarMonths(seed, role, now);

  // A site with no array has no bucket calendar from the solar model, so the
  // windows are built from the clock instead. Every metric needs the same spine,
  // and `GENSET` and `LOAD` exist at sites that have never seen a panel.
  const spine: Array<{from: number; to: number; label: string}> =
    buckets.length > 0
      ? buckets.map((bucket) => {
          const from = new Date(bucket.at).getTime();
          const to = daily
            ? from + 86_400_000
            : new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 1).getTime();
          return {from, to, label: bucket.label};
        })
      : clockSpine(daily, now);

  const points: Array<TrendPoint> = spine.map((bucket, index) => ({
    label: bucket.label,
    value: bucketValue(seed, role, gensetIds, metric, bucket, buckets[index], daily, now),
  }));

  const readings = points.map((point) => point.value).filter((v): v is number => v !== null);
  const sum = readings.reduce((total, value) => total + value, 0);

  return {
    metric,
    period,
    points,
    unit: metric === 'BATTERY' ? '%' : 'kWh',
    axisMax: metric === 'BATTERY' ? 100 : undefined,
    caption:
      metric === 'BATTERY'
        ? `Average state of charge, per ${daily ? 'day' : 'month'}`
        : period === 'lifetime'
          ? 'Energy per month, across the whole record — twelve months'
          : `Energy per ${daily ? 'day' : 'month'}`,
    total:
      metric === 'BATTERY'
        ? {
            label: 'Mean',
            value: `${readings.length === 0 ? 0 : Math.round(sum / readings.length)}%`,
          }
        : {label: 'Total', value: `${NUMBER.format(Math.round(sum))} kWh`},
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

/** One bucket's figure. `bucket` is the solar model's, where the site has one. */
const bucketValue = (
  seed: SiteSeed,
  role: SitePowerRole,
  gensetIds: Array<string>,
  metric: SiteTrendMetric,
  window: {from: number; to: number},
  solar: {actualKwh: number} | undefined,
  daily: boolean,
  now: number,
): number => {
  switch (metric) {
    case 'SOLAR':
      return solar?.actualKwh ?? 0;
    case 'GENSET':
      return gensetKwhIn(gensetIds, window.from, window.to, now);
    case 'BATTERY': {
      // Sampled every three hours across the bucket and averaged. A single reading
      // at midnight would report the trough of the cycle as the day's level.
      const step = 3 * 3_600_000;
      let sum = 0;
      let count = 0;
      for (let at = window.from; at < Math.min(window.to, now); at += step) {
        sum += hybridState(seed, role, at).soc * 100;
        count += 1;
      }
      return count === 0 ? 0 : Math.round(sum / count);
    }
    default: {
      // The metered draw over the bucket. The shape averages to 1 across a whole
      // day, so a day is `loadKw × 24` and a month is that times its own length —
      // no double-counting of the diurnal curve.
      const hours = Math.min(window.to, now + 86_400_000) - window.from;
      const days = Math.max(0, hours) / 86_400_000;
      return Math.round(seed.loadKw * 24 * (daily ? Math.min(1, days) : days));
    }
  }
};
