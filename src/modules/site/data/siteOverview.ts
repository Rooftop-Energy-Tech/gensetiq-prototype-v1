import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, intradayKw, siteEnergy, todayFullKwh} from './hybrid';
import type {SiteSeed} from './siteSeed';
import {loadShape} from './siteTrend';
import type {SiteTrendPeriod} from './siteTrend';

/**
 * The site page's **Energy Overview** — every source and the load it serves, in
 * kilowatts, on one axis, at the same instants.
 *
 * ## Why this is a different thing from `siteTrend`
 *
 * `siteTrend` answers *"how has this one quantity behaved"*, and its whole design
 * is a picker: one metric at a time, one colour, whatever unit that metric is
 * naturally in — kW for the array, `%` for the bank, engine hours for the sets.
 * That is the right shape for a diagnostic, and it is the wrong shape for the
 * question a hybrid actually poses, which is **what carried the load**. Nobody can
 * answer that by stepping between four charts, because the answer is in the
 * relationship: an array that made its usual kilowatts on a morning the genset also
 * ran is a site with a problem, and neither curve says so alone.
 *
 * So this module publishes the four series *together*, sampled on one spine, in one
 * unit, and it does not offer a choice of metric. The picker still exists beside it
 * for the single-series views; this is the view a hybrid opens on.
 *
 * ## The convention, and that it is NetEco's
 *
 * The reference this was built against is Huawei NetEco's `Energy Trend` panel, and
 * the sign convention is theirs rather than this codebase's:
 *
 *   **positive is into the bus for a source, and into the battery for the bank.**
 *
 * So `SOLAR`, `GENSET` and `LOAD` are always ≥ 0, and `BATTERY` is positive while
 * the bank is *charging* and negative while it is *discharging*. Read that way the
 * chart is an energy balance and the balance closes at every sample:
 *
 *   `solar + genset = load + battery`
 *
 * which is exactly how NetEco's own tooltip reconciles — 6.39 kW of PV against
 * 2.33 kW of load and 3.57 kW into the bank, with the remainder as conversion loss.
 *
 * **This is the opposite of `HybridState.batteryKw`**, which is positive while the
 * bank *discharges* and which the single-line diagram prints under its battery
 * node. The two are on the same page. See the note on `batteryKw` below for what
 * that costs and why it is deliberately left standing rather than papered over.
 *
 * ## Everything is derived, nothing is seeded
 *
 * Same rule `hybrid.ts` states about itself, and for the same reason: the figure
 * on the diagram, the figure on the device card and the point on this chart have to
 * be readings of one quantity or the page contradicts itself in front of the
 * reader. So the array's curve is `intradayKw` over the day's own energy, the
 * load is the metered draw over the site's own shape, the genset's block is sized
 * from `siteEnergy`, and the bank is **the balance** — not a fifth model, but
 * whatever is left over once the other three are known.
 *
 * That last point is the one worth holding on to. The bank is not a source; it is a
 * delay. Deriving it as the residual is what makes the chart add up by construction
 * rather than by coincidence, and it is why there is no separate battery model here
 * to drift out of step with the other three.
 */

const HOURS_PER_DAY = 24;

/** Half-hourly, matching the grain `siteTrend`'s day view already publishes. */
const DAY_STEP_HOURS = 0.5;

/** Hourly across a month — 720 samples, which is about what NetEco draws. */
const MONTH_STEP_HOURS = 1;

/**
 * A year is sampled hourly like a month and then **averaged into one point per
 * day**, which is the one place this chart stops being a literal power record.
 *
 * A frank compromise, and it was tried the other way first. NetEco keeps the raw
 * curve at every window and hands the reader a range brush to zoom back into it;
 * drawn without that brush, three hundred and sixty-five day/night cycles at any
 * sub-daily grain is a solid block of colour — every series saturates its own band
 * and nothing is legible, which is not a chart, it is a texture.
 *
 * A daily mean loses the intraday shape and keeps the only thing a year can
 * honestly show: the **season**. The monsoon weeks where the array falls away and
 * the genset picks up are exactly the pattern a year view is opened for, and they
 * are visible in the means. The caption says the grain so nobody reads a mean as a
 * peak.
 *
 * Whether the year should instead carry NetEco's brush over the raw curve is on the
 * open-questions list; it is the better answer and a much larger one.
 */
