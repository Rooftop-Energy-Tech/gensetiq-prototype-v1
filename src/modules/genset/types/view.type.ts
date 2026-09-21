import {z} from 'zod';

import {FLEET_STATUSES} from '../data/fleetStatus';

/**
 * `split` is the default, and it is what the other two are exceptions to.
 *
 * The screen used to be one or the other, and reading it meant switching: find the
 * row, switch to the map, lose the row. Side by side, the list is the index and the
 * map is where the answer is — scrolling one moves the other (see
 * `useVisibleRowIds`), which is the behaviour a single toggle cannot express.
 *
 * The two full-width views survive because each is still the right shape for a
 * question: `list` when the columns matter and the geography doesn't, `map` when a
 * cluster is the whole point. Dropping them would have made the split a cage.
 */
export const GENSET_VIEWS = ['split', 'list', 'map'] as const;

/**
 * How the fleet is ordered. `state` is the default and the register's own ranking.
 *
 * The sites register offers the same three questions over yards — see `SITE_SORTS`.
 * `state` is this list's equivalent of that one's `alarms`: the machine you should
 * look at first, by what it is doing rather than by what it is called.
 */
export const GENSET_SORTS = ['state', 'alarms', 'name', 'fuel'] as const;

export type GensetSort = (typeof GENSET_SORTS)[number];

export const GENSET_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type GensetSortDirection = (typeof GENSET_SORT_DIRECTIONS)[number];

/**
 * Which way each key runs when a reader first picks it — the estate register's rule,
 * over machines. See `SITE_SORT_DEFAULT_DIRECTION`, which this mirrors exactly.
 *
 * `state` is `asc` and the others are not arbitrary: `stateRank` is written so that
 * **rank 0 is the machine you should look at first**, so ascending already means
 * worst-first. `fuel` ascends because the useful end of a tank is the empty one, and
 * a serial ascends because that is what A to Z means.
 */
export const GENSET_SORT_DEFAULT_DIRECTION: Record<GensetSort, GensetSortDirection> = {
  state: 'asc',
  // Worst standing alarm first, which is `desc` for the same reason it is on the
  // estate register: `alarmRank` counts *down* from critical, so the severe end is
  // the low end and reaching it means reversing. See `SITE_SORT_DEFAULT_DIRECTION`.
  alarms: 'desc',
  fuel: 'asc',
  name: 'asc',
};

export type GensetView = (typeof GENSET_VIEWS)[number];

/** The fleet cards' filters: whose set, what it feeds, and what needs doing to it. */
export const GENSET_ROLE_FILTERS = ['GRID_BACKUP', 'DIESEL_PRIME', 'WORKSHOP'] as const;

/**
 * The /gensets URL carries the whole view state — which view, what's typed in
 * search, which unit is selected, whether the detail panel is open.
 *
 * Keeping it in the URL rather than component state is what makes a link to a
 * specific genset on the map work, and it means the back button steps through
 * selections the way a reviewer clicking around a prototype expects.
 */
export const gensetSearchSchema = z.object({
  // Every field is `.catch()`-guarded. These params are meant to be shared and
  // hand-edited, and a typo'd `?view=grid` should fall back to the list rather
  // than throw out of validateSearch and blank the route.
  view: z.enum(GENSET_VIEWS).default('split').catch('split'),
  q: z.string().optional().catch(undefined),
  /**
   * The card chips, as three independent filters combined with AND.
   *
   * In the URL with everything else on this screen, so a filtered fleet is a link
   * somebody can send — which is most of the reason the chips are worth having over
   * a plain readout. `customer` is a bare string rather than the `CustomerId` union
   * so that a roster change cannot invalidate a shared link into a route error; an
   * id nobody recognises simply matches nothing.
   */
  customer: z.string().optional().catch(undefined),
  role: z.enum(GENSET_ROLE_FILTERS).optional().catch(undefined),
  status: z.enum(FLEET_STATUSES).optional().catch(undefined),
  /** Ordering. Defaulted — see the sites schema's note on why it is not optional. */
  sort: z.enum(GENSET_SORTS).default('state').catch('state'),
  /**
   * The direction, or `undefined` for the key's own default.
   *
   * Undefaulted on purpose: storing the default would put a redundant `dir` in every
   * shared URL and freeze today's idea of which way a key runs into yesterday's link.
   */
  dir: z.enum(GENSET_SORT_DIRECTIONS).optional().catch(undefined),
  /**
   * Narrow to sets inside their service window — what the overview's service tile
   * links to. Not one of the chips: it cuts across the other three rather than
   * partitioning the fleet, so it arrives by link and clears with them.
   */
  service: z.enum(['due']).optional().catch(undefined),
  /** Selected genset id. Absent = nothing selected. */
  id: z.string().optional().catch(undefined),
  /**
   * Panel visibility, and deliberately *not* defaulted.
   *
   * Absent means "nobody has said" — and the page then follows the selection:
   * open when a genset is chosen, closed on a first load with nothing to preview,
   * where the panel is 393px of "Select a genset to see its details" taking width
   * from the table. Present means somebody hit the toggle, and an explicit
   * `false` survives selecting a row for as long as they leave it that way.
   *
   * `.optional()` sits *outside* `.catch()`, unlike the fields above: a catch on
   * the outside makes the key required in the schema's input type, and every
   * `<Link to="/gensets">` in the app would then have to spell out a `search`
   * object. Absent stays absent; a hand-typed `?panel=maybe` reads as closed.
   */
  panel: z.boolean().catch(false).optional(),
});

export type GensetSearch = z.infer<typeof gensetSearchSchema>;

/**
 * A complete `GensetSearch` for typed navigation.
 *
 * `validateSearch` fills defaults when the URL is *parsed*, but `navigate({to:
 * '/gensets'})` type-checks against the full parsed shape — so a call site that
 * only cares about `id` still has to name `view` and `panel`. This puts the
 * defaults in one place instead of at every call site.
 */
export const gensetSearch = (overrides: Partial<GensetSearch> = {}): GensetSearch => ({
  view: 'split',
  sort: 'state',
  ...overrides,
});
