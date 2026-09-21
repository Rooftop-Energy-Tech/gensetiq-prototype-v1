import {z} from 'zod';

import {FLEET_STATUSES} from '@/modules/genset/data/fleetStatus';

/** `split` is the default here for the reason `GENSET_VIEWS` gives on the fleet. */
export const SITE_VIEWS = ['split', 'list', 'map'] as const;

export type SiteView = (typeof SITE_VIEWS)[number];

/**
 * The estate cards' configuration filter. Two values, not the fleet's three: a
 * *site* is always somewhere, so there is no workshop bucket to filter to.
 */
export const SITE_ROLE_FILTERS = ['GRID_BACKUP', 'DIESEL_PRIME'] as const;

/**
 * How the register is ordered. `alarms` is the default and the list's own ranking.
 *
 * Three, because three is what the columns can answer for: who the site is, what is
 * standing against it, and whether it needs a tanker. Each runs one way — see
 * `SortSelect` on why a direction toggle is not offered.
 */
export const SITE_SORTS = ['alarms', 'name', 'fuel'] as const;

export type SiteSort = (typeof SITE_SORTS)[number];

export const SITE_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SiteSortDirection = (typeof SITE_SORT_DIRECTIONS)[number];

/**
 * Which way each key runs when a reader first picks it.
 *
 * The directions the dropdown used to state in words — `Worst standing alarm first`,
 * `Emptiest tank first`, `A to Z` — now that the column headers carry the control and
 * have no room to say it. They are not the same direction in a row: the useful end of
 * `alarms` is the top of the scale and the useful end of `fuel` is the bottom, so
 * first click means *the answer you wanted*, not *ascending*.
 *
 * Clicking the column that is already sorted flips it from here. That is the only way
 * to reach the other direction, and it is why the flip exists at all: a header that
 * did nothing on a second click reads as a dead control.
 */
export const SITE_SORT_DEFAULT_DIRECTION: Record<SiteSort, SiteSortDirection> = {
  alarms: 'desc',
  fuel: 'asc',
  name: 'asc',
};

/**
 * The `/sites` URL carries the whole view state — which view, what's typed in
 * search, which site is selected, whether the preview panel is open.
 *
 * Same principle as the fleet screen: view state lives in the URL so a filtered
 * list is linkable and the back button steps out of a search rather than off the
 * page.
 *
 * `id` is here because the map made a selection exist. In the list a site row's
 * only move is to navigate into it — but a **pin has nowhere to put a link**, so
 * clicking one has to select the site into a panel that carries the way in.
 * Selection then belongs to both views rather than to the map alone, for the
 * reason the fleet screen gives: a control that behaves differently depending on
 * which view is showing reads as a broken one.
 *
 * `.catch()`-guarded for the same reason the fleet's schema is: these params get
 * hand-edited, and a malformed one should fall back to the unfiltered list rather
 * than throw out of `validateSearch` and blank the route.
 */
export const siteSearchSchema = z.object({
  view: z.enum(SITE_VIEWS).default('split').catch('split'),
  q: z.string().optional().catch(undefined),
  /** The card chips — see the fleet schema's note; the same buckets, over yards. */
  customer: z.string().optional().catch(undefined),
  /**
   * A rollout programme id, or `none` for the sites filed under none.
   *
   * A plain string like `customer` and for the same reason: the roster is the
   * dataset's, so there is no enum to validate against here. `none` is the
   * sentinel — see `NO_PROGRAM_FILTER`, which is where the word is defined and why
   * it cannot collide with a real id.
   */
  program: z.string().optional().catch(undefined),
  role: z.enum(SITE_ROLE_FILTERS).optional().catch(undefined),
  status: z.enum(FLEET_STATUSES).optional().catch(undefined),
  /**
   * Ordering. Defaulted rather than optional: a list is always in some order, so
   * there is no "unsorted" state for `undefined` to mean — and defaulting here is
   * what keeps `sort` out of the URL until a reader actually changes it.
   */
  sort: z.enum(SITE_SORTS).default('alarms').catch('alarms'),
  /**
   * Which way that ordering runs. Optional rather than defaulted, because the
   * default is a property of the *key* and not of the list — see
   * `SITE_SORT_DEFAULT_DIRECTION`. Absent means "however this key naturally runs",
   * which keeps `dir` out of the URL until a reader flips a header off its own
   * grain.
   */
  dir: z.enum(SITE_SORT_DIRECTIONS).optional().catch(undefined),
  /** Selected site id. Absent = nothing selected. */
  id: z.string().optional().catch(undefined),
  /**
   * Panel visibility, undefaulted — the fleet screen's rule, for its reason:
   * absent means nobody has said, so the panel follows the selection and a first
   * load with nothing selected doesn't spend 393px on a placeholder.
   *
   * `.optional()` outside `.catch()` for the reason the fleet schema gives: the
   * other way round makes the key required in the input type, and every
   * `<Link to="/sites">` would have to carry a `search` object.
   */
  panel: z.boolean().catch(false).optional(),
});

export type SiteSearch = z.infer<typeof siteSearchSchema>;

/**
 * A complete `SiteSearch` for typed navigation.
 *
 * `validateSearch` fills defaults when the URL is *parsed*, but `navigate({to:
 * '/sites'})` type-checks against the full parsed shape — so a call site that
 * only cares about `id` still has to name `view` and `panel`. This puts the
 * defaults in one place instead of at every call site, exactly as
 * `gensetSearch()` does for the fleet.
 */
export const siteSearch = (overrides: Partial<SiteSearch> = {}): SiteSearch => ({
  view: 'split',
  sort: 'alarms',
  ...overrides,
});
