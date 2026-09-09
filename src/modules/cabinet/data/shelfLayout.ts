import type {SubrackCabinet} from '../types/cabinet.type';
import type {Shelf, ShelfPosition} from '../types/shelfPosition.type';

/**
 * The front of the cabinet, bay by bay — the drawing the figure is laid out from.
 *
 * ## Where these coordinates come from
 *
 * A marked-up photograph of the `ICC330-H1-C8` at SBH-1336, read off directly. The
 * shelf is four bays wide and five rows deep:
 *
 * ```
 *  row 1   200 A ····· 200 A ····· 200 A          DCDU-600AN1
 *  row 2   SSU 1   SSU 2   [SMU]   [GIM]     ┐ one row of shelf,
 *          └───────┴───────┴───┘   [UIM]     ┘ two rows of grid
 *  row 3   ······  Rect 1  Rect 2  Rect 3
 *  row 4   AC in   Rect 4  Rect 5  Rect 6
 *  row 5   ······  SSU 3   SSU 4   M48500
 * ```
 *
 * Abbreviated here and only here. The cells themselves print the app's own name for
 * each bay — `Solar Supply Unit 1`, `Monitoring unit`, `Genset I/O`,
 * `Auxiliary power` — with the part number or rating on a second line under it. This
 * sketch keeps the short forms because it has to line up in a comment, and because the
 * short forms are what is silkscreened on the metal it was traced from. See
 * `ShelfPosition.label`.
 *
 * The top-right corner holds **two** modules, the GIM above a UIM, in one bay's worth
 * of height. That is the only place the drawing needs a row finer than a bay, and it
 * is why row heights are an explicit list on the `Shelf` rather than a count times a
 * constant — see `Shelf.rowHeights`.
 *
 * Nothing here is computed and nothing should be. It is a drawing of one shelf, and
 * that is exactly why it is worth having: the app already had a wrapping grid of ten
 * cards, which answers *what is in the shelf* and cannot answer *which one do I pull*.
 * A technician at the open door counts bays, and this is the only element in the app
 * laid out the way the hardware is.
 *
 * ## What the numbering does and does not claim
 *
 * `Rectifier 1` is the **top-left PSU bay**, counted along the row and then down.
 * That is a claim about the drawing, not about the Modbus address: rectifier addresses
 * are hand-set on the SMU's LCD, nobody has confirmed the six here were addressed, and
 * the thirty per-rectifier alarm registers are deliberately unpolled for that reason.
 *
 * The drawing does not undo that, and must not look like it has. Every PSU bay reads
 * `not reported`, exactly as its card did — the numbering is *how a person counts the
 * bays*, and the panel says so in as many words. Solar unit identity is positional and
 * read off detection pins, so `Solar Supply Unit 3` in this drawing genuinely is the
 * module `SSU 3 Fault` is about. The cells carry the vendor's expanded name and the
 * alarm rows keep the acronym they are addressed by, which is why the panel's identity
 * line still prints `SSU 3` — that is the string the two screens join on.
 *
 * ## Why the layout is a constant and every cabinet is still checked against it
 *
 * `shelfLayoutFits` asks two questions, and the second is the important one.
 *
 * **Were these modules counted, or sized?** `shelf.ts` gives a cabinet to every solar
 * hybrid, sizing the shelf from the bank's recharge duty where no unit is fitted, and
 * that model is trusted precisely because it reproduces SBH-1336's own six-and-four.
 * A sized shelf is a good enough answer to *how many rectifiers* and no answer at all
 * to *what does the front of this box look like* — nobody has opened it. This drawing
 * is traced off a photograph of one cabinet, and it carries an SMU bay, a GIM and an
 * M48500 that no model put there. So it is drawn only where `shelf === 'READ'`.
 *
 * That is not a hypothetical guard. `swk-0559` currently sizes to six rectifiers and
 * five SSUs — one SSU away from matching — so a count check alone would start drawing
 * a monitoring unit into a cabinet at a site that has none the moment `hybridPlant`'s
 * figures shifted.
 *
 * **And does it have the bays this drawing has?** Six and four. That agrees at the one
 * site with a unit, so this half never fires today — it fires the day a second unit is
 * added to `UNITS` with a different shelf, and on that day this elevation is a picture
 * of somebody else's hardware.
 *
 * Either way the page falls back to the card rack, which is a worse answer to *which
 * one do I pull* and a perfectly good one to *what is in this shelf*.
 */

