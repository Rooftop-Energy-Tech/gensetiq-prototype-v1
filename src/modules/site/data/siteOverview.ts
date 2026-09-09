import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {fullDayKwh, gensetDay, gensetKwAt} from './dispatch';
import {hybridPlant, intradayKw, loadShape} from './hybrid';
import type {SiteSeed} from './siteSeed';
import type {ShareSeries, SiteTrendPeriod} from './siteTrend';

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
 * ## What the four series are: a composition of the load, not a balance
 *
 * The chart answers one question — **what carried the load** — and it answers it by
 * splitting the load itself three ways. `SOLAR`, `GENSET` and `BATTERY` are each
 * the power that source put *into the tower* at that instant, they stack, and the
 * stack tops out exactly on the `LOAD` line at every sample. Nothing overlaps and
 * nothing exceeds the load, because every band is a share of it.
 *
 * The shares are allocated in the order a hybrid actually dispatches:
 *
 * 1. **Solar first**, up to the load — a site uses its own generation before
 *    anything else.
 * 2. **The genset next**, for whatever the array did not cover.
 * 3. **The bank last**, which by construction is the remainder — and is the same
 *    discharge figure the residual below produces.
 *
 * ## What is deliberately not drawn: the surplus
 *
 * A source can make more than the tower is drawing, and that surplus is where the
 * bank's charge comes from. It is **clipped out of every band** — an array making
 * 8 kW against a 3 kW load contributes 3, and a genset running a 12 kW block into
 * the same load contributes 3 as well.
 *
 * That is a real quantity left off a chart, and the reason is that it is the *same
 * energy drawn twice*. Generation beyond the load goes into the bank and comes back
 * out of it later as the battery band — plotting the surplus too would show it
 * once on its way in and again on its way out, and inflate a picture of the load
 * to something taller than the load. The genset is the sharpest case: it is sized
 * to charge, so it always runs well above the tower's draw, and its unclipped block
 * was the tallest thing on the chart while carrying nothing extra to the load at
 * all.
 *
 * The reference this was built against, Huawei NetEco's `Energy Trend` panel, draws
 * the other picture: overlaid unclipped curves with the bank signed, positive into
 * the battery, so the record is a balance that closes at every sample —
 * `solar + genset = load + battery`. That is the more complete statement and it is
 * a harder read. Where the surplus and the charging matter — how full the bank got,
 * how much the array made in total — the metric picker beside this chart answers in
 * one series at a time, which is what it is for.
 *
 * Positive-is-discharge also puts the bank here back in step with
 * `HybridState.batteryKw` and the single-line diagram's battery node, which have
 * always read that way.
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
 * Every window past a day is sampled hourly and then **averaged into one point per
 * day**, which is the one place this chart stops being a literal power record.
 *
 * A frank compromise, and it was tried the other way first. NetEco keeps the raw
 * curve at every window and hands the reader a range brush to zoom back into it;
 * drawn without that brush, day/night cycles at any sub-daily grain saturate into
 * a solid block of colour at a year — and at a month they read as a different
 * *kind* of picture from the year beside them, which had readers hunting for a
 * distinction that was only sampling. So the month view takes the year's
 * treatment rather than the other way round: one grain of story — the day — at
 * every window past a day.
 *
 * A daily mean loses the intraday shape and keeps what these windows can honestly
 * show: the **season**. The monsoon weeks where the array falls away and the
 * genset picks up are exactly the pattern they are opened for, and they are
 * visible in the means. The caption says the grain so nobody reads a mean as a
 * peak. The intraday story — solar at noon, genset at night — lives on the Day
 * tab, which is the only width it fits.
 *
 * Whether these windows should instead carry NetEco's brush over the raw curve is
 * on the open-questions list; it is the better answer and a much larger one.
 */
const YEAR_SAMPLE_HOURS = 1;

export const OVERVIEW_SERIES = ['SOLAR', 'GENSET', 'BATTERY', 'LOAD'] as const;

export type OverviewSeriesId = (typeof OVERVIEW_SERIES)[number];

export const OVERVIEW_SERIES_LABEL: Record<OverviewSeriesId, string> = {
  SOLAR: 'Solar to load',
  GENSET: 'Genset to load',
  BATTERY: 'Battery to load',
  LOAD: 'Site load',
};

/**
 * The same three sources, named for the other chart.
 *
 * A separate table rather than reusing the labels above, because on the charge
 * chart they mean the opposite direction: `Solar to load` and `Solar to battery`
 * are two different quantities out of one array, and a legend that called both of
 * them `Solar` would leave a reader unable to tell which chart they were reading.
 */