const YEAR_SAMPLE_HOURS = 1;

export const OVERVIEW_SERIES = ['SOLAR', 'GENSET', 'BATTERY', 'LOAD'] as const;

export type OverviewSeriesId = (typeof OVERVIEW_SERIES)[number];

export const OVERVIEW_SERIES_LABEL: Record<OverviewSeriesId, string> = {
  SOLAR: 'Solar output',
  GENSET: 'Genset output',
  BATTERY: 'Battery charge/discharge',
  LOAD: 'Site load',
};

/**
 * Which token each series is drawn in — the plant colours the app already uses, so
 * a reader who has learnt that amber is the array on the single-line diagram does
 * not have to learn it again here.
 *
 * `LOAD` takes `text-primary` rather than a fourth hue for the reason `siteTrend`
 * gives: it is the quantity the other three are measured *against*, not another
 * source. On this chart that reads as the ink line the coloured areas have to
 * reach.
 */
export const OVERVIEW_SERIES_TOKEN: Record<OverviewSeriesId, string> = {
  SOLAR: 'text-solar',
  GENSET: 'text-fuel',
  BATTERY: 'text-battery',
  LOAD: 'text-primary',
};

export type OverviewSeries = {
  id: OverviewSeriesId;
  label: string;
  /** A text token class — the area and its stroke take `currentColor` from it. */
  token: string;
  /**
   * One reading per sample, or `null` where the record does not reach.
   *
   * `null` rather than `0` for the reason `TrendPoint.value` is: an area drawn to
   * zero across the rest of the afternoon reports a plant that has failed, which at
   * ten in the morning is every plant on the estate.
   */
  values: Array<number | null>;
  /** Signed — the bank only. Drawn below the axis where it goes negative. */
  signed: boolean;
};

export type SiteOverview = {
  period: SiteTrendPeriod;
  /** Axis labels, one per sample — `13:30`, `4 Sep`, `Mar`. */
  labels: Array<string>;
  /** A full timestamp per sample, for the hover readout. */
  stamps: Array<string>;
  series: Array<OverviewSeries>;
  unit: 'kW';
  caption: string;
  /** The figures beside the legend when nothing is hovered. */
  totals: Array<{label: string; value: string}>;
};

/**
 * Can this site draw an overview at all.
 *
 * A bank is the test rather than an array, and that is on purpose. The chart is a
 * *balance*, and a balance needs something that stores: at a diesel-prime or
 * grid-backed site the load and the supply are the same curve by definition, and
 * drawing two identical rectangles on one axis says nothing at all. Both hybrid
 * configurations have a bank, so both get the chart — a diesel hybrid's version is
 * the same picture with the solar band absent, which is a true and useful thing to
 * be able to see beside a solar hybrid's.
 *
 * Whether the diesel hybrids should get it is one of the open questions on this
 * design; enabling it costs nothing and the series that would be empty is simply
 * not published.
 */
export const hasOverview = (seed: SiteSeed, role: SitePowerRole): boolean =>
  hasBattery(role) && hybridPlant(seed, role).batteryKwh > 0;

/** Midnight local on the day `at` falls in. */
const startOfDay = (at: number): number => {
  const day = new Date(at);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
};

/** `07:30`, from hours-since-midnight. */
const clockLabel = (hour: number): string =>
  `${String(Math.floor(hour)).padStart(2, '0')}:${hour % 1 === 0 ? '00' : '30'}`;

/**
 * The whole of one day's solar energy, kWh — including a day still in progress.
 *
 * `todayFullKwh` reads the clock it is handed, so calling it at a synthetic **noon**
 * on the day in question is what makes it answer for any day rather than only for
 * today. That is the same trick `siteTrend.dayTrend` uses and it is here for the
 * same reason: the intraday curve needs the *whole* day's energy to know how tall it
 * is at one o'clock, and a partial figure would draw a shorter array all morning.
 */
