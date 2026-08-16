import {z} from 'zod';

/**
 * The `/meters` URL carries what is typed in the search box, and nothing else.
 *
 * Same principle as `/sites`, and the same reason there is no `id`: a meter has no
 * preview panel and no page of its own — its row links through to the site's Settings
 * tab, which is where its fitting is actually changed — so there is no selection to
 * remember.
 *
 * `.catch()`-guarded so a hand-edited param falls back to the unfiltered list rather
 * than throwing out of `validateSearch` and blanking the route.
 */
export const meterSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export type MeterSearch = z.infer<typeof meterSearchSchema>;
