import {runTotalsIn} from '@/modules/genset/data/history';

import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {chargeSourceAt, fullDayKwh, gensetDay, gensetKwAt} from './dispatch';
import {
  expectedSolarKwh,
  hybridPlant,
  hybridState,
  intradayKw,
  loadShape,
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
  SOLAR: 'Solar Generation',
  BATTERY: 'Battery SoC',
  GENSET: 'Genset runtime',
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

const KWH = (value: number): string => `${NUMBER.format(Math.round(value))} kWh`;

/**
 * The array's output split by destination over `[from, to)` — what the tower took
 * against what the bank was offered — walked hourly through the same dispatch
 * order every chart uses: solar to the load first, the remainder to the bank.
 */
const solarSplitKwh = (
  seed: SiteSeed,
  role: SitePowerRole,
  from: number,
  to: number,
  now: number,
): {toLoad: number; toBank: number} => {
  let toLoad = 0;
  let toBank = 0;
  const end = Math.min(to, now);
  for (let dayStart = startOfDay(from); dayStart < end; dayStart += 86_400_000) {
    const dayKwh = todayFullKwh(seed, role, dayStart + 12 * 3_600_000);
    if (dayKwh === 0) continue;
    for (let hour = 0; hour < 24; hour += 1) {
      const at = dayStart + hour * 3_600_000;
      if (at < from || at >= end) continue;
      const solarKw = intradayKw(dayKwh, hour);
      const taken = Math.min(solarKw, seed.loadKw * loadShape(at));
      toLoad += taken;
      toBank += solarKw - taken;
    }
  }
  return {toLoad, toBank};
};

/**
 * What charged the bank over `[from, to)`, by source — the surplus walk the
 * charge-mix chart uses, at hour grain: each source first serves the load, and
 * what it has over is what the bank was offered.
 */
const bankChargeSplitKwh = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  from: number,
  to: number,
  now: number,
): {solarIn: number; gensetIn: number} => {
  let solarIn = 0;
  let gensetIn = 0;
  const end = Math.min(to, now);
  for (let dayStart = startOfDay(from); dayStart < end; dayStart += 86_400_000) {
    const dayKwh = hasSolar(role) ? fullDayKwh(seed, role, dayStart) : 0;
    const block = gensetDay(seed, role, ratedKw, dayStart);
    for (let hour = 0; hour < 24; hour += 1) {
      const at = dayStart + hour * 3_600_000;
      if (at < from || at >= end) continue;
      const solarKw = dayKwh === 0 ? 0 : intradayKw(dayKwh, hour);
      const gensetKw = gensetKwAt(role, block, hour);
      const loadKw = seed.loadKw * loadShape(at);
      const solarToLoad = Math.min(solarKw, loadKw);
      const gensetToLoad = Math.min(gensetKw, Math.max(0, loadKw - solarToLoad));
      solarIn += solarKw - solarToLoad;
      gensetIn += gensetKw - gensetToLoad;
    }
  }
  return {solarIn, gensetIn};
};

/**
 * The charge split as table rows — see `SiteTrend.mix`. A source the site has not
 * got is left off, per the app's rule about unfitted plant.
 */
const chargeMix = (
  solarIn: number,
  gensetIn: number,
  withSolar: boolean,
  withGenset: boolean,
): SiteTrend['mix'] => {
  const total = solarIn + gensetIn;
  if (total <= 0) return undefined;
  const percent = (part: number): string => `${((part / total) * 100).toFixed(1)}%`;

  const rows: SiteTrend['mix'] = [];
  if (withSolar)
    rows.push({
      label: 'Solar-charging',
      token: SITE_TREND_METRIC_TOKEN.SOLAR,
      energy: KWH(solarIn),
      share: percent(solarIn),
    });
  if (withGenset)
    rows.push({
      label: 'Genset-charging',
      token: SITE_TREND_METRIC_TOKEN.GENSET,
      energy: KWH(gensetIn),
      share: percent(gensetIn),
    });
  rows.push({label: 'Charge', token: 'text-primary', energy: KWH(total), share: '100%'});
  return rows;
};