const fullDayKwh = (seed: SiteSeed, role: SitePowerRole, dayStart: number): number =>
  todayFullKwh(seed, role, dayStart + 12 * 3_600_000);

/**
 * What one genset block looks like at this site, and how long it has to run today.
 *
 * ## Why the genset is modelled here rather than read from its run log
 *
 * Because the run log cannot be made to balance. `history.ts` deals every genset a
 * history from a hash of its id — it has never heard of an array or a bank — and
 * `hybrid.ts` says so plainly in its own header, along with the rule that follows:
 * the two models never appear on one screen. The metric picker honours that by
 * showing them one at a time. **This chart cannot**, because its whole claim is
 * that the four series add up, and a genset curve dealt from an unrelated hash
 * would break that claim at every sample.
 *
 * So the block is derived from `siteEnergy`, which is the same chain the array and
 * the load come from:
 *
 * - **How hard it runs** is `gensetKwh / gensetHours` — the two figures
 *   `siteEnergy` already publishes together, so the loading here and the litres on
 *   the energy report are the same arithmetic rather than two guesses at it.
 * - **How long it runs** is whatever the day's array did not cover. A solar hybrid's
 *   genset is described in `site.type` as *the backstop for a run of dull days*, and
 *   this is that sentence as a function: a bright day needs no block at all, and a
 *   week of monsoon puts one in every morning.
 *
 * The consequence a reader should expect is that **this chart's genset and the
 * genset's own page disagree**, and that is the seam `hybrid.ts` already documents
 * rather than a new one. It is on the open-questions list.
 */
const gensetDay = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  dayStart: number,
): {blockKw: number; hours: number} => {
  const energy = siteEnergy(seed, role, ratedKw);
  if (energy.gensetHours <= 0 || energy.gensetKwh <= 0) return {blockKw: 0, hours: 0};

  const blockKw = energy.gensetKwh / energy.gensetHours;

  /**
   * What the day needed *raised*, which is more than the tower drew.
   *
   * Read as a ratio off `siteEnergy` rather than restating the round-trip and
   * direct-share constants here — those live in `hybrid.ts` and a second copy of
   * them is how the two would come to disagree about how lossy the bank is.
   */
  const raise = energy.loadKwh > 0 ? energy.generationKwh / energy.loadKwh : 1;
  const neededKwh = seed.loadKw * HOURS_PER_DAY * raise;
  const solarKwh = hasSolar(role) ? fullDayKwh(seed, role, dayStart) : 0;

  const deficitKwh = Math.max(0, neededKwh - solarKwh);
  return {blockKw, hours: Math.min(HOURS_PER_DAY, deficitKwh / blockKw)};
};

/**
 * Is the set turning at `hour`, and at what output.
 *
 * ## Where the block is placed, and why it is not dealt at random
 *
 * A solar hybrid charges off the roof, so its genset only ever runs at the bottom of
 * the night — the block is laid so it **ends at first light**, which is both where
 * the bank is lowest and where an operator would expect to find it. A diesel hybrid
 * has no roof, so `hybrid.ts` gives it *two charging blocks a day* and its state of
 * charge is modelled on a twelve-hour cycle with two peaks; the two blocks here are
 * placed to match, one before dawn and one in the late afternoon, so the bank's
 * level on the picker and the bank's charging on this chart rise together instead
 * of at unrelated hours.
 *
 * Fixed hours rather than a spread on the site id, deliberately: the point of this
 * chart is that the four curves explain each other, and a block dealt to an
 * arbitrary hour would make the bank appear to charge for no visible reason.
 */
const gensetKwAt = (
  role: SitePowerRole,
  block: {blockKw: number; hours: number},
  hour: number,
): number => {
  if (block.blockKw === 0 || block.hours === 0) return 0;

  const FIRST_LIGHT = 7;
  if (hasSolar(role)) {
    const from = Math.max(0, FIRST_LIGHT - block.hours);
    return hour >= from && hour < FIRST_LIGHT ? block.blockKw : 0;
  }

  // Two blocks, half the hours each, matching the diesel hybrid's two-peak cycle.
  const half = block.hours / 2;
  const morning = hour >= Math.max(0, FIRST_LIGHT - half) && hour < FIRST_LIGHT;
  const evening = hour >= 16 && hour < Math.min(24, 16 + half);
  return morning || evening ? block.blockKw : 0;
};

