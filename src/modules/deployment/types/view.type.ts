import {z} from 'zod';

/**
 * Four views, where the registers have three.
 *
 * `split` is the default for the reason it is the default on `/sites`: the list is
 * the thing being read and the map is what says where. `gantt` is this screen's own
 * and has no equivalent above it — see `DeploymentsGantt` for why a feed of postings
 * wants a time axis that a feed of sites does not.
 */
export const DEPLOYMENT_VIEWS = ['split', 'list', 'map', 'gantt'] as const;

export type DeploymentView = (typeof DEPLOYMENT_VIEWS)[number];

/**
 * The two states a posting can be in, and the strip's two chips.
 *
 * Not a status vocabulary like the fleet's four: a posting is open or it is closed,
 * and everything else a reader might call a state — late, overrunning, due back —
 * is a judgement this prototype has no contract to make.
 */
export const DEPLOYMENT_STATES = ['ongoing', 'completed'] as const;

export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];

/**
 * How the feed is ordered. `started` is the default and the feed's own ranking —
 * ongoing first, newest posting at the top.
 *
 * Four, because four is what the columns can answer for: when it went out, how long
 * it has been standing, what it burned, and whose machine it is.
 */
export const DEPLOYMENT_SORTS = ['started', 'duration', 'fuel', 'genset'] as const;

export type DeploymentSort = (typeof DEPLOYMENT_SORTS)[number];

export const DEPLOYMENT_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type DeploymentSortDirection = (typeof DEPLOYMENT_SORT_DIRECTIONS)[number];

/**
 * Which way each key runs when a reader first picks it — the sites list's rule and
 * its reasoning: first click means *the answer you wanted*, not *ascending*.
 *
 * `started` and `duration` and `fuel` all run downwards, because the useful end of
 * each is the top of its scale: the newest posting, the longest standing, the
 * thirstiest. Only the tag runs A to Z.
 */
export const DEPLOYMENT_SORT_DEFAULT_DIRECTION: Record<DeploymentSort, DeploymentSortDirection> = {
  started: 'desc',
  duration: 'desc',
  fuel: 'desc',
  genset: 'asc',
};

/**
 * The `/deployment` URL carries the whole view state — which view, what is typed in
 * search, which posting is selected, whether the preview panel is open.
 *
 * The registers' schema, over postings rather than sites, and `.catch()`-guarded for
 * the same reason theirs are: these params get hand-edited, and a malformed one
 * should fall back to the unfiltered feed rather than throw out of `validateSearch`
 * and blank the route.
 */
export const deploymentSearchSchema = z.object({
  view: z.enum(DEPLOYMENT_VIEWS).default('split').catch('split'),
  q: z.string().optional().catch(undefined),
  /** The strip's two chips — open postings, or the record underneath them. */
  state: z.enum(DEPLOYMENT_STATES).optional().catch(undefined),
  /**
   * Whose estate the posting stood at. A plain string rather than an enum for the
   * reason the sites schema gives: the roster is the active brand's dataset's, so
   * there is nothing static to validate against here.
   */
  customer: z.string().optional().catch(undefined),
  sort: z.enum(DEPLOYMENT_SORTS).default('started').catch('started'),
  /**
   * Which way that ordering runs. Optional rather than defaulted, because the
   * default belongs to the *key* — see `DEPLOYMENT_SORT_DEFAULT_DIRECTION` — which
   * keeps `dir` out of the URL until a reader flips a header off its own grain.
   */
  dir: z.enum(DEPLOYMENT_SORT_DIRECTIONS).optional().catch(undefined),
  /** Selected posting id. Absent = nothing selected. */
  id: z.string().optional().catch(undefined),
  /**
   * Panel visibility, undefaulted — the registers' rule, for its reason: absent
   * means nobody has said, so the panel follows the selection and a first load with
   * nothing selected doesn't spend 393px on a placeholder.
   */
  panel: z.boolean().catch(false).optional(),
});

export type DeploymentSearch = z.infer<typeof deploymentSearchSchema>;

/**
 * A complete `DeploymentSearch` for typed navigation — `siteSearch()`'s job on this
 * screen, and see it for why the defaults live in one place rather than at every
 * `navigate({to: '/deployment'})`.
 */
export const deploymentSearch = (
  overrides: Partial<DeploymentSearch> = {},
): DeploymentSearch => ({
  view: 'split',
  sort: 'started',
  ...overrides,
});
