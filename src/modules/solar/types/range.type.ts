import {z} from 'zod';

/**
 * What stretch of generation the chart draws.
 *
 * The set is the one a financial chart's period selector normally carries, and it
 * is deliberately the Raeo investor dashboard's — `1D 7D 1M 1Y YTD Lifetime
 * Custom` there, trimmed here to what this estate has data for. A reader who has
 * used one of this group's dashboards has used all of them.
 *
 * Every range draws the same one thing — what the array generated — at the grain
 * `SOLAR_RANGE_GRAIN` gives it. There is nothing conditional about what appears:
 * a reader who changes the period gets the same series over a different window,
 * which is the whole reason the control can be a plain segmented track.
 */
export const SOLAR_RANGES = ['7d', '30d', '12m', 'custom'] as const;

export type SolarRange = (typeof SOLAR_RANGES)[number];

export const SOLAR_RANGE_LABEL: Record<SolarRange, string> = {
  '7d': '7D',
  '30d': '30D',
  '12m': '12M',
  custom: 'Custom',
};

/** What the bars are, at each range — for the caption, not for the reader to set. */
export const SOLAR_RANGE_GRAIN: Record<SolarRange, 'day' | 'month'> = {
  '7d': 'day',
  '30d': 'day',
  '12m': 'month',
  custom: 'day',
};

/**
 * The default, and it is the twelve months rather than the shortest window.
 *
 * A week of generation says almost nothing on its own — every array has dull
 * weeks — while twelve months shows the seasonality, the spread and any step the
 * array has taken. Opening on 7D would open the view with the least in it.
 */
export const DEFAULT_SOLAR_RANGE: SolarRange = '12m';

/** `YYYY-MM-DD`, the shape the calendar writes and the URL carries. */
const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const solarRangeSchema = {
  range: z.enum(SOLAR_RANGES).optional().catch(undefined),
  from: dateParam.optional().catch(undefined),
  to: dateParam.optional().catch(undefined),
};

/**
 * Midnight local on a `YYYY-MM-DD`, or `undefined`.
 *
 * `T00:00` without a zone, so the browser reads it as local midnight. Appending
 * `Z` would make a range drawn in Kuala Lumpur start at eight in the morning of
 * the previous day, which is how a chart ends up one bar short at one end and one
 * long at the other.
 */
export const parseDateParam = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = new Date(`${value}T00:00`).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
};
