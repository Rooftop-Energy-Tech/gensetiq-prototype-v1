import {z} from 'zod';

/**
 * `/solar` carries its filter in the URL, like every other list in this app, so a
 * narrowed register is linkable and Back steps out of a search rather than off
 * the page.
 *
 * One field, and no `view`. The generation report next door has two views because
 * it is drawing a chart per array and a chart is worth looking at; a register is
 * a table of facts, and offering a card view of it would be offering a choice
 * with no question behind it.
 *
 * `.catch()`-guarded for the reason every other schema here gives: search strings
 * get hand-edited, and a malformed one should fall back rather than throw out of
 * `validateSearch` and blank the route.
 */
export const solarRegisterSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export type SolarRegisterSearch = z.infer<typeof solarRegisterSearchSchema>;
