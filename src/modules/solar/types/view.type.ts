import {z} from 'zod';

import {solarRangeSchema} from './range.type';

/**
 * How the arrays are listed: as **cards** with a chart each, or as a **table**.
 *
 * Two views rather than one because the estate this page has to serve spans two
 * orders of magnitude. At four arrays a reader wants to *see* each one, and a
 * table of four rows throws away the shape of the year that is the whole reason
 * the data is worth plotting. At four hundred they want to sort, scan and search,
 * and four hundred sparklines is a texture.
 *
 * Neither is the right default for both, so the page picks by size on first load
 * and the reader overrides it — see `SOLAR_CARD_THRESHOLD`. That is the same
 * arrangement the fleet and sites screens make between their list and map, for
 * the same reason: a control that behaves differently depending on the data reads
 * as a broken one, so the *choice* is always available and only the starting
 * point moves.
 */
export const SOLAR_VIEWS = ['cards', 'table'] as const;

export type SolarView = (typeof SOLAR_VIEWS)[number];

/**
 * Above this many arrays the page opens as a table.
 *
 * Twelve is one full row of cards at a desktop width plus a little, which is the
 * point at which "look at each one" stops being what a reader is doing.
 */
export const SOLAR_CARD_THRESHOLD = 12;

/** Cards revealed per press of "Show more". One full row at most widths. */
export const SOLAR_PAGE = 12;

/**
 * `/solar` carries its view state in the URL, like every other list in this app,
 * so a filtered view is linkable and the back button steps out of a search rather
 * than off the page.
 *
 * `view` is **optional and undefaulted**, which is the one thing here not copied
 * from the sites schema. A default would settle the parameter at parse time and
 * take the size-based choice away before the page has counted anything. Absent
 * means "nobody has said", and the page decides.
 *
 * `.catch()`-guarded throughout for the reason the other schemas give: these get
 * hand-edited, and a malformed one should fall back rather than throw out of
 * `validateSearch` and blank the route.
 */
export const solarSearchSchema = z.object({
  view: z.enum(SOLAR_VIEWS).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  /** How many cards are shown. Absent is the first page. */
  shown: z.number().int().positive().optional().catch(undefined),
  // The chart's period, in the URL like everything else here, so a colleague
  // sent "the July dip" opens the same window rather than the default one.
  ...solarRangeSchema,
});

export type SolarSearch = z.infer<typeof solarSearchSchema>;
