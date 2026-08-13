import {z} from 'zod';

/**
 * The `/sites` URL carries what is typed in the search box, and nothing else.
 *
 * Same principle as the fleet screen: view state lives in the URL so a filtered
 * list is linkable and the back button steps out of a search rather than off the
 * page. There is no `id` here because a site is a *place* — clicking one navigates
 * into it rather than previewing it beside the list, so there is no selection to
 * remember.
 *
 * `.catch()`-guarded for the same reason the fleet's schema is: these params get
 * hand-edited, and a malformed one should fall back to the unfiltered list rather
 * than throw out of `validateSearch` and blank the route.
 */
export const siteSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export type SiteSearch = z.infer<typeof siteSearchSchema>;