/** How many of each kind this drawing has bays for. */
export const DRAWN_RECTIFIERS = 6;
export const DRAWN_SSUS = 4;

/**
 * Rectifier positions the shelf has, filled or not — nine, of which six are fitted.
 *
 * A fact about the metal rather than about this site's fit-out, which is why it is a
 * constant here beside `DRAWN_RECTIFIERS` and not a field on the cabinet. It counts
 * **rectifiers only**: the solar units sit in bays of their own, so six plus four was
 * never over-subscribing a nine-slot shelf.
 *
 * The elevation draws the six that are filled, so the three that are not are headroom
 * a reader cannot see. `SubrackPanel` prints the fill against this.
 */
export const RECTIFIER_POSITIONS = 9;

/**
 * How tall each kind of row is, and how the two half-rows add up to a whole one.
 *
 * A bay is `3.75rem`, up a quarter from the 3rem it was when the drawing sat under a
 * band of badges rather than being the page. At that height a bay holds its name at
 * `text-sm` over its figure at `text-xs`, which is what makes this read as a larger
 * drawing rather than a stretched one — the cells did not merely get taller, the type
 * in them got legible at the distance somebody holds a screen while looking into a
 * cabinet.
 *
 * The distribution strip stays proportionally shorter. It is shorter on the metal, and
 * giving three branches the same weight as six rectifiers would say something false
 * about which of the two a reader came here for.
 *
 * `HALF_BAY` is the arithmetic that matters. The GIM sits above a UIM in one bay's
 * worth of space, so that row is two rows in the grid — and two half-bays plus the
 * gap between them must come to exactly one bay, or the SSUs and the SMU spanning
 * both would stand taller than the rectifiers below them and the shelf would look
 * built out of two different drawings.
 */
const BAY = 3.75;
const DISTRIBUTION = 2.75;
/** The grid's own `gap-1.5`, which sits between the two halves and must be paid for. */
const ROW_GAP = 0.375;
const HALF_BAY = (BAY - ROW_GAP) / 2;

/**
 * How tall a cell actually is, in rem — its rows plus the gaps it spans across.
 *
 * Read rather than declared, so it cannot go stale. The figure needs it because a
 * cell's height decides what will fit in it: the two corner bays are **half a bay**
 * and take one line of small type, while every other named bay is a full bay and can
 * take a name over a second line. Marking those two `compact` by hand would have been
 * a second statement of the geometry, and the kind that survives a change to
 * `rowHeights` by quietly disagreeing with it.
 *
 * `ROW_GAP` is in here because a bay spanning both half-rows spans the gap between
 * them too — which is the same arithmetic `HALF_BAY` above is derived from, in the
 * other direction.
 */
export const positionHeightRem = (shelf: Shelf, position: ShelfPosition): number => {
  const span = position.rowSpan ?? 1;
  const rows = shelf.rowHeights.slice(position.row - 1, position.row - 1 + span);
  return rows.reduce((total, height) => total + height, 0) + (span - 1) * ROW_GAP;
};

/**
 * What a name over a second line needs, in rem: 17.5px of tightened `text-sm`, the
 * grid's own 2px gap, and 16px of `text-xs`, inside a 1px border each side. 37.5px,
 * rounded up to give the browser somewhere to put its rounding.
 */
const TWO_LINE_REM = 2.5;

/**
 * A cell too short to take a second line — the two stacked corner boards, and nothing
 * else in either shelf.
 *
 * Measured against what two lines need rather than against a bay, which is a
 * distinction that matters by one row: the distribution strip is `2.75rem`, shorter
 * than a bay and taller than two lines, and it is precisely the row that carries a
 * name over a rating. A `< BAY` test would have marked it compact and dropped the
 * `200 A` off all three branches.
 */
export const isCompactPosition = (shelf: Shelf, position: ShelfPosition): boolean =>
  positionHeightRem(shelf, position) < TWO_LINE_REM;

/** Is this elevation a drawing of *this* cabinet — see the note above. */
export const shelfLayoutFits = (cabinet: SubrackCabinet): boolean =>
  cabinet.shelf === 'READ' &&
  cabinet.rectifiers === DRAWN_RECTIFIERS &&
  cabinet.ssus === DRAWN_SSUS;

