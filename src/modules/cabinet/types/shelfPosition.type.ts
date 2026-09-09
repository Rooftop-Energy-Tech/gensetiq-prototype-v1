/**
 * One position in the front of a shelf, as a technician standing at the open door
 * sees it.
 *
 * ## Why a position is not a module
 *
 * `SubrackModule` is *a thing the app has readings for* — ten of them, six
 * rectifiers and four SSUs. A **position** is a rectangle in the drawing, and there
 * are twenty-two across the two shelves: the ten modules, plus the three
 * distribution branches along the top, the SMU's own display, the GIM, the M48500,
 * the AC input, the inverter on the shelf below, and four blanking plates. Most of
 * them have no reading at all.
 *
 * That gap is the whole reason this type exists rather than the figure being drawn
 * straight from `subrackModules`. A drawing of ten modules floating in space is a
 * grid with extra steps; a drawing a reader can hold up against the open cabinet has
 * to include the parts the gateway is silent about, precisely *because* it is silent
 * about them. Eight of the eighteen **named parts** answer "what is this?" with
 * "nothing here is polled", and a reader who clicks one learns something true that no
 * other screen in the app says.
 *
 * ## The geometry is a drawing of one specific shelf
 *
 * These coordinates were taken off a marked-up photograph of the `ICC330-H1-C8` at
 * SBH-1336 — the only site in the estate with a monitoring unit, and therefore the
 * only site with a cabinet page at all. They are not derived from anything and
 * nothing computes them.
 *
 * So `shelfLayoutFits` guards them. If a second unit is ever added to `UNITS` with a
 * different module count, this elevation is a drawing of somebody else's hardware and
 * the page falls back to the card rack rather than labelling the wrong bays. See
 * `shelfLayout.ts`.
 */

/**
 * What sits in a position, which is also **whether anything is polled from it**.
 *
 * Two of these nine are modules with their own readings. The other seven are drawn
 * so the elevation matches the door, and each one's panel says plainly that nothing
 * is read from it — which is the honest version of a rectangle with a name on it.
 *
 * - `RECTIFIER` — a PSU bay. Six, in two rows of three.
 * - `SSU` — a solar conversion unit. Four: two on the upper row, two on the lower.
 * - `DISTRIBUTION` — one of the `DCDU-600AN1`'s three 200 A branches, along the top.
 * - `SMU` — the monitoring unit's own display and ports. Every figure on the cabinet
 *   page arrives through this position, which makes it the one inert bay a reader
 *   should probably click.
 * - `GIM` — the interface module on the upper right.
 * - `CONVERTER` — the `M48500` in the bottom right bay.
 * - `AC_INPUT` — where the incomer lands, on the left of the third row.
 * - `INVERTER` — the `ETP23006`'s inverter, on the shelf below the subrack.
 * - `BLANK` — a bay with nothing in it.
 */
export const SHELF_POSITION_KINDS = [
  'RECTIFIER',
  'SSU',
  'DISTRIBUTION',
  'SMU',
  'GIM',
  'CONVERTER',
  'AC_INPUT',
  'INVERTER',
  'BLANK',
] as const;

export type ShelfPositionKind = (typeof SHELF_POSITION_KINDS)[number];

/** Is this position one the app has readings for — six rectifiers and four SSUs. */
export const isModulePosition = (kind: ShelfPositionKind): boolean =>
  kind === 'RECTIFIER' || kind === 'SSU';

export type ShelfPosition = {
  /**
   * `psu-3`, `ssu-1`, `dcdu-2`, `smu` — unique across both shelves, and what the
   * selection is held as.
   *
   * Deliberately **not** a `SubrackModule.id`. A module's id is `sbh-1336/r03`, a
   * fact about one site's hardware, and the selection here is a fact about the
   * drawing: the same bay is `psu-3` at every site this elevation is ever valid for.
   * Joining the two by `(kind, slot)` is what keeps the geometry site-independent.
   */
  key: string;
  kind: ShelfPositionKind;
  /**
   * What the cell prints — `Rectifier 3`, `SSU 1`, `200 A`, `AC input`.
   *
   * The **app's** words for the modules, not the shelf's silkscreen. The bays are
   * printed `PSU` on the metal and every other screen in this app says
   * `Rectifier 3` — most importantly the Alarms tab, whose rows a reader is matching
   * this drawing against. The vendor's word is on the panel instead, which is where
   * a translation belongs.
   *
   * Empty for a blanking plate: a bay with nothing in it should read as nothing, and
   * a cell captioned `Blank` is a label claiming to be a part.
   */
  label: string;
  /** 1-based position within its own kind, for the two kinds that have readings. */
  slot?: number;
  /** 1-based grid column and row, and how many columns the cell spans. */
  col: number;
  row: number;
  span: number;
};

/**
 * A shelf: a rectangle of positions, with the model number that goes under it.
 *
 * Two of them at this site — the subrack and the inverter below it — which is why
 * this is a type and not one constant. They are drawn on the same column grid so the
 * two elevations line up, and that is the only thing they share.
 */
export type Shelf = {
  key: string;
  /** `ICC330-H1-C8` — printed under the drawing, as on the marked-up photograph. */
  name: string;
  /** The line under the name, saying what the reader is looking at. */
  caption: string;
  /** Grid rows, top to bottom. Columns are always `SHELF_COLUMNS`. */
  rows: number;
  positions: ReadonlyArray<ShelfPosition>;
};

/**
 * Twelve columns for a four-bay shelf, and the twelve is the distribution row.
 *
 * The modules sit on a four-column pitch and the `DCDU-600AN1`'s three branches sit
 * on a three-column one. Four does not divide into three, so a four-column grid would
 * need the top row broken out into a nested grid of its own — two coordinate systems
 * in one drawing, and every future position would have to declare which one it is in.
 * Twelve is the first number both fit in: a bay spans three, a branch spans four.
 */
export const SHELF_COLUMNS = 12;
