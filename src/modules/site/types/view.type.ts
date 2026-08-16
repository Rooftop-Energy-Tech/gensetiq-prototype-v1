import {z} from 'zod';

export const SITE_VIEWS = ['list', 'map'] as const;

export type SiteView = (typeof SITE_VIEWS)[number];

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
  view: z.enum(SITE_VIEWS).default('list').catch('list'),
  q: z.string().optional().catch(undefined),
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
  view: 'list',
  ...overrides,
});
