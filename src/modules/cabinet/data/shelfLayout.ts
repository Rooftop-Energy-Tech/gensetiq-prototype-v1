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
 *  row 2   SSU 1   SSU 2   [SMU]   [GIM]
 *  row 3   ······  Rect 1  Rect 2  Rect 3
 *  row 4   AC in   Rect 4  Rect 5  Rect 6
 *  row 5   ······  SSU 3   SSU 4   M48500
 * ```
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
 * bays*, and the panel says so in as many words. SSU identity is positional and read
 * off detection pins, so `SSU 3` in this drawing genuinely is the module `SSU 3 Fault`
 * is about.
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

/** `Rectifier 3` at column 7, row 3 — the module bays, which are most of the shelf. */
const bay = (
  kind: 'RECTIFIER' | 'SSU',
  slot: number,
  label: string,
  col: number,
  row: number,
): ShelfPosition => ({key: bayKey(kind, slot), kind, label, slot, col, row, span: 3});

const SUBRACK: Shelf = {
  key: 'subrack',
  name: 'ICC330-H1-C8',
  caption: 'The subrack, front on — DCDU-600AN1 distribution along the top',
  rows: 5,
  positions: [
    // The DCDU's three branches. Each cell prints its rating rather than a name:
    // three cells reading `DCDU-600AN1` would be one part drawn three times, and the
    // rating is the fact that differs from the bays below it.
    {key: 'dcdu-1', kind: 'DISTRIBUTION', label: '200 A', slot: 1, col: 1, row: 1, span: 4},
    {key: 'dcdu-2', kind: 'DISTRIBUTION', label: '200 A', slot: 2, col: 5, row: 1, span: 4},
    {key: 'dcdu-3', kind: 'DISTRIBUTION', label: '200 A', slot: 3, col: 9, row: 1, span: 4},

    bay('SSU', 1, 'SSU 1', 1, 2),
    bay('SSU', 2, 'SSU 2', 4, 2),
    {key: 'smu', kind: 'SMU', label: 'SMU', col: 7, row: 2, span: 3},
    {key: 'gim', kind: 'GIM', label: 'GIM', col: 10, row: 2, span: 3},

    {key: 'blank-upper', kind: 'BLANK', label: '', col: 1, row: 3, span: 3},
    bay('RECTIFIER', 1, 'Rectifier 1', 4, 3),
    bay('RECTIFIER', 2, 'Rectifier 2', 7, 3),
    bay('RECTIFIER', 3, 'Rectifier 3', 10, 3),

    {key: 'ac-input', kind: 'AC_INPUT', label: 'AC input', col: 1, row: 4, span: 3},
    bay('RECTIFIER', 4, 'Rectifier 4', 4, 4),
    bay('RECTIFIER', 5, 'Rectifier 5', 7, 4),
    bay('RECTIFIER', 6, 'Rectifier 6', 10, 4),

    {key: 'blank-lower', kind: 'BLANK', label: '', col: 1, row: 5, span: 3},
    bay('SSU', 3, 'SSU 3', 4, 5),
    bay('SSU', 4, 'SSU 4', 7, 5),
    {key: 'm48500', kind: 'CONVERTER', label: 'M48500', col: 10, row: 5, span: 3},
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
 * The left cell is the connector and breaker cluster on the photograph. It carries no
 * label because naming it would be a guess, and an unlabelled bay in the right place
 * is still the difference between this drawing lining up with the metal and not.
 */
const INVERTER_SHELF: Shelf = {
  key: 'inverter',
  name: 'ETP23006',
  caption: 'The inverter shelf below it — nothing here is polled',
  rows: 1,
  positions: [
    {key: 'etp-gear', kind: 'BLANK', label: '', col: 1, row: 1, span: 2},
    {key: 'inverter', kind: 'INVERTER', label: 'Inverter', col: 3, row: 1, span: 4},
    {key: 'etp-spare', kind: 'BLANK', label: '', col: 7, row: 1, span: 6},
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
