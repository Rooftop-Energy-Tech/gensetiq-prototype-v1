/**
 * One position in the front of a shelf, as a technician standing at the open door
 * sees it.
 *
 * ## Why a position is not a module
 *
 * `SubrackModule` is *a thing the app has readings for* — ten of them, six
 * rectifiers and four SSUs. A **position** is a rectangle in the drawing, and there
 * are twenty-three across the two shelves: the ten modules, plus the three
 * distribution branches along the top, the SMU's own display, the GIM and the UIM
 * stacked above and below each other, the M48500, the AC input, the ETP23006's three
 * inverter slots of which one is fitted, and two blanking plates. Most of them have
 * no reading at all.
 *
 * That gap is the whole reason this type exists rather than the figure being drawn
 * straight from `subrackModules`. A drawing of ten modules floating in space is a
 * grid with extra steps; a drawing a reader can hold up against the open cabinet has
 * to include the parts the gateway is silent about, precisely *because* it is silent
 * about them. Nine of the nineteen **named parts** answer "what is this?" with
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
 * - `SMU` — the monitoring unit's own display and ports, drawn `Monitoring unit` over
 *   `SMU02C`. Every figure on the cabinet page arrives through this position, which
 *   makes it the one inert bay a reader should probably click.
 * - `GIM` — the genset interface board in the upper right corner, drawn `Genset I/O`.
 * - `UIM` — the board directly under it, drawn `Environment I/O`. The two share one
 *   bay's height, half each, and are separate positions because they are separate
 *   modules a technician pulls separately — one cell with two words in it would draw
 *   them as one board. They are also the only two cells in either shelf too short for
 *   a second line; see `sub`.
 * - `CONVERTER` — the auxiliary power module in the bottom right bay, drawn
 *   `Auxiliary power` over `M48500N1`.
 * - `AC_INPUT` — where the incomer lands, on the left of the third row.
 * - `INVERTER` — one of the `ETP23006`'s three inverter slots, on the shelf below the
 *   subrack. This cabinet fits one of the three; `fitted` says which.
 * - `BLANK` — a bay with nothing in it.
 */
