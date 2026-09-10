import type {BatteryModule} from './module.type';

/**
 * Where a bank's modules physically are: which cabinet, and which slot inside it.
 *
 * ## Why the bank needed a layer it did not have
 *
 * `ModuleRack` draws a bank as a wrapping grid of cards, and that grid answers *how
 * are the modules doing* very well and *which one do I open* not at all. It is the
 * same gap the cabinet page had before `SubrackFigure` replaced its card rack, and
 * the argument there transfers whole: a technician is dispatched to a site, walks up
 * to a line-up of steel boxes, and has to pick a door. A grid that reflows with the
 * browser window has no relationship to the metal — `M09` is first on a row at one
 * width and last at another.
 *
 * So this models the line-up, and `ModuleCabinetFigure` draws it.
 *
 * ## The hardware
 *
 * From the J1PT site profile in the vault, which is the same survey `monitoringUnit`
 * and `shelfLayout` are built on:
 *
 * - The battery cabinet is an **`ESC330-D6`** — 650 × 750 × 1600 mm, ground-mounted,
 *   IP34, directly ventilated. Its datasheet says **"Max 7 pcs"**, which is where
 *   `ESC330_SLOTS` comes from and is a vendor statement rather than a reading.
 * - The **`ICC330-H1-C8`** power cabinet beside them — the one this app already draws
 *   bay by bay on the cabinet page — holds the subrack, and **one battery module with
 *   it.** That module is why the `POWER` kind exists, and it appears only at the sites
 *   `siteHasCabinet` says have that box.
 *
 * At J1PT the census is **13 modules: 6 + 6 + 1.** Two `ESC330`s of six, plus the one
 * inside the power cabinet.
 *
 * ## The one thing the survey is not sure about
 *
 * The profile flags `7 + 6 + 0` as summing the same and being equally consistent with
 * what was seen, and says only the spare-slot count turns on it. `6 + 6 + 1` is what
 * is modelled here because it is the reading the profile records, and because the
 * module inside the power cabinet is the half of it that is **confirmed installed** —
 * the census lists it outright. What is inferred is only how the other twelve divide.
 *
 * If a site visit settles it the other way, `moduleCabinets` is the one function to
 * change and nothing downstream knows the difference.
 */

/**
 * How many modules an `ESC330-D6` holds. **Seven, off the datasheet.**
 *
 * Worth stating that this is vendor text and not arithmetic, because the cabinet's
 * own `-D6` suffix reads like six and was taken for six until the sheet was ingested.
 * Huawei cabinet suffixes do not encode slot counts — the site profile draws that rule
 * out explicitly, having been caught by it once.
 */
export const ESC330_SLOTS = 7;

/**
 * Past this many `ESC330`s the line-up is not drawn, and the card grid answers instead.
 *
 * **Not a layout limit — an honesty limit.** Four cabinets is 29 modules, which covers
 * every bank on the telco estate with room to spare: the seven carrier banks are 7 to
 * 13 modules, so one or two cabinets each.
 *
 * What it excludes is the other brand. The utility dataset's mini-grids run 117 to 900
 * modules, which is 17 to 129 cabinets, and drawing those would be asserting a line-up
 * of `ESC330`s at an installation that is nothing of the sort. The whole cabinet model
 * here comes off one survey of one telco tower; a 900-module bank is a containerised
 * plant, and its modules are not seven to an outdoor steel box on a pad.
 *
 * So the guard is the same one `shelfLayoutFits` applies to the subrack elevation, for
 * the same reason and with the same fallback: **draw the metal only where the metal is
 * known**, and give everything else the grid, which answers a smaller question
 * honestly rather than a bigger one wrongly.
 */
export const MAX_DRAWN_CABINETS = 4;

/** Which kind of box a group of slots is — they are not interchangeable. */
export type ModuleCabinetKind = 'ESC330' | 'POWER';

/**
 * One position in a cabinet, filled or not.
 *
 * A spare is a slot with no module rather than an absence, which is the point of
 * modelling it: a six-module `ESC330` and a seven-module one are different facts
 * about what the site can take without groundworks, and a drawing that showed only
 * what is fitted would make them look identical.
 */
export type ModuleSlot = {
  /** `c1-s3`, `power` — unique within the bank, for the key and the selection. */
  key: string;
  /** Which slot of the cabinet's own count, from 1. */
  slot: number;
  /** The module in it, or `undefined` where the position is spare. */
  module: BatteryModule | undefined;
};

/** One steel box on the pad, and everything in it. */
export type ModuleCabinet = {
  key: string;
  kind: ModuleCabinetKind;
  /** `Cabinet 1`, `Power cabinet` — what the drawing captions it. */
  label: string;
  /** `ESC330-D6`, `ICC330-H1-C8` — the part, printed under the label. */
  model: string;
  /** Every position, fitted first then spare, in slot order. */
  slots: ReadonlyArray<ModuleSlot>;
};

/** How many of a cabinet's positions have a module in them. */
export const filledSlots = (cabinet: ModuleCabinet): number =>
  cabinet.slots.filter((slot) => slot.module !== undefined).length;