/** The split as table rows — see `SiteTrend.mix`. `undefined` until anything generated. */
const solarMix = (toLoad: number, toBank: number): SiteTrend['mix'] => {
  const total = toLoad + toBank;
  if (total <= 0) return undefined;
  const percent = (part: number): string => `${((part / total) * 100).toFixed(1)}%`;
  return [
    {label: 'To load', token: 'text-solar', energy: KWH(toLoad), share: percent(toLoad)},
    {label: 'To battery', token: 'text-battery', energy: KWH(toBank), share: percent(toBank)},
    {label: 'Generation', token: 'text-primary', energy: KWH(total), share: '100%'},
  ];
};

/**
 * An hours figure for a readout — `6.2 h` while a tenth means something, `1,284 h`
 * once it does not.
 *
 * The threshold is a hundred hours, which is roughly where a reader stops thinking
 * in starts and shifts and starts thinking in service intervals.
 */
const hoursLabel = (hours: number): string =>
  hours < 100 ? `${Math.round(hours * 10) / 10} h` : `${NUMBER.format(Math.round(hours))} h`;

/** The series, for one metric over one window. */
export const siteTrend = (
  seed: SiteSeed,
  role: SitePowerRole,
  gensetIds: Array<string>,
  /**
   * Nameplate across the sets at this site, which is what the bank's charge
   * attribution is sized from — see `gensetDay`. `0` where the caller has none to
   * give: the level curve then simply never names the genset, which at a site with
   * no set is the truth.
   */
  ratedKw: number,
  metric: SiteTrendMetric,
  period: SiteTrendPeriod,
  /** Midnight of the day the stepper is parked on. Only `day` reads it. */
  dayAt: number,
  now: number = Date.now(),
): SiteTrend => {
  if (period === 'day') return dayTrend(seed, role, gensetIds, ratedKw, metric, dayAt, now);
  return periodTrend(seed, role, gensetIds, ratedKw, metric, period, now);
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
  role: SitePowerRole,
  gensetIds: Array<string>,
  ratedKw: number,
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

  // The whole day's solar energy, which is what turns the shape into kilowatts.
  // Read once outside the loop: it is the day's fact, not the half-hour's.
  const dayKwh = todayFullKwh(seed, role, start + 12 * 3_600_000);

  /**
   * Who gets a rise the dispatch model cannot account for.
   *
   * At a diesel hybrid there is one answer and it is the set: nothing else at the
   * site makes a kilowatt, so a bank that gained charge gained it off diesel
   * whatever hour the block model puts the run in. Attributing it is strictly
   * better than leaving half of every night uncoloured over a disagreement between
   * two models about *when* — see the note on the tint below.
   *
   * A solar hybrid gets no fallback, because there it would be a guess between two
   * real candidates.
   */
  const soleCharger = !hasSolar(role) && ratedKw > 0 ? 'GENSET' : undefined;

  const points: Array<TrendPoint> = [];
  for (let hour = 0; hour < 24; hour += DAY_STEP_HOURS) {
    const at = start + hour * 3_600_000;
    const known = hour <= edgeHour;
    const value = !known ? null : dayValue(seed, role, metric, at, hour, dayKwh);

    /**
     * The bank's curve carries the name of whatever is filling it.
     *
     * The bank's alone. A rising solar curve is not "charging from solar" — it is
     * the sun coming up — and publishing a tint on a series whose `tints` table is
     * `undefined` would leave the chart cutting the line into pieces it then drew
     * in one colour anyway.
     *
     * Only where the level actually **rose**, which is why this is a comparison
     * against the previous point rather than a straight reading of
     * `chargeSourceAt`. The level comes from `hybridState`'s own charge cycle and
     * the surplus comes from the dispatch model; they are laid to agree — see the
     * note on `gensetKwAt` — but they are not the same arithmetic, and a segment
     * painted "charging from solar" while the curve fell would be the chart
     * contradicting itself in the one place a reader is looking. Rising is the
     * claim; the source is the attribution on top of it.
     */
    const previous = points[points.length - 1]?.value;
    const rose =
      metric === 'BATTERY' &&
      value !== null &&
      previous !== null &&
      previous !== undefined &&
      value > previous;
    const tint = rose ? (chargeSourceAt(seed, role, ratedKw, at) ?? soleCharger) : undefined;

    points.push({label: clockLabel(hour), value, tint});
  }

  const readings = points.map((point) => point.value).filter((v): v is number => v !== null);
  const peak = readings.length === 0 ? 0 : Math.max(...readings);

  // The reference the bucketed views carry, at day grain. The expectation is not
  // a level but the day's promised **bell** — `intradayKw` over the expected
  // energy — drawn for the whole day, so the hours still to come show what they
  // are supposed to bring.
  const reference =
    metric === 'SOLAR'
      ? (() => {
          const promisedKwh = expectedSolarKwh(seed, role, start, start + 86_400_000);
          const values = points.map(
            (_, index) => Math.round(intradayKw(promisedKwh, index * DAY_STEP_HOURS) * 10) / 10,
          );
          return {
            label: 'Expected',
            values,
            value:
              Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) /
              10,
          };
        })()
      : undefined;

  // The blue slice and its arithmetic — see `SiteTrend.bands` and `.mix`, both off
  // the same per-sample dispatch: the tower takes first, the surplus is the bank's.
  let bands: SiteTrend['bands'];
  let mix: SiteTrend['mix'];
  let mixHeading: string | undefined;
  if (metric === 'BATTERY') {
    // The day's charge, by source — the same split the bars carry, for the table.
    const {solarIn, gensetIn} = bankChargeSplitKwh(
      seed,
      role,
      ratedKw,
      start,
      start + 86_400_000,
      now,
    );
    mix = chargeMix(solarIn, gensetIn, hasSolar(role), ratedKw > 0);
    mixHeading = 'Source';
  }
  if (metric === 'SOLAR') {
    const from: Array<number | null> = [];
    const to: Array<number | null> = [];
    let toLoadKwh = 0;
    let toBankKwh = 0;

    points.forEach((point, index) => {
      if (point.value === null) {
        from.push(null);
        to.push(null);
        return;
      }
      const at = start + index * DAY_STEP_HOURS * 3_600_000;
      const taken = Math.min(point.value, seed.loadKw * loadShape(at));
      from.push(Math.round(taken * 10) / 10);
      to.push(point.value);
      toLoadKwh += taken * DAY_STEP_HOURS;
      toBankKwh += (point.value - taken) * DAY_STEP_HOURS;
    });

    if (toLoadKwh + toBankKwh > 0) {
      bands = [{label: 'To battery', token: 'text-battery', from, to, value: KWH(toBankKwh)}];
      mix = solarMix(toLoadKwh, toBankKwh);
      mixHeading = 'Destination';
    }
  }

  return {
    metric,
    period: 'day',
    points,
    reference,
    bands,
    mix,
    mixHeading,
    shape: 'curve',
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
    tints: metric === 'BATTERY' ? CHARGE_TINTS : undefined,
  };
};

