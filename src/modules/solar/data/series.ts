import {
  estateSolarDays,
  estateSolarMonths,
  solarDays,
  solarMonths,
} from '@/modules/site/data/hybrid';
import type {SolarBucket} from '@/modules/site/data/hybrid';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import type {SiteSeed} from '@/modules/site/data/siteSeed';
import {HAS_DESIGN_BENCHMARK, SOLAR_RANGE_GRAIN, parseDateParam} from '../types/range.type';
import type {SolarRange} from '../types/range.type';

/**
 * A chosen range, resolved into the window it means.
 *
 * One function, used by the portfolio chart and by the chart on a site's own page,
 * so a reader who sets `30D` on one and `30D` on the other is looking at the same
 * thirty days. Two screens each working it out is a pair that stays in step until
 * the first time somebody edits one.
 */
export type ResolvedRange = {
  fromMs: number;
  toMs: number;
  grain: 'day' | 'month';
  /** Whether the design P50 exists at this grain — see `HAS_DESIGN_BENCHMARK`. */
  benchmark: boolean;
  /** `19 Jul 2026 – 18 Aug 2026`, for the caption beside the chart title. */
  caption: string;
  /** True for the whole-twelve-month view, which is not a clipped window. */
  wholeYear: boolean;
};

const DAY = 24 * 3_600_000;

const stamp = (at: number): string =>
  new Date(at).toLocaleDateString('en-MY', {day: 'numeric', month: 'short', year: 'numeric'});

export const resolveRange = (
  range: SolarRange,
  from: string | undefined,
  to: string | undefined,
  now: number,
): ResolvedRange => {
  if (range === 'custom') {
    const fromMs = parseDateParam(from);
    const toMs = parseDateParam(to);

    // A custom tab with no dates behind it yet falls back to thirty days rather
    // than to nothing. An empty chart under a tab the reader has just pressed
    // reads as a fault, and the calendar is open over the top of it either way.
    if (fromMs === undefined || toMs === undefined) {
      return {
        fromMs: now - 29 * DAY,
        toMs: now,
        grain: 'day',
        benchmark: false,
        caption: 'Pick a date range',
        wholeYear: false,
      };
    }

    const start = Math.min(fromMs, toMs);
    const end = Math.max(fromMs, toMs);
    return {
      fromMs: start,
      toMs: end,
      // Above about ten weeks the daily bars are thinner than the gaps between
      // them, so the same window is drawn monthly instead. The benchmark still
      // does not appear: a hand-drawn span is almost never a whole number of
      // months, and half of March against all of March's design is a shortfall
      // the array did not have.
      grain: end - start > 70 * DAY ? 'month' : 'day',
      benchmark: false,
      caption: `${stamp(start)} – ${stamp(end)}`,
      wholeYear: false,
    };
  }

  const grain = SOLAR_RANGE_GRAIN[range];
  const days = range === '7d' ? 7 : 30;

  return {
    fromMs: grain === 'day' ? now - (days - 1) * DAY : now,
    toMs: now,
    grain,
    benchmark: HAS_DESIGN_BENCHMARK[range],
    caption:
      grain === 'month'
        ? 'Twelve months to today'
        : `${stamp(now - (days - 1) * DAY)} – ${stamp(now)}`,
    wholeYear: grain === 'month',
  };
};

/**
 * Months clipped to the window, with the design stripped where the range has none.
 *
 * The stripping is what makes `HAS_DESIGN_BENCHMARK` real rather than a note: a
 * custom span drawn at the monthly grain still gets no benchmark, because the
 * bucket handed to the chart carries `expectedKwh: null` and the chart draws what
 * it is given.
 */
const monthsWithin = (
  months: Array<SolarBucket>,
  resolved: ResolvedRange,
): Array<SolarBucket> => {
  const within = resolved.wholeYear
    ? months
    : months.filter((month) => {
        const at = new Date(month.at).getTime();
        return at >= resolved.fromMs && at <= resolved.toMs;
      });

  return resolved.benchmark ? within : within.map((month) => ({...month, expectedKwh: null}));
};

/** The portfolio's buckets at a resolved range. */
export const estateSeries = (
  roles: Record<string, SitePowerRole>,
  resolved: ResolvedRange,
  now: number,
): Array<SolarBucket> =>
  resolved.grain === 'month'
    ? monthsWithin(estateSolarMonths(roles, now), resolved)
    : estateSolarDays(roles, resolved.fromMs, resolved.toMs, now);

/** One array's buckets at the same resolved range. */
export const siteSeries = (
  seed: SiteSeed,
  role: SitePowerRole,
  resolved: ResolvedRange,
  now: number,
): Array<SolarBucket> =>
  resolved.grain === 'month'
    ? monthsWithin(solarMonths(seed, role, now), resolved)
    : solarDays(seed, role, resolved.fromMs, resolved.toMs, now);