/**
 * How finely to sample, and how far back to start, for each window.
 *
 * The grain coarsens with the window rather than the *quantity* changing with it,
 * which is the one place this follows NetEco against this codebase's own instinct.
 * `siteTrend` switches from a power curve to energy bars the moment the window
 * exceeds a day, on the argument that a month has no shape between buckets to draw
 * a line through. That argument is right about a bar chart of daily totals and it
 * does not apply here: this is not one reading per day, it is a **continuous power
 * record sampled hourly**, so the line between two samples is an hour of real plant
 * behaviour and not an interpolation.
 *
 * What is lost is legibility at a year, and that is on the open-questions list.
 */
const sampleHours = (period: SiteTrendPeriod): number => {
  switch (period) {
    case 'day':
      return DAY_STEP_HOURS;
    case 'month':
      return MONTH_STEP_HOURS;
    default:
      return YEAR_SAMPLE_HOURS;
  }
};

/** Does this window publish one point per day rather than one per sample. */
const isDailyMean = (period: SiteTrendPeriod): boolean =>
  period === 'year' || period === 'lifetime';

/** How many days the window spans back from, and including, its last day. */
const windowDays = (period: SiteTrendPeriod): number => {
  switch (period) {
    case 'day':
      return 1;
    case 'month':
      return 30;
    default:
      // `lifetime` is the twelve months this prototype's model holds, and the
      // caption says so — the same statement `siteTrend` makes about its own.
      return 365;
  }
};

const KW = (value: number): number => Math.round(value * 10) / 10;

const NUMBER = new Intl.NumberFormat('en-MY', {maximumFractionDigits: 0});

/**
 * The four series, over one window.
 *
 * @param ratedKw Nameplate across every set standing at this site. Passed in for
 *   the reason `siteEnergy` takes it: this module knows about places and the fleet
 *   knows about machines.
 * @param dayAt Midnight of the day the stepper is parked on. Only `day` reads it;
 *   every longer window is trailing from `now`.
 */
