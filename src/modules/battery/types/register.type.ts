import {z} from 'zod';

/**
 * `/battery` carries its whole view state in the URL — which view, what is typed in
 * search, which region is chosen, which bank is selected and whether its preview is
 * open.
 *
 * ## Why this file exists at all
 *
 * The register had no search params, and `BatteryRegister`'s note said why: *"a bank
 * has a handful of columns and the sort is already on the one that matters; a search
 * field over nine rows would be a control with no question behind it. If this estate
 * grows past a screenful the right move is the solar register's toolbar, lifted
 * whole."*
 *
 * That is what happened, and the argument that moved it was not row count. A map came
 * with the fleet screen's shape, and a map makes two things exist that a nine-row
 * table did not have: a **selection**, because a pin has nowhere to put a link, and a
 * **view**, because there are now two ways to look at the same estate. Both belong in
 * the URL rather than in component state, so a bank on a map is a link somebody can
 * send. The search box and the region filter came along in the toolbar that carries
 * them, and they cost nothing on nine rows and start earning at thirty.
 *
 * The shape is `solarRegisterSearchSchema`'s, field for field. Two registers over the
 * same estate that spell their view state differently would be two products.
 */
export const BATTERY_VIEWS = ['split', 'list', 'map'] as const;

export type BatteryView = (typeof BATTERY_VIEWS)[number];

export const batteryRegisterSearchSchema = z.object({
  // Every field is `.catch()`-guarded: these params get shared and hand-edited, and a
  // typo'd `?view=grid` should fall back rather than throw out of `validateSearch` and
  // blank the route.
  view: z.enum(BATTERY_VIEWS).default('split').catch('split'),
  q: z.string().optional().catch(undefined),
  /**
   * The region a bank's site sits in. A bare string rather than the `CustomerId`
   * union, so a roster change cannot turn a shared link into a route error — an id
   * nobody recognises simply matches nothing.
   */
  customer: z.string().optional().catch(undefined),
  /** Selected bank id. Absent = nothing selected. */
  id: z.string().optional().catch(undefined),
  /**
   * Panel visibility, undefaulted — the fleet screen's rule, for its reason. Absent
   * means nobody has said, so the panel follows the selection; an explicit `false`
   * survives selecting a row.
   *
   * `.optional()` outside `.catch()`, so the key stays absent from the schema's input
   * type and a `<Link to="/battery">` does not have to spell out a `search` object.
   */
  panel: z.boolean().catch(false).optional(),
});

export type BatteryRegisterSearch = z.infer<typeof batteryRegisterSearchSchema>;

/** A complete `BatteryRegisterSearch` for typed navigation — `gensetSearch`'s twin. */
export const batterySearch = (
  overrides: Partial<BatteryRegisterSearch> = {},
): BatteryRegisterSearch => ({
  view: 'split',
  ...overrides,
});