/**
 * `psu-3`, `ssu-1` — a module bay's key, from the one place that builds it.
 *
 * Exported because two callers need it and they must not each spell it out: the
 * layout below names its bays with it, and the band uses it to turn "the module that
 * is faulted" into "the bay to open on". Two copies of a key format is the pair that
 * silently stops matching.
 *
 * `psu` and not `rectifier`, because the key is a fact about the **drawing** and the
 * drawing is of metal silkscreened `PSU`. The app's own word for the part is on the
 * label, where a reader sees it.
 */
export const bayKey = (kind: 'RECTIFIER' | 'SSU', slot: number): string =>
  `${kind === 'RECTIFIER' ? 'psu' : 'ssu'}-${slot}`;

/**
 * The two part numbers that more than one bay carries.
 *
 * Named for the same reason `bay` below derives the module bays' part from their kind:
 * three positions each spelling out `'DCDU-600AN1'` is three chances to mistype one,
 * and the one that is mistyped is the one somebody orders a spare against. Every part
 * number in this shelf is now written exactly once.
 */
const DCDU = 'DCDU-600AN1';
const INVERTER_MODULE = 'I23002G1';

/**
 * The inverter shelf itself, which is a different part from the module in its slots.
 *
 * Exported because the panel names it on the inverter bay's identity line — the bay
 * holds an `I23002G1` and plugs into this — and that was the last part number in the
 * cabinet written in two files. The caption under the drawing prints it too, in the
 * full form the subrack's own `ICC330-H1-C8` already uses; it read `ETP23006` before,
 * which was the same part one suffix short of the name on it.
 */
export const INVERTER_SHELF_PART = 'ETP23006-C1A1';

/** `Rectifier 3` at column 7, row 3 — the module bays, which are most of the shelf. */
const bay = (
  kind: 'RECTIFIER' | 'SSU',
  slot: number,
  label: string,
  col: number,
  row: number,
  rowSpan?: number,
): ShelfPosition => ({
  key: bayKey(kind, slot),
  kind,
  label,
  // Ten bays, two part numbers, derived from the kind rather than repeated at each
  // call — the shelf is six of one module and four of the other, and a list of ten
  // identical strings is ten chances to mistype one.
  part: kind === 'RECTIFIER' ? 'R4875G5' : 'S4875G1',
  slot,
  col,
  row,
  span: 3,
  ...(rowSpan === undefined ? {} : {rowSpan}),
});

const SUBRACK: Shelf = {
  key: 'subrack',
  name: 'ICC330-H1-C8',
  caption: `The subrack, front on — ${DCDU} distribution along the top`,
  // Six rows for five rows of shelf: the second is split in half so the GIM can sit
  // above the UIM, and everything else on that row spans both halves.
  rowHeights: [DISTRIBUTION, HALF_BAY, HALF_BAY, BAY, BAY, BAY],
  positions: [
    // The DCDU's three branches: the name, with the rating under it.
    //
    // The cells used to print the rating *instead* of a name, on the argument that
    // three cells reading `DCDU-600AN1` would be one part drawn three times while the
    // rating is what differs from the bays below. Half of that was right — a part
    // number three times over says nothing — but the conclusion was wrong, because the
    // fix for a repeated part number is the part's *name*, which every other bay in
    // this drawing now carries. So the name is on the label and the rating is the
    // second line, which is the shape the module bays already use: what it is, then
    // the one figure worth knowing. Which branch is which is on the panel.
    {key: 'dcdu-1', kind: 'DISTRIBUTION', label: 'Distribution', part: DCDU, rating: '200 A', slot: 1, col: 1, row: 1, span: 4},
    {key: 'dcdu-2', kind: 'DISTRIBUTION', label: 'Distribution', part: DCDU, rating: '200 A', slot: 2, col: 5, row: 1, span: 4},
    {key: 'dcdu-3', kind: 'DISTRIBUTION', label: 'Distribution', part: DCDU, rating: '200 A', slot: 3, col: 9, row: 1, span: 4},

    // Rows 2 and 3 are the two halves of one row of shelf. These three span both.
    bay('SSU', 1, 'Solar Supply Unit 1', 1, 2, 2),
    bay('SSU', 2, 'Solar Supply Unit 2', 4, 2, 2),
    // `SMU02C` and not `Huawei SMU02C`: the model is stamped on the metal and is a
    // fact about this drawing, where the vendor's prefix and the device's own name are
    // facts about a site. The panel prints `cabinet.deviceName` for that, so the
    // constant stays a constant. See `ShelfPosition.sub`.
    {key: 'smu', kind: 'SMU', label: 'Monitoring unit', part: 'SMU02C', col: 7, row: 2, span: 3, rowSpan: 2},
    // And these two are stacked in the corner, half a bay each — so no second line,
    // whatever they might have carried. `positionHeightRem` is what enforces that.
    {key: 'gim', kind: 'GIM', label: 'Genset I/O', part: 'GIM01C', col: 10, row: 2, span: 3},
    {key: 'uim', kind: 'UIM', label: 'Environment I/O', part: 'UIM05B1', col: 10, row: 3, span: 3},

    {key: 'blank-upper', kind: 'BLANK', label: '', col: 1, row: 4, span: 3},
    bay('RECTIFIER', 1, 'Rectifier 1', 4, 4),
    bay('RECTIFIER', 2, 'Rectifier 2', 7, 4),
    bay('RECTIFIER', 3, 'Rectifier 3', 10, 4),

    // No `part`: this bay is the incomer and a 30 kA arrester, and the site record
    // does not name the arrester's model. The panel says `Not recorded` rather than
    // dropping the row — see `ShelfPosition.part`.
    {key: 'ac-input', kind: 'AC_INPUT', label: 'AC input', col: 1, row: 5, span: 3},
    bay('RECTIFIER', 4, 'Rectifier 4', 4, 5),
    bay('RECTIFIER', 5, 'Rectifier 5', 7, 5),
    bay('RECTIFIER', 6, 'Rectifier 6', 10, 5),

    {key: 'blank-lower', kind: 'BLANK', label: '', col: 1, row: 6, span: 3},
    bay('SSU', 3, 'Solar Supply Unit 3', 4, 6),
    bay('SSU', 4, 'Solar Supply Unit 4', 7, 6),
    {key: 'm48500', kind: 'CONVERTER', label: 'Auxiliary power', part: 'M48500N1', col: 10, row: 6, span: 3},
  ],
};

