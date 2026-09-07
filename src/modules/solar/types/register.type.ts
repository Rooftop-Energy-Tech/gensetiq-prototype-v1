import {z} from 'zod';

/**
 * `/solar` carries its whole view state in the URL, like every other list in this
 * app: which view, what is typed in search, which region is chosen, which system is
 * selected and whether its preview is open. A narrowed register is then a link
 * somebody can send, and Back steps out of a search rather than off the page.
 *
 * ## What used to be here, and why it grew
 *
 * One field — `q` — and a note arguing there should be no `view`: *"a register is a
 * table of facts, and offering a card view of it would be offering a choice with no
 * question behind it."*
 *
 * That was right about a *card* view and wrong about the map, which is the view it
 * was not considering. Every row here is plant at a place, and where the plant is
 * happens to be the one fact a table of facts cannot state: `Kapit` in a Location
 * cell does not tell a reader that it is four hours upriver from the nearest set of
 * hands. The fleet screen has held both halves side by side since — see
 * `GENSET_VIEWS` — and this is the same estate seen through a different kind of
 * plant, so it gets the same three views for the same reasons.
 *
 * `.catch()`-guarded throughout, for the reason every other schema here gives:
 * these params get shared and hand-edited, and a typo'd `?view=grid` should fall
 * back to the split rather than throw out of `validateSearch` and blank the route.
 */
export const SOLAR_VIEWS = ['split', 'list', 'map'] as const;

export type SolarView = (typeof SOLAR_VIEWS)[number];

export const solarRegisterSearchSchema = z.object({
  view: z.enum(SOLAR_VIEWS).default('split').catch('split'),
  q: z.string().optional().catch(undefined),
  /**
   * The region a system's site sits in — the estate's own division, whatever the
   * active dataset calls it. See `CUSTOMER_TERM`.
   *
   * A bare string rather than the `CustomerId` union, the rule the fleet and estate
   * schemas both follow: a roster change should not turn a shared link into a route
   * error, and an id nobody recognises simply matches nothing.
   */
  customer: z.string().optional().catch(undefined),
  /** Selected system id. Absent = nothing selected. */
  id: z.string().optional().catch(undefined),
  /**
   * Panel visibility, and deliberately *not* defaulted — the fleet screen's rule,
   * for its reason. Absent means nobody has said, so the panel follows the
   * selection: open when a system is chosen, closed on a first arrival where it
   * would be 393px of placeholder taken off the table. Present means somebody hit
   * the toggle, and an explicit `false` survives selecting a row.
   *
   * `.optional()` outside `.catch()`, so the key stays absent from the schema's
   * input type and every `<Link to="/solar">` in the app does not have to spell out
   * a `search` object.
   */
  panel: z.boolean().catch(false).optional(),
});

export type SolarRegisterSearch = z.infer<typeof solarRegisterSearchSchema>;

/**
 * A complete `SolarRegisterSearch` for typed navigation — `gensetSearch`'s twin.
 *
 * `validateSearch` fills defaults when a URL is *parsed*, but `navigate({to:
 * '/solar'})` type-checks against the full parsed shape, so a call site that only
 * cares about `customer` would still have to name `view`. This puts the defaults in
 * one place instead of at every call site.
 */
export const solarSearch = (
  overrides: Partial<SolarRegisterSearch> = {},
): SolarRegisterSearch => ({
  view: 'split',
  ...overrides,
});