export const CHARGE_SERIES_LABEL: Record<'SOLAR' | 'GENSET', string> = {
  SOLAR: 'Solar to battery',
  GENSET: 'Genset to battery',
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
  /**
   * Does this series stack, or is it the total the stack has to reach.
   *
   * True for the three sources and false for the load — which is the one thing on
   * the chart that is not a share of itself.
   */
  stacked: boolean;
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
  /**
   * Each source's share of the load per sample, in percent — the strip chart
   * under this one. The table it replaced stated one window aggregate; the lines
   * say whether a share is moving. Absent on the charge view, whose stack has no
   * total to be a share of.
   */
  mixTrend?: Array<ShareSeries>;
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
 * How finely to sample each window before any daily averaging.
 *
 * The grain coarsens with the window rather than the *quantity* changing with it:
 * this stays a power record in kW at every window, unlike `siteTrend`, which
 * switches to energy bars past a day. The sample step is what the daily mean is
 * computed *from* — hourly is fine for a mean — and only the day view publishes
 * the samples themselves.
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
const isDailyMean = (period: SiteTrendPeriod): boolean => period !== 'day';

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
 * Every share, over one window — the walk both charts are assembled from.
 *
 * One loop rather than two, because the two compositions are the two halves of the
 * same allocation: what each source put into the tower, and what each source had
 * left over for the bank. Sampling them separately would be two implementations of
 * "solar serves the load first", and the day they disagreed one chart would show a
 * surplus the other had already spent.
 *
 * @param ratedKw Nameplate across every set standing at this site. Passed in for
 *   the reason `siteEnergy` takes it: this module knows about places and the fleet
 *   knows about machines.
 * @param dayAt Midnight of the day the stepper is parked on. Only `day` reads it;
 *   every longer window is trailing from `now`.
 */
type Shares = {
  labels: Array<string>;
  stamps: Array<string>;
  /** Each source's share of the load, and the load itself. */
  toLoad: {
    solar: Array<number | null>;
    genset: Array<number | null>;
    battery: Array<number | null>;
    load: Array<number | null>;
  };
  /** What each source had left over, which is what charged the bank. */
  toBank: {
    solar: Array<number | null>;
    genset: Array<number | null>;
  };
  /** The same six, integrated over the window, kWh. */
  energy: {
    solarToLoad: number;
    gensetToLoad: number;
    batteryToLoad: number;
    load: number;
    solarToBank: number;
    gensetToBank: number;
  };
};

const shares = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  period: SiteTrendPeriod,
  dayAt: number,
  now: number,
): Shares => {
  const step = sampleHours(period);
  const days = windowDays(period);

  const lastDay = period === 'day' ? startOfDay(dayAt) : startOfDay(now);
  const firstDay = lastDay - (days - 1) * 86_400_000;

  const solar: Array<number | null> = [];
  const genset: Array<number | null> = [];
  const battery: Array<number | null> = [];
  const load: Array<number | null> = [];
  const solarIn: Array<number | null> = [];
  const gensetIn: Array<number | null> = [];
  const labels: Array<string> = [];
  const stamps: Array<string> = [];

  // Energy, so the readout beside the legend can report what each series came to
  // over the window rather than only its peak. Accumulated as `kW × step hours`,
  // which is the area under the sampled curve — the same integral the chart draws.
  const energy = {
    solarToLoad: 0,
    gensetToLoad: 0,
    batteryToLoad: 0,
    load: 0,
    solarToBank: 0,
    gensetToBank: 0,
  };

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
    let daySolarIn = 0;
    let dayGensetIn = 0;
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

      // Beyond the clock there is no record. Nulls rather than zeroes — see
      // `OverviewSeries.values`.
      if (at > now) {
        if (!daily) {
          solar.push(null);
          genset.push(null);
          battery.push(null);
          load.push(null);
          solarIn.push(null);
          gensetIn.push(null);
        }
        continue;
      }

      const solarKw = hasSolar(role) ? KW(intradayKw(dayKwh, hour)) : 0;
      const gensetKw = KW(gensetKwAt(role, block, hour));
      const loadKw = KW(seed.loadKw * loadShape(at));

      // The shares of that load, dispatched in order and each clipped to what was
      // left for it — see the module note. Clipped per sample rather than at the
      // end of the window: a day's surplus and a day's deficit happen at different
      // hours, and netting them off would report neither.
      const solarToLoad = Math.min(solarKw, loadKw);
      const gensetToLoad = Math.min(gensetKw, KW(loadKw - solarToLoad));
      // The remainder, which is the bank discharging. Identical to clamping the
      // residual `solar + genset - load` at zero — this is the same arithmetic
      // written as the share it is, and it is what makes the stack close on the
      // load line rather than near it.
      const batteryToLoad = KW(Math.max(0, loadKw - solarToLoad - gensetToLoad));

      // And what each source had over. The two halves are exhaustive by
      // construction — a source's output is what it gave the tower plus what it
      // gave the bank — which is what lets the charge chart be read as the other
      // side of this one.
      const solarToBank = KW(solarKw - solarToLoad);
      const gensetToBank = KW(gensetKw - gensetToLoad);

      if (daily) {
        daySolar += solarToLoad;
        dayGenset += gensetToLoad;
        dayLoad += loadKw;
        dayBattery += batteryToLoad;
        daySolarIn += solarToBank;
        dayGensetIn += gensetToBank;
        taken += 1;
      } else {
        solar.push(solarToLoad);
        genset.push(gensetToLoad);
        battery.push(batteryToLoad);
        load.push(loadKw);
        solarIn.push(solarToBank);
        gensetIn.push(gensetToBank);
      }

      energy.solarToLoad += solarToLoad * step;
      energy.gensetToLoad += gensetToLoad * step;
      energy.batteryToLoad += batteryToLoad * step;
      energy.load += loadKw * step;
      energy.solarToBank += solarToBank * step;
      energy.gensetToBank += gensetToBank * step;
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
      const mean = (total: number): number | null => (taken === 0 ? null : KW(total / taken));
      solar.push(mean(daySolar));
      genset.push(mean(dayGenset));
      battery.push(mean(dayBattery));
      load.push(mean(dayLoad));
      solarIn.push(mean(daySolarIn));
      gensetIn.push(mean(dayGensetIn));
    }
  }

  return {
    labels,
    stamps,
    toLoad: {solar, genset, battery, load},
    toBank: {solar: solarIn, genset: gensetIn},
    energy,
  };
};