/**
 * The 1U shelf under the subrack, which holds an inverter and two empty bays.
 *
 * It is drawn because it is in the rack and a reader matching this figure to the door
 * will see it, and it is drawn **inert** because the app knows nothing else about it:
 * no rating, no reading, and not one register in the poll table addresses it. Its
 * panel says that rather than implying an unmonitored part is a healthy one.
 *
 * **Three equal inverter slots and nothing else**, which is what the shelf is. One is
 * fitted.
 *
 * Drawing them evenly and edge to edge is the whole point. A fitted inverter beside
 * one wide blank said only that something was there and something else was not; three
 * equal slots say *the shelf is a third full* at a glance, which is the fact worth
 * having — two more inverters fit here with no change to the rack, and nothing else in
 * the app states that.
 *
 * The connector clusters at each edge of the photograph are not drawn. They were, as
 * unlabelled blanks, and that made five bays out of a shelf with three: a reader
 * counting slots in the drawing would have counted wrong, which is worse than losing
 * two pieces of trim nobody has named. On the subrack the blanks earn their place by
 * holding labelled bays in the right column; here there is nothing either side of them
 * to hold.
 */
const INVERTER_SHELF: Shelf = {
  key: 'inverter',
  name: INVERTER_SHELF_PART,
  caption: 'The inverter shelf below it — one slot of three fitted, nothing here is polled',
  rowHeights: [BAY],
  // Three slots of four columns, filling the shelf edge to edge. It went through two
  // wrong shapes first: one inverter beside a single wide blank, which said nothing
  // about how many slots there were, and then three slots pinched between a connector
  // block on each edge, which drew five bays for a shelf that has three. The shelf is
  // three slots, so the drawing is three slots.
  positions: [
    // `I23002G1` and not `ETP23006-C1A1`. The bay holds a module; the ETP23006 is the
    // shelf it plugs into, is named in this shelf's own caption directly under the
    // drawing, and printing it on the bay both repeated the shelf and named the wrong
    // thing as the part in the slot.
    {key: 'inverter-1', kind: 'INVERTER', label: 'Inverter', part: INVERTER_MODULE, slot: 1, fitted: true, col: 1, row: 1, span: 4},
    // The empty slots carry the part number too, because `part` is *what this bay
    // takes* and `fitted` is *whether it is in there* — two facts, and the panel needs
    // both to say `None fitted` on one row and name what would go in on another. The
    // drawing shows no second line on an unpopulated slot, which is what keeps the two
    // apart: a part number under an empty bay would draw a module that is not present.
    {key: 'inverter-2', kind: 'INVERTER', label: 'Slot 2', part: INVERTER_MODULE, slot: 2, fitted: false, col: 5, row: 1, span: 4},
    {key: 'inverter-3', kind: 'INVERTER', label: 'Slot 3', part: INVERTER_MODULE, slot: 3, fitted: false, col: 9, row: 1, span: 4},
  ],
};