export const SHELF_POSITION_KINDS = [
  'RECTIFIER',
  'SSU',
  'DISTRIBUTION',
  'SMU',
  'GIM',
  'UIM',
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
   * What the cell prints — `Rectifier 3`, `Solar Supply Unit 1`, `Distribution`.
   *
   * The **app's** words for the parts, not the shelf's silkscreen and not the part
   * number. The bays are printed `PSU` on the metal and every other screen in this app
   * says `Rectifier 3` — most importantly the Alarms tab, whose rows a reader is
   * matching this drawing against. The vendor's word is on the panel instead, which is
   * where a translation belongs.
   *
   * **Every named bay now reads as a name.** Four of them used to carry an acronym
   * (`SMU`, `GIM`, `UIM`) or a part number (`M48500`) while their own panels were
   * already headed `Monitoring unit`, `Genset I/O`, `Environment I/O` and
   * `Auxiliary power` — so the drawing and the card beside it named one bay two ways,
   * and the drawing chose the harder of the two. The three distribution cells carried
   * a rating for the same reason and now carry the name with the rating under it. The
   * labels are exactly the panel headings, so there is one name per bay in the app.
   *
   * Empty for a blanking plate: a bay with nothing in it should read as nothing, and
   * a cell captioned `Blank` is a label claiming to be a part.
   */
  label: string;
  /**
   * The part number of whatever is in this bay — **the only place one is written.**
   *
   * Two screens print it and they must not each spell it out. Before this field, three
   * of them were written twice: `M48500N1` and `ETP23006-C1A1` sat in this file and
   * again in `SubrackPanel`, and `SMU02C` sat here and again in `monitoringUnit.ts`.
   * Two copies of a part number is the pair that silently stops matching the day one
   * is corrected — the same argument `bayKey` makes for a key format, and it matters
   * more here, because a part number is what somebody orders a spare against.
   *
   * `undefined` where the site record does not have one. That is one bay: the AC input
   * is an incomer and a 30 kA arrester, and nobody wrote down the arrester's model.
   * The panel prints `Not recorded` there rather than dropping the row, so the gap
   * shows as a gap. An unpopulated slot is a different answer again and comes from
   * `fitted`, not from here.
   *
   * ## What counts as *this bay's* part
   *
   * The thing a technician would pull out of it, not the thing around it. A
   * distribution cell is one branch of a `DCDU-600AN1`, so all three carry that and
   * the branch number tells them apart. An inverter slot holds an `I23002G1` — the
   * `ETP23006-C1A1` is the shelf it plugs into and is named in the caption under the
   * drawing, so putting it on the bay both repeated the shelf and mislabelled the
   * module.
   */
  part?: string;
  /**
   * The cell's second line where that line is a **rating** rather than a part number.
   *
   * One case, and it is the reason this is separate from `part`: the three distribution
   * branches are the same `DCDU-600AN1` three times, so a part number on the cell would
   * be one part drawn three times, while `200 A` is the fact that distinguishes the
   * strip from the bays under it. Everywhere else the second line is either a reading —
   * what the bay is delivering — or the part number, and the figure falls back to
   * `part` when this is unset.
   *
   * These were one field called `sub`, which held a rating on three cells and a part
   * number on three others. That worked for the drawing and made the part number
   * unusable as a source for anything else, because a reader of the field could not
   * tell which kind of fact it had.
   */
  rating?: string;
  /**
   * 1-based position within its own kind — the two kinds that have readings, and the
   * inverter slots, which are counted so an empty one can say which it is.
   */
  slot?: number;
  /**
   * Whether anything is actually in this slot.
   *
   * `undefined` on every position where the question does not arise, which is most of
   * them: a distribution branch, the SMU's display and the AC input are not slots that
   * could be empty, they are parts of the shelf. It is `true` or `false` only where a
   * bay is one of several identical slots and some are unpopulated — the ETP23006's
   * three inverter slots, of which this cabinet fits one.
   *
   * ## Why an empty slot is drawn as a slot and not as a blank
   *
   * `BLANK` means *drawn, inert, and nothing claimed* — it exists where the photograph
   * shows hardware nobody has named, and saying "empty bay" there would be a confident
   * claim about the one thing that cannot be identified. An unpopulated inverter slot
   * is the opposite case: it is known to be a slot, known to be for an inverter, and
   * known to be empty. That is worth drawing, because *two more inverters could go in
   * this shelf* is a real fact about the site and nothing else in the app says it.
   *
   * It does not count as a part. `SubrackShelf`'s caption counts named parts against
   * the number the unit reports on individually, and a space where a part could go is
   * not a part — counting it would inflate the denominator with absences.
   */
  fitted?: boolean;
  /** 1-based grid column and row, and how many columns the cell spans. */
  col: number;
  row: number;
  span: number;
  /**
   * How many rows the cell spans. `undefined` is one, which is almost every bay.
   *
   * It exists because one bay of the shelf is **two modules stacked** — the GIM sits
   * above a UIM in the top-right corner — so that row of the drawing is two half-rows
   * and everything else in it spans both. Half a bay is not a size this drawing
   * invents for effect: it is what the photograph shows, and the two are separate
   * modules a technician pulls separately, so they cannot be one cell with two words
   * in it.
   */
  rowSpan?: number;
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
  /**
   * Every row's height, top to bottom, **in rem**. Columns are always `SHELF_COLUMNS`
   * and are always equal; rows are not.
   *
   * Written out rather than derived from a row count and a constant, which is what it
   * was. The rows of this drawing are genuinely different heights — the distribution
   * strip is shorter than a bay because it is shorter on the metal, and the row
   * holding the GIM over the UIM is two half-bays — so a count and a multiplier could
   * not describe it without the figure re-deriving which rows were special. An
   * explicit list is the geometry, and the geometry is what this file is.
   *
   * Numbers rather than the `'3.75rem'` strings this held before, because the heights
   * are now **read** as well as emitted: a cell half a bay tall cannot take the type
   * size or the second line a full bay can, and `positionHeightRem` works that out by
   * adding these up. Storing them as CSS lengths meant parsing them back to do it. The
   * unit belongs to the renderer, which is the only thing that ever needed it.
   */
  rowHeights: ReadonlyArray<number>;
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