/** How the caption names this window's span and grain. */
const windowWords = (period: SiteTrendPeriod): {span: string; grain: string} => ({
  grain:
    period === 'day'
      ? 'half-hourly'
      : 'as a daily mean — the intraday peaks are higher',
  span:
    period === 'day'
      ? 'through the day'
      : period === 'month'
        ? 'across the last thirty days'
        : period === 'year'
          ? 'across the last twelve months'
          : 'across the whole record — twelve months',
});

const KWH = (value: number): string => `${NUMBER.format(value)} kWh`;

/**
 * The load's composition: three stacked shares and the load they add up to.
 *
 * @param ratedKw Nameplate across every set standing at this site.
 * @param dayAt Midnight of the day the stepper is parked on. Only `day` reads it.
 */
export const siteOverview = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  period: SiteTrendPeriod,
  dayAt: number,
  now: number = Date.now(),
): SiteOverview => {
  const {labels, stamps, toLoad, energy} = shares(seed, role, ratedKw, period, dayAt, now);
  const {span, grain} = windowWords(period);

  const series: Array<OverviewSeries> = [];
  if (hasSolar(role)) {
    series.push({
      id: 'SOLAR',
      label: OVERVIEW_SERIES_LABEL.SOLAR,
      token: OVERVIEW_SERIES_TOKEN.SOLAR,
      values: toLoad.solar,
      stacked: true,
    });
  }
  if (ratedKw > 0) {
    series.push({
      id: 'GENSET',
      label: OVERVIEW_SERIES_LABEL.GENSET,
      token: OVERVIEW_SERIES_TOKEN.GENSET,
      values: toLoad.genset,
      stacked: true,
    });
  }
  series.push({
    id: 'BATTERY',
    label: OVERVIEW_SERIES_LABEL.BATTERY,
    token: OVERVIEW_SERIES_TOKEN.BATTERY,
    values: toLoad.battery,
    stacked: true,
  });
  series.push({
    id: 'LOAD',
    label: OVERVIEW_SERIES_LABEL.LOAD,
    token: OVERVIEW_SERIES_TOKEN.LOAD,
    values: toLoad.load,
    stacked: false,
  });

  // Each source's energy *to the load*, so the three add up to the load's own
  // figure beside them — the same claim the stack makes, in numbers.
  const totals: Array<{label: string; value: string}> = [];
  if (hasSolar(role)) totals.push({label: 'Solar', value: KWH(energy.solarToLoad)});
  if (ratedKw > 0) totals.push({label: 'Genset', value: KWH(energy.gensetToLoad)});
  totals.push({label: 'Battery', value: KWH(energy.batteryToLoad)});
  totals.push({label: 'Load', value: KWH(energy.load)});

  // The same composition as shares over time — each source's percent of the
  // load per sample, for the strip chart under this one. Null where the record
  // has not reached, so the lines end with the bands.
  const shareAt = (part: number | null, whole: number | null): number | null =>
    part === null || whole === null || whole <= 0
      ? null
      : Math.round((part / whole) * 1000) / 10;

  const mixTrend: SiteOverview['mixTrend'] = [];
  if (hasSolar(role))
    mixTrend.push({
      label: 'Solar',
      token: OVERVIEW_SERIES_TOKEN.SOLAR,
      values: toLoad.solar.map((value, index) => shareAt(value, toLoad.load[index] ?? null)),
    });
  if (ratedKw > 0)
    mixTrend.push({
      label: 'Genset',
      token: OVERVIEW_SERIES_TOKEN.GENSET,
      values: toLoad.genset.map((value, index) => shareAt(value, toLoad.load[index] ?? null)),
    });
  mixTrend.push({
    label: 'Battery',
    token: OVERVIEW_SERIES_TOKEN.BATTERY,
    values: toLoad.battery.map((value, index) => shareAt(value, toLoad.load[index] ?? null)),
  });

  return {
    period,
    labels,
    stamps,
    series,
    unit: 'kW',
    caption: `Power ${span}, ${grain} · sources stacked to the load`,
    totals,
    mixTrend,
  };
};

