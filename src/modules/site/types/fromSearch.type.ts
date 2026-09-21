import {z} from 'zod';

/**
 * Where the reader came into an asset page **from**.
 *
 * ## Why the trail needs telling
 *
 * `/gensets/ktb3360` is one page with two ways in, and its breadcrumb could only ever
 * describe one of them. `crumbParent` is `staticData`, so a set opened from the fleet
 * register and the same set opened from its site both read `Gensets / KTB3360 | FG
 * Wilson 20 kVa` — and at a site that crumb is wrong in the one way a breadcrumb must
 * not be: the link above the page you are on goes somewhere you have never been, and
 * walking up lands you in a register of every set on the estate rather than back at
 * the yard you were reading.
 *
 * The registers are the accumulation of a category; the site is the place the plant
 * actually stands. Both are real trails and only the reader knows which one they
 * walked, so the URL is asked to remember it.
 *
 * ## Why the URL rather than history
 *
 * The same argument `view.type.ts` makes for the sites screen: state that decides what
 * a page renders belongs in the address, so the page is linkable and the back button
 * steps through it. `router.history` would answer this for a click and get it wrong
 * for a refresh, a restored tab or a pasted link — all three of which are how a
 * technician actually arrives at one of these pages twice.
 *
 * ## Why an id and not a label
 *
 * A crumb has to carry a `to` as well as a word, so a label alone could not be walked
 * up. The site's name is a lookup away from its id — `siteSeed` — which also makes an
 * unknown or hand-edited id fall back to the static parent rather than print a crumb
 * for a site that is not there.
 */
export const fromSearchSchema = z.object({
  /**
   * The site id this page was opened from, or absent.
   *
   * `.catch(undefined)` for the reason every other search schema in this app is
   * guarded: these params get hand-edited, and a malformed one should drop the extra
   * crumb rather than throw out of `validateSearch` and blank the route.
   */
  from: z.string().min(1).optional().catch(undefined),
});

export type FromSearch = z.infer<typeof fromSearchSchema>;

/** What a link from a site page passes, so the asset it opens can crumb back to it. */
export const fromSite = (siteId: string): FromSearch => ({from: siteId});

/**
 * Carry `from` across a search replacement.
 *
 * A tab that owns its query string — the runs window, an analysis metric — rebuilds
 * its search wholesale when the reader changes a control, and `from` is not its to
 * discard: changing the window on a set opened from a site must not quietly re-parent
 * that set to the fleet register. So every such `navigate` merges this in.
 */
export const keepFrom = (previous: FromSearch): FromSearch =>
  previous.from === undefined ? {} : {from: previous.from};