export const siteOverview = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  period: SiteTrendPeriod,
  dayAt: number,
  now: number = Date.now(),
): SiteOverview => {
  const step = sampleHours(period);
  const days = windowDays(period);

  const lastDay = period === 'day' ? startOfDay(dayAt) : startOfDay(now);
  const firstDay = lastDay - (days - 1) * 86_400_000;

  const solar: Array<number | null> = [];
  const genset: Array<number | null> = [];
  const battery: Array<number | null> = [];
  const load: Array<number | null> = [];
  const labels: Array<string> = [];
  const stamps: Array<string> = [];

  // Energy, so the readout beside the legend can report what each series came to
  // over the window rather than only its peak. Accumulated as `kW × step hours`,
  // which is the area under the sampled curve — the same integral the chart draws.
  let solarKwh = 0;
  let gensetKwh = 0;
  let chargeKwh = 0;
  let dischargeKwh = 0;
  let loadKwh = 0;

  const daily = isDailyMean(period);

  for (let index = 0; index < days; index += 1) {
    const dayStart = firstDay + index * 86_400_000;
    // The day's own facts, read once outside the hour loop: they are properties of
    // the day, not of the half-hour.
    const dayKwh = hasSolar(role) ? fullDayKwh(seed, role, dayStart) : 0;
    const block = gensetDay(seed, role, ratedKw, dayStart);

    // Where the window publishes daily means, the day's samples are summed here and
    // divided once at the end of the day. Unused at `day` and `month`, where every
    // sample is published as it is taken.
    let daySolar = 0;
    let dayGenset = 0;
    let dayLoad = 0;
    let dayBattery = 0;
    let taken = 0;

    for (let hour = 0; hour < HOURS_PER_DAY; hour += step) {
      const at = dayStart + hour * 3_600_000;

      if (!daily) {
        labels.push(
          period === 'day'
            ? clockLabel(hour)
            : new Date(at).toLocaleDateString('en-MY', {day: 'numeric', month: 'short'}),
        );
        stamps.push(
          new Date(at).toLocaleString('en-MY', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
        );
      }

      // Beyond the clock there is no record. Four nulls rather than four zeroes —
      // see `OverviewSeries.values`.
      if (at > now) {
        if (!daily) {
          solar.push(null);
          genset.push(null);
          battery.push(null);
          load.push(null);
        }
        continue;
      }

      const solarKw = hasSolar(role) ? KW(intradayKw(dayKwh, hour)) : 0;
      const gensetKw = KW(gensetKwAt(role, block, hour));
      const loadKw = KW(seed.loadKw * loadShape(hour));
      // The residual, and positive into the bank — see the module note. This is the
      // whole reason the chart closes: nothing else in here is free to disagree
      // with it.
      const batteryKw = KW(solarKw + gensetKw - loadKw);

      if (daily) {
        daySolar += solarKw;
        dayGenset += gensetKw;
        dayLoad += loadKw;
        dayBattery += batteryKw;
        taken += 1;
      } else {
        solar.push(solarKw);
        genset.push(gensetKw);
        battery.push(batteryKw);
        load.push(loadKw);
      }

      solarKwh += solarKw * step;
      gensetKwh += gensetKw * step;
      loadKwh += loadKw * step;
      if (batteryKw > 0) chargeKwh += batteryKw * step;
      else dischargeKwh += -batteryKw * step;
    }

    if (daily) {
      const dayLabel = new Date(dayStart).toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'short',
      });
      labels.push(dayLabel);
      stamps.push(`${dayLabel} · daily mean`);
      // A day the clock has not reached at all publishes nulls, the same way an
      // unreached half-hour does. A day part-way through reports the mean of what
      // has happened, which is what its own samples come to.
      const mean = (total: number): number | null =>
        taken === 0 ? null : KW(total / taken);
      solar.push(mean(daySolar));
      genset.push(mean(dayGenset));
      battery.push(mean(dayBattery));
      load.push(mean(dayLoad));
    }
  }

  const series: Array<OverviewSeries> = [];
  if (hasSolar(role)) {
    series.push({
      id: 'SOLAR',
      label: OVERVIEW_SERIES_LABEL.SOLAR,
      token: OVERVIEW_SERIES_TOKEN.SOLAR,
      values: solar,
      signed: false,
    });
  }
  if (ratedKw > 0) {
    series.push({
      id: 'GENSET',
      label: OVERVIEW_SERIES_LABEL.GENSET,
      token: OVERVIEW_SERIES_TOKEN.GENSET,
      values: genset,
      signed: false,
    });
  }
  series.push({
    id: 'BATTERY',
    label: OVERVIEW_SERIES_LABEL.BATTERY,
    token: OVERVIEW_SERIES_TOKEN.BATTERY,
    values: battery,
    signed: true,
  });
  series.push({
    id: 'LOAD',
    label: OVERVIEW_SERIES_LABEL.LOAD,
    token: OVERVIEW_SERIES_TOKEN.LOAD,
    values: load,
    signed: false,
  });

  const grain =
    period === 'day'
      ? 'half-hourly'
      : period === 'month'
        ? 'hourly'
        : 'as a daily mean — the intraday peaks are higher';
  const span =
    period === 'day'
      ? 'through the day'
      : period === 'month'
        ? 'across the last thirty days'
        : period === 'year'
          ? 'across the last twelve months'
          : 'across the whole record — twelve months';

  const totals: Array<{label: string; value: string}> = [];
  if (hasSolar(role)) totals.push({label: 'Solar', value: `${NUMBER.format(solarKwh)} kWh`});
  if (ratedKw > 0) totals.push({label: 'Genset', value: `${NUMBER.format(gensetKwh)} kWh`});
  totals.push({
    label: 'Battery',
    value: `${NUMBER.format(chargeKwh)} in / ${NUMBER.format(dischargeKwh)} out kWh`,
  });
  totals.push({label: 'Load', value: `${NUMBER.format(loadKwh)} kWh`});

  return {
    period,
    labels,
    stamps,
    series,
    unit: 'kW',
    caption: `Power ${span}, ${grain} · positive charges the bank`,
    totals,
  };
};