/**
 * The two colours the bank's level curve can take, and what they say.
 *
 * The plant tokens the rest of the app already uses — amber is the array on the
 * single-line diagram and on both compositions, and the fuel colour is the set —
 * so a reader who has learnt them once reads this curve without a second legend to
 * memorise. The bank's own `text-battery` is what is left: holding, or paying the
 * tower back.
 */
const CHARGE_TINTS: Record<string, {token: string; label: string}> = {
  SOLAR: {token: SITE_TREND_METRIC_TOKEN.SOLAR, label: 'Solar-charging'},
  GENSET: {token: SITE_TREND_METRIC_TOKEN.GENSET, label: 'Genset-charging'},
};

/**
 * One half-hour's reading, for whichever *continuous* quantity is being drawn.
 *
 * `GENSET` is excluded in the type rather than handled and ignored. It shares no
 * step with these three — its day is hourly buckets, not half-hourly samples — so
 * a case here would be an unreachable branch, and the `default` arm below would
 * quietly answer it as consumption the day someone deleted that branch.
 */
const dayValue = (
  seed: SiteSeed,
  role: SitePowerRole,
  metric: Exclude<SiteTrendMetric, 'GENSET'>,
  at: number,
  hour: number,
  dayKwh: number,
): number => {
  switch (metric) {
    case 'SOLAR':
      return Math.round(intradayKw(dayKwh, hour) * 10) / 10;
    case 'BATTERY':
      // Through `hybridState` rather than a copy of its charge cycle — see the
      // module note. `at` places it on the right hour of the right day.
      return Math.round(hybridState(seed, role, at).soc * 100);
    default:
      return Math.round(seed.loadKw * loadShape(at) * 10) / 10;
  }
};

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
 * ## Why minutes, and why the axis is fixed at the hour
 *
 * An hour of clock time holds at most an hour of running, so the bar is a fraction
 * of its own bucket and the ceiling is known before the day is read — the same
 * argument state of charge makes for its 0–100 axis. Fixed, a full-height bar is
 * an hour turning start to finish and a half-height one is thirty minutes, on
 * every day and every machine; auto-scaled, a quiet day with one eight-minute
 * start would draw that start as a full-height bar.
 *
 * Minutes rather than fractions of an hour because the axis has to be readable:
 * a fixed hour divides into `0 15 30 45 60`, where hours give `0 0.25 0.5` and a
 * tick row that cannot be written to one decimal place.
 *
 * A site with two sets gets a ceiling of two hours' worth — this sums engine
 * minutes across the yard, exactly as `gensetHoursIn` sums its hours, and the
 * ceiling has to be able to hold both machines turning at once.
 */
