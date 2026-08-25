import {z} from 'zod';

/**
 * What stretch of generation the chart draws.
 *
 * The set is the one a financial chart's period selector normally carries, and it
 * is deliberately the Raeo investor dashboard's — `1D 7D 1M 1Y YTD Lifetime
 * Custom` there, trimmed here to what this estate has data for. A reader who has
 * used one of this group's dashboards has used all of them.
 *
 * ## Why the design benchmark is not on every range
 *
 * Because it does not exist on every range. A **P50 is simulated month by month**:
 * a PVSyst report produces twelve figures for a year and nothing finer, and it is
 * fixed at design stage and never re-derived. So at a daily grain there is no
 * design to compare against, and drawing one would mean interpolating a figure
 * nobody published and inviting a reader to hold an array to it.
 *
 * SolarIQ reached this the same way, after trying to draw a daily benchmark line
 * and recording the decision as "benchmark fidelity capped at monthly"; the Raeo
 * dashboard carries it as a per-range `HAS_DESIGN_BENCHMARK` table. This is that
 * table, and `SolarBucket.expectedKwh` being nullable is how the chart obeys it.
 *
 * `custom` is `false` for the same reason it is there: a span the reader drew by
 * hand is almost never a whole number of months, and half of March against all of
 * March's design is a shortfall the array did not have.
 */
export const SOLAR_RANGES = ['7d', '30d', '12m', 'custom'] as const;

export type SolarRange = (typeof SOLAR_RANGES)[number];

export const SOLAR_RANGE_LABEL: Record<SolarRange, string> = {
  '7d': '7D',
  '30d': '30D',
  '12m': '12M',
  custom: 'Custom',
};

/** Which ranges the design P50 exists at. See the note above. */
export const HAS_DESIGN_BENCHMARK: Record<SolarRange, boolean> = {
  '7d': false,
  '30d': false,
  '12m': true,
  custom: false,
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
 * The question this screen exists for is whether the arrays are making what they
 * were bought on, and that is only answerable against the design — which only
 * exists at the monthly grain. Opening on 7D would open the one view that cannot
 * answer it.
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

/** The inverse of , kept beside it for the day a caller needs it. */
export const toDateParam = (at: number): string => {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};