/**
 * The bank's composition: **what charged it**, stacked the same way.
 *
 * ## Why the level chart was not enough on its own
 *
 * State of charge says what the bank is holding and says nothing at all about
 * where it came from, and at a hybrid that second question is the one with money
 * in it: a bank that spent the night on diesel and a bank that filled off the roof
 * read as the same percentage. The whole argument for a solar hybrid is which of
 * those two a site is doing, and it was not on the page anywhere — the level chart
 * cannot show it, and the load chart deliberately clips it out.
 *
 * So this is the other side of `siteOverview`, off the same walk: every kilowatt a
 * source made beyond what the tower was drawing, stacked by source. The two charts
 * partition each source's output exactly — what it gave the load, and what it gave
 * the bank — so a reader can move between them without either of them
 * double-counting a kilowatt.
 *
 * ## What it is not
 *
 * Not the bank's *net* movement, and not the level. There is no discharge band
 * here: discharging is drawn on the load chart, where the energy went, and drawing
 * it again as a negative band would be the same kilowatt in two places, which is
 * the mistake the clipping note in the module header is about. And the surplus is
 * measured at the bus rather than at the cells, so it is what was **offered** to
 * the bank — the round-trip loss `hybrid.ts` models is not deducted here, and the
 * level chart is where the bank's own answer is.
 *
 * There is no total line, unlike the load's. The stack's own crown *is* the total
 * charging power, and a line drawn on it would trace its own edge.
 */
export const siteChargeMix = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  period: SiteTrendPeriod,
  dayAt: number,
  now: number = Date.now(),
): SiteOverview => {
  const {labels, stamps, toBank, energy} = shares(seed, role, ratedKw, period, dayAt, now);
  const {span, grain} = windowWords(period);

  const series: Array<OverviewSeries> = [];
  if (hasSolar(role)) {
    series.push({
      id: 'SOLAR',
      label: CHARGE_SERIES_LABEL.SOLAR,
      token: OVERVIEW_SERIES_TOKEN.SOLAR,
      values: toBank.solar,
      stacked: true,
    });
  }
  if (ratedKw > 0) {
    series.push({
      id: 'GENSET',
      label: CHARGE_SERIES_LABEL.GENSET,
      token: OVERVIEW_SERIES_TOKEN.GENSET,
      values: toBank.genset,
      stacked: true,
    });
  }

  // Rounded before they are added, so the strip reads `24 + 40 = 64` rather than
  // `24 + 40 = 65`. The parts are what a reader checks the total against, and a
  // total carrying a rounding the parts do not show looks like an error in the
  // chart rather than in the last decimal place.
  const fromSolar = Math.round(energy.solarToBank);
  const fromGenset = Math.round(energy.gensetToBank);

  const totals: Array<{label: string; value: string}> = [];
  if (hasSolar(role)) totals.push({label: 'From solar', value: KWH(fromSolar)});
  if (ratedKw > 0) totals.push({label: 'From genset', value: KWH(fromGenset)});
  // The share, which is the figure this chart exists to produce: a site charging
  // four fifths off its roof and one charging a fifth are the two ends of the
  // question the estate is managed on, and reading it off two bands by eye is
  // exactly the arithmetic a readout should do.
  if (hasSolar(role) && energy.solarToBank + energy.gensetToBank > 0) {
    totals.push({
      label: 'Solar share',
      value: `${Math.round(
        (energy.solarToBank / (energy.solarToBank + energy.gensetToBank)) * 100,
      )}%`,
    });
  }
  totals.push({label: 'Charged', value: KWH(fromSolar + fromGenset)});

  return {
    period,
    labels,
    stamps,
    series,
    unit: 'kW',
    caption: `Charging power ${span}, ${grain} · stacked by source`,
    totals,
  };
};