const gensetDayTrend = (gensetIds: Array<string>, dayAt: number, now: number): SiteTrend => {
  const start = startOfDay(dayAt);
  const today = startOfDay(now);
  // The hour in progress is drawn, and every hour after it is `null`. A part-hour
  // bar is honest — the minutes in it did happen — and the chart marks where the
  // record stops, so a short bar at the right edge is not read as a set that shut
  // down. Hours the day has not reached are absent rather than zero, for the
  // reason `TrendPoint.value` gives.
  const edgeHour = start === today ? new Date(now).getHours() : 23;

  const points: Array<TrendPoint> = Array.from({length: 24}, (_, hour) => {
    const from = start + hour * 3_600_000;

    return {
      label: clockLabel(hour),
      value: hour > edgeHour ? null : gensetMinutesIn(gensetIds, from, from + 3_600_000, now),
    };
  });

  const minutes = points.reduce((total, point) => total + (point.value ?? 0), 0);

  return {
    metric: 'GENSET',
    period: 'day',
    points,
    shape: 'bars',
    unit: 'min',
    axisMax: 60 * Math.max(1, gensetIds.length),
    caption:
      gensetIds.length > 1
        ? 'Engine minutes run in each hour, across the sets here'
        : 'Minutes run in each hour of the day',
    // Stated in hours even though the bars are minutes: `6.2 h` is how a day's
    // running is spoken about everywhere else on the page — the service interval,
    // the runs tab — and `372 min` would be the same fact in a unit nobody plans
    // in.
    total: {label: 'Hours run', value: hoursLabel(minutes / 60)},
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
  role: SitePowerRole,
  gensetIds: Array<string>,
  ratedKw: number,
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
    value: bucketValue(seed, role, gensetIds, metric, bucket, buckets[index], now),
  }));

  const readings = points.map((point) => point.value).filter((v): v is number => v !== null);
  const sum = readings.reduce((total, value) => total + value, 0);

  // The promise beside the measurement — see `SiteTrend.reference`. Only the
  // array carries one: the load has no physics to be held against and the sets'
  // hours are scheduled, not promised.
  const reference = (() => {
    if (metric !== 'SOLAR') return undefined;
    const values = spine.map((bucket) =>
      bucket.to <= now ? expectedSolarKwh(seed, role, bucket.from, bucket.to) : null,
    );
    const drawn = values.filter((value): value is number => value !== null);
    if (drawn.length === 0) return undefined;
    return {
      label: 'Expected',
      values,
      value: Math.round(drawn.reduce((total, value) => total + value, 0) / drawn.length),
    };
  })();

  // The splits the day view carries, per bucket and in total — see
  // `SiteTrend.bands` and `.mix`. Each bar divides at the walk's fractions,
  // scaled to the bar's own figure so the segments close on it exactly and the
  // table's totals match the bars'.
  const banded = ((): Pick<SiteTrend, 'bands' | 'mix' | 'mixHeading'> => {
    if (metric === 'SOLAR') {
      const from: Array<number | null> = [];
      const to: Array<number | null> = [];
      let loadKwh = 0;
      let bankKwh = 0;

      spine.forEach((bucket, index) => {
        const value = points[index]!.value;
        if (value === null) {
          from.push(null);
          to.push(null);
          return;
        }
        const split = solarSplitKwh(seed, role, bucket.from, bucket.to, now);
        const total = split.toLoad + split.toBank;
        const bank = total <= 0 ? 0 : (split.toBank / total) * value;
        from.push(Math.round((value - bank) * 10) / 10);
        to.push(value);
        loadKwh += value - bank;
        bankKwh += bank;
      });

      if (loadKwh + bankKwh <= 0) return {};
      return {
        bands: [{label: 'To battery', token: 'text-battery', from, to, value: KWH(bankKwh)}],
        mix: solarMix(loadKwh, bankKwh),
        mixHeading: 'Destination',
      };
    }

    if (metric === 'BATTERY') {
      // The bar is a *level*, not an energy, so the split cannot stack kilowatt-
      // hours: each bar divides at the bucket's charge-source fraction — the
      // share of what entered the bank that came off the roof against off the
      // set — which is the question the split answers, drawn on the level it
      // reached.
      const solarFrom: Array<number | null> = [];
      const solarTo: Array<number | null> = [];
      const gensetFrom: Array<number | null> = [];
      const gensetTo: Array<number | null> = [];
      let solarKwh = 0;
      let gensetKwh = 0;

      spine.forEach((bucket, index) => {
        const value = points[index]!.value;
        if (value === null) {
          solarFrom.push(null);
          solarTo.push(null);
          gensetFrom.push(null);
          gensetTo.push(null);
          return;
        }
        const {solarIn, gensetIn} = bankChargeSplitKwh(
          seed,
          role,
          ratedKw,
          bucket.from,
          bucket.to,
          now,
        );
        const total = solarIn + gensetIn;
        solarKwh += solarIn;
        gensetKwh += gensetIn;
        if (total <= 0) {
          solarFrom.push(null);
          solarTo.push(null);
          gensetFrom.push(null);
          gensetTo.push(null);
          return;
        }
        const boundary = Math.round((solarIn / total) * value * 10) / 10;
        solarFrom.push(0);
        solarTo.push(boundary);
        gensetFrom.push(boundary);
        gensetTo.push(value);
      });

      if (solarKwh + gensetKwh <= 0) return {};
      const bands: SiteTrend['bands'] = [];
      if (hasSolar(role))
        bands.push({
          label: 'Solar-charging',
          token: SITE_TREND_METRIC_TOKEN.SOLAR,
          from: solarFrom,
          to: solarTo,
          value: KWH(solarKwh),
        });
      if (ratedKw > 0)
        bands.push({
          label: 'Genset-charging',
          token: SITE_TREND_METRIC_TOKEN.GENSET,
          from: gensetFrom,
          to: gensetTo,
          value: KWH(gensetKwh),
        });
      return {
        bands,
        mix: chargeMix(solarKwh, gensetKwh, hasSolar(role), ratedKw > 0),
        mixHeading: 'Source',
      };
    }

    return {};
  })();

  const grain = daily ? 'day' : 'month';
  // Only `lifetime` names its own extent — see the note on `buckets`.
  const extent = period === 'lifetime' ? ', across the whole record — twelve months' : '';

  return {
    metric,
    period,
    points,
    reference,
    bands: banded.bands,
    mix: banded.mix,
    mixHeading: banded.mixHeading,
    shape: 'bars',
    unit: metric === 'BATTERY' ? '%' : metric === 'GENSET' ? 'h' : 'kWh',
    axisMax: metric === 'BATTERY' ? 100 : undefined,
    caption:
      metric === 'BATTERY'
        ? `Average state of charge, per ${grain}`
        : metric === 'GENSET'
          ? `Hours run per ${grain}${extent}`
          : `Energy per ${grain}${extent}`,
    total:
      metric === 'BATTERY'
        ? {
            label: 'Mean',
            value: `${readings.length === 0 ? 0 : Math.round(sum / readings.length)}%`,
          }
        : metric === 'GENSET'
          ? {label: 'Total', value: hoursLabel(sum)}
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
  now: number,
): number => {
  switch (metric) {
    case 'SOLAR':
      return solar?.actualKwh ?? 0;
    case 'GENSET':
      return gensetHoursIn(gensetIds, window.from, window.to, now);
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
      // The metered draw over the bucket, one day at a time with each day priced
      // at the slow wave's value at its noon — which is what lets the month's
      // bars rise and fall with the same wave the distribution's crown draws,
      // instead of both pretending the wave is not there. `now + 1 day` keeps
      // today counted in full, as before.
      const end = Math.min(window.to, now + 86_400_000);
      let kwh = 0;
      for (let at = window.from; at < end; at += 86_400_000) {
        kwh += seed.loadKw * 24 * loadShape(at + 43_200_000);
      }
      return Math.round(kwh);
    }
  }
};