export const CABINET_SHELVES: ReadonlyArray<Shelf> = [SUBRACK, INVERTER_SHELF];

/** Every position across both shelves, for a lookup by key. */
export const shelfPositions = (): ReadonlyArray<ShelfPosition> =>
  CABINET_SHELVES.flatMap((shelf) => shelf.positions);

/**
 * Which alarm rows concern this bay, by their exact published names.
 *
 * A **curated cross-reference**, and the payoff of making the inert bays clickable:
 * selecting the AC input tells you the one row the unit has about it, and whether it
 * is standing right now. Nothing else in the app answers "is anything wrong with
 * *this part*".
 *
 * Matched on the row's name rather than its address, for `subrackModules`' reason —
 * the name is what the gateway publishes, what the Alarms tab renders and what the
 * handling store is keyed on, so a match here cannot drift from the row a reader
 * clicks through to.
 *
 * ## Group rows sit on every bay of their group
 *
 * `Rectifier Abnormal` says one of six is unwell **without saying which**, so it is
 * attached to all six rather than to none. `SSU Lost` does the same for the solar
 * units and rides alongside each bay's own positional `SSU N Fault`. Splitting a
 * group row six ways would invent exactly the per-module attribution the poll set
 * refuses to claim; hiding it would drop the only rectifier alarm this cabinet has.
 * The panel says which of the two a row is.
 *
 * ## Two deliberate absences
 *
 * - **The enclosure's rows are on no bay.** Door, water and smoke are the box, not a
 *   position in it, and hanging them on an arbitrary cell would make a reader think
 *   the smoke detector lives in bay 4.
 * - **`PV N Array Fault` is not on an SSU.** It is the strings on the roof; the pair
 *   being separable is the device's best diagnostic and it belongs to the array's tab.
 *
 * ## Some of these rows only exist at some sites
 *
 * The nine AC rows come from `AC_SPECS`, which the catalogue only includes where
 * there is an incomer — so at a hybrid the AC input bay claims one row and at a
 * grid-backed site it claims ten. This function returns the **claim**, unfiltered;
 * `SubrackPanel` intersects it with the site's actual catalogue before printing a
 * denominator, because "ten rows watch this bay" at a site with nine of them missing
 * is the kind of confident wrong number this whole section exists to avoid.
 */
export const positionAlarmRows = (position: ShelfPosition): ReadonlyArray<string> => {
  switch (position.kind) {
    case 'RECTIFIER':
      return [
        'Low Rectifier Capacity',
        'Rectifier Missing',
        'Rectifier Abnormal',
        'Rectifiers Comms Failure',
      ];
    // The bay's own row first, then the group's, which is the order a reader wants
    // them: `SSU 3 Fault` is about this module and `SSU Lost` is about the four.
    case 'SSU':
      return [`SSU ${position.slot} Fault`, 'SSU Lost'];
    // The DCDU is where the −48 V bus leaves the cabinet, so the two bus rows belong
    // to it along with its own fuse and the arrester on that side.
    case 'DISTRIBUTION':
      return [
        'Load Fuse Break',
        'DC SPD Fault',
        'DC Overvoltage Alarm',
        'DC Undervoltage Alarm',
      ];
    case 'AC_INPUT':
      return ['AC SPD Fault', ...AC_PHASE_ROWS];
    default:
      return [];
  }
};

/**
 * The nine per-phase rows about what arrives at the AC input.
 *
 * Built from the two axes rather than written out, so the list cannot end up with
 * eight entries or a stray `L4`. The exact strings are what `AC_SPECS` publishes and
 * a probe over all four power roles confirms every one of them resolves — a name
 * that did not match would fail silently, which is the only way this cross-reference
 * can go wrong.
 */
const AC_PHASE_ROWS: ReadonlyArray<string> = ['L1', 'L2', 'L3'].flatMap((phase) =>
  ['Overvoltage', 'Undervoltage', 'Phase Failure'].map(
    (fault) => `AC ${phase} ${fault}`,
  ),
);
