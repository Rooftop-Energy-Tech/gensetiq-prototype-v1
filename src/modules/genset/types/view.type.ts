import {z} from 'zod';

export const GENSET_VIEWS = ['list', 'map'] as const;

export type GensetView = (typeof GENSET_VIEWS)[number];

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
  view: z.enum(GENSET_VIEWS).default('list').catch('list'),
  q: z.string().optional().catch(undefined),
  /** Selected genset id. Absent = nothing selected. */
  id: z.string().optional().catch(undefined),
  panel: z.boolean().default(true).catch(true),
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
  view: 'list',
  panel: true,
  ...overrides,
});
