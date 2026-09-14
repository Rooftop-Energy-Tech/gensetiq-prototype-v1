import type {ReactNode} from 'react';

import {AlarmPill} from '@/components/global/AlarmPill';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {faultedBoxes} from '../../data/junctionBoxes';
import type {JunctionBox} from '../../data/junctionBoxes';
import type {SolarSystem} from '../../types/system.type';

/**
 * Band 2 of the system page: the array's generation **broken out per junction box**,
 * one card a box, five cards to a row.
 *
 * Jeff's, 2026-09-09. It replaces a single hero `TickGauge` reading the whole array,
 * and the swap is the same one the bank page made when it put a rack of modules under
 * its pack: a plant reading one number cannot show you the part that is going.
 *
 * ## What the cards can and cannot claim
 *
 * The string counts and the capacities are **facts about the roof** — the survey's two
 * panels to a string and four strings to a box, over this array's own capacity. The
 * kilowatts are a **share**, because nothing meters a junction box: it is a passive
 * combiner with no sensor and no comms, and `junctionBoxes.ts` carries the whole
 * argument for why apportioning one measured figure across it is allowable where the
 * old per-inverter apportionment was not.
 *
 * The band **used to say so in words**, in a grey line under the heading, and Jeff
 * removed it (2026-09-09). The argument for it has not gone away and is worth keeping
 * where the next person to touch this file will see it: seven kilowatt figures on seven
 * cards look like seven readings, and a reader who took them for readings would go
 * hunting a fault in whichever box the *rounding* put a tenth into. The one honest
 * difference between the cards is **strings**.
 *
 * What carries some of that weight without a paragraph: `Current generation` names each
 * figure as that box's own output rather than leaving a bare number on a card, and the
 * total in the header is the one measured reading in the band. A tooltip on the heading
 * is the obvious home for the sentence if it is ever wanted back — see the caption.
 *
 * ## Why `Capacity` is a row and not a bar
 *
 * Each card carried a fill bar — the box's share against the box's own kWp — and Jeff
 * removed it (2026-09-09) in favour of naming the figure it drew. Both facts survive as
 * text — `Current generation` at the top of the card and `Capacity` at the bottom — and
 * a reader who wants the ratio can see it in the two numbers rather than in a length.
 *
 * That trade is worth recording because the bar was carrying something the rows do not.
 * A bar is read at a glance across seven cards, so the one box sitting lower than its
 * neighbours announced itself; a column of figures has to be compared. What buys it
 * back is that the ratio those bars drew is **around half at a clear noon** — a 28 kWp
 * array puts out about 15 kW — so seven half-empty bars read as a plant in trouble to
 * anybody who had not been told why. The dial this band replaced had the same problem
 * and needed the same paragraph. Two labelled figures cannot be misread that way.
 *
 * `Capacity` is still off **all** the box's strings and not the live ones. A box does
 * not lose nameplate when a string goes dark, so a short box shows a generation figure
 * below what its capacity would suggest — which is the comparison the row pair exists
 * to make possible.
 *
 * ## Which short boxes are marked, and which are not
 *
 * `Delivering 3 of 4` and a marked card are **two different facts**, and after
 * 2026-09-09 they line up where they can and stay apart where they cannot.
 *
 * A box whose register is asserting `PV N Array Fault` is marked *and* short. That is the
 * case Jeff found: `SJB 1` used to carry the fault and read `4 of 4` with the same
 * generation figure as its six healthy neighbours, because the strings came off a step in
 * the array's curve and the fault came off the monitoring unit with no wire between them.
 * `darkStrings` in `systems.ts` now floors the count at one string per faulted box and
 * `placeDark` puts those strings *in* those boxes, so a marked card is also the low card —
 * at SBH-1336 the two faulted boxes read `3 of 4` and 1.8 kW against 2.5 kW.
 *
 * A box that is merely short is **not** marked — no edge, no tint, no chip, just `3 of 4`
 * in the ordinary grey. Those strings come from the depth of a step in the *array's*
 * output, and a step in one series cannot say where the loss was, so they are spread a box
 * at a time. Marking them would draw a specific claim — *this* box has a fault — out of a
 * measurement that contains no such claim.
 *
 * The rule underneath both: **claims are placed and marked, measurements are spread and
 * left grey.** `placeDark` is where it is implemented.
 *
 * The array-level loss is not going unsaid either. `SystemHealth`, at the top of the
 * Alarms tab, raises it against the reading and the step behind it — and only where there *is* a step, so a
 * loss known only from a register does not get a message claiming the output dropped.
 *
 * ## The fault mark is `AlarmPill`, shared with every other part in the app
 *
 * **One pill directly under the box's own name**, carrying the rank and the register
 * together — `Critical · PV 1 Array Fault` — in the row's own severity colour, linking to
 * the Alarms tab. `AlarmPill` carries the whole argument for the shape.
 *
 * It replaced a **pair**: a `FaultBadge` in the card's top-right corner saying `Critical`
 * and a `FaultChip` under the label naming the register in grey. The pair itself had
 * replaced two byte-identical copies of a bare `<Link>`, one here and one in `ModuleRack`,
 * which is how a faulted junction box and a faulted battery module came to be a fork
 * waiting to happen (promoted 2026-09-09, Jeff).
 *
 * Merged on 2026-09-10 (Jeff), after the same merge was made on the cabinet's bay panel:
 * the rank at the top of the card and the reason under it were one fact split in two, and
 * the split cost a reader a glance between them. So **a faulted junction box, battery
 * module, SSU and rectifier are now marked identically**, which is what the promotion was
 * for. The two racks differ in nothing about the mark now.
 *
 * ## The boxes with nothing watching them
 *
 * At SBH-1336 this draws **seven** cards and the site's monitoring unit has **four**
 * `PV N Array Fault` registers, so three boxes have no row watching them. The gap comes
 * from keeping `kwp` at the modelled 28 rather than the surveyed 16.2 — recorded in
 * `systems.ts`, carried in `ArrayWiring.junctionBoxes`, and not fixable here.
 *
 * It is also not annotated per card, because it cannot be: the four rows index
 * conversion units, and no register anywhere says which strings land on which unit. So
 * the page does not put an unwatched marker on three arbitrary cards.
 */
export const JunctionBoxRack = ({
  system,
  boxes,
  reporting,
  standing,
  dark,
}: {
  system: SolarSystem;
  boxes: ReadonlyArray<JunctionBox>;
  /** Whether anybody has heard from the site — `false` blanks every figure. */
  reporting: boolean;
  /**
   * Every alarm the array is carrying, standing only — the page's single read of the
   * store, handed down so the marks here and the counts in band 1 cannot disagree.
   */
  standing: ReadonlyArray<AlarmView>;
  /** The `Dark` badge, or nothing. Built by the page so both layouts of this band place it. */
  dark: ReactNode;
}) => {
  const darkStrings = boxes.reduce((sum, box) => sum + (box.strings - box.liveStrings), 0);
  /* `?? 2` is unreachable — this component is only drawn where `wiring` is set, which
     is what produced `boxes` in the first place. It is here because the alternative is
     a non-null assertion, and an assertion that is right today is a crash the day the
     band gains a second caller. Two is the surveyed figure, so the fallback is the
     truth about every roof anybody has counted rather than a placeholder. */
  const panelsPerString = system.wiring?.panelsPerString ?? 2;
  const faults = faultedBoxes(standing);

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {/* The array's own total, still the band's headline.

            It is here rather than gone because it is the one figure in the band that
            is **measured**, and the seven under it are made from it. Losing it to the
            breakdown would have left the page with no reading a register could confirm
            — and a reader who wants the array, not the boxes, would have had to add
            seven cards up. They do add up: see `shareTenths`.

            `flex-wrap` so the heading, the figure and the `Dark` badge fall onto their
            own lines on a phone rather than squeezing the figure. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {/* Named for what the grid is rather than for the band, which the wrapping
              `<section>` already carries as `Generation now`. Two identical strings
              would have a screen reader announce the same words twice — once as the
              region, once as its heading — and the heading is the one that can afford
              to be specific. */}
          <h2 className="text-sm font-medium text-primary">
            Generation by solar junction box (SJB)
          </h2>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="flex items-baseline gap-0.5">
              <span className="sr-only">Array generation</span>
              <span
                className={cn(
                  'text-lg leading-7 font-semibold',
                  reporting && system.outputKw > 0 ? 'text-primary' : 'text-tertiary',
                )}
              >
                {reporting ? system.outputKw.toFixed(1) : '—'}
              </span>
              {reporting && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    system.outputKw > 0 ? 'text-primary' : 'text-tertiary',
                  )}
                >
                  kW
                </span>
              )}
            </p>
            {dark}
          </div>
        </div>

        {/* What is *missing* from the cards, and nothing else — so on an array with
            every string live this band now has no caption at all.

            It carried two more sentences and Jeff removed them (2026-09-09): the
            array's make-up, and a line saying that nothing meters a junction box, so
            every figure below is a share rather than a reading.

            The make-up is no loss. `ArrayEquipment` on the Devices tab states the
            strings, the boxes and the `PVDU80A` as rows of their own, so this was a
            second copy of three facts that already live where they belong.

            **The disclaimer is a real loss**, recorded here rather than quietly
            dropped. This component's own note argues that without it a reader takes
            seven kilowatt figures for seven measurements, and that argument has not
            stopped being true — it is now made only to whoever reads the source. What
            partly covers it is that `Current generation` names each figure as that
            box's own output instead of leaving a bare number on a card, and that the
            band's total above is the one measured reading. If the line is ever wanted
            back, a tooltip on the heading would carry it without returning a paragraph
            of grey to the page; `junctionBoxes.ts` holds the full reasoning.

            `strings are` / `string is` rather than the `plural` helper, because the
            verb has to move with the noun — and one dark string is a real state, which
            `SWK-0559` reaches the day two of its three come back.

            It used to end `spread a box at a time`, and that clause came off when the
            registers began placing dark strings (2026-09-09): the ones a `PV N Array
            Fault` names sit *in* those boxes and are not spread at all, so the sentence
            was describing only half of them. Nothing replaced it, because the cards
            below now answer `where` themselves — the short boxes are the ones reading
            `3 of 4`, and the marked ones are the ones with a chip. */}
        {darkStrings > 0 && (
          <p className="max-w-prose text-xs text-tertiary">
            {`${darkStrings} of ${system.strings} ${darkStrings === 1 ? 'string is' : 'strings are'} not delivering.`}
          </p>
        )}
      </div>

      {/* **Five cards to a row**, which is Jeff's (2026-09-09) and is a cap rather
          than a count: seven boxes fall 5 + 2, eight fall 5 + 3.

          It keys off a **container query** rather than a breakpoint, which is what
          `DetailBand` and `MetricStrip` already do on these pages and for the reason
          `DetailBand` states — the band sits inside two rails that take 480px between
          them, so "a `md:` split would fire at 768px, where the band is 288px wide".
          `@container` measures the band, which is the only width that decides how many
          cards fit.

          It replaced `auto-fill,minmax(11rem,1fr)`, and the swap is not free:
          `auto-fill` guarantees a *minimum* card and lets the count float, while a
          fixed count guarantees the count and lets the card shrink. So every rung has
          to be checked against the widest row on the card — now `Capacity` beside
          `4.3 kWp`, about 120px plus `MetricRow`'s 16px gutter:

          - `@sm` (384px), 2 columns → 186px cards, 162px content ✓
          - `@2xl` (672px), 3 columns → 216px cards, 192px content ✓
          - `@4xl` (896px), 5 columns → 169px cards, 145px content ✓

          **Five is taken at `@4xl` rather than held back to `@5xl`, and that is the
          whole reason the card's rows were shortened.** A laptop puts this band at
          about 1000px — 1512px of screen less the two rails' 480px and the page's
          padding — which is *under* `@5xl`'s 1024px. Waiting for `@5xl` would have
          shown four cards on the machine the instruction was given from, which is the
          sort of near-miss that reads as the instruction having been ignored.
          Shortening the rows made five fit from 896px instead, so it holds across
          every width a reader is likely to have. */}
      <ul className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5">
        {boxes.map((box) => {
          const carrying = box.outputKw !== null && box.outputKw > 0;
          /* The device's claim about this box, live. Cleared on the Alarms tab means
             gone from `standing`, so the mark comes off on the way back. */
          const fault = faults.get(box.index);
          const meta = fault === undefined ? undefined : SEVERITY_META[fault.severity];

          return (
            <li
              key={box.id}
              className={cn(
                'flex flex-col gap-2.5 rounded-md border p-3',
                /* The edge and tint the shelf's bays and the bank's modules already
                   take for an asserted register, read from the same `SEVERITY_META`, so
                   one severity is one colour across all four drawings in this app. Every
                   `PV N Array Fault` on the estate is `MA` and comes out critical, which
                   makes this red today — but the rank is read rather than assumed, so a
                   row the register map ever downgrades changes colour here without a
                   second edit. */
                meta === undefined
                  ? 'border-subtle bg-element'
                  : cn(meta.edgeClassName, meta.tintClassName),
              )}
            >
              {/* The box's name, and **the severity in the corner opposite it** where a
                  register is asserting one — the shape the battery module cards already
                  had, which is what Jeff asked this card to match (2026-09-09).

                  **Nothing sits opposite the label any more.** A `Critical` badge did,
                  and the argument for it was that the chip below said *which register*
                  while the badge said *how bad* — two questions, two elements, and hue
                  alone says nothing for `NEUTRAL`, whose edge and tint are deliberately
                  achromatic.

                  That argument is answered rather than abandoned: `AlarmPill` below now
                  carries the rank **and** the register in one pill, so the rank is still
                  in words and `NEUTRAL` still reads. What went is the split, not the
                  fact. `flex-wrap` stays as the guard for a label one character longer
                  than any on this estate.

                  A `not reported` note sat opposite the label on the boxes past the
                  last conversion unit, in the `SubrackRack` idiom, and Jeff removed it
                  (2026-09-09). **The consequence is that an unwatched box now looks
                  like a clear one**, which is worth stating plainly because it is the
                  one thing this band no longer says: SBH-1336 has four `PV N Array
                  Fault` registers and seven boxes, so SJB 5–7 have nothing looking at
                  them and read exactly as SJB 2 and SJB 3 do. See the note at the top
                  of this file for why those three boxes exist and what makes the gap
                  close. */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-sm font-medium whitespace-nowrap text-secondary">
                  {box.label}
                </span>
              </div>

              {/* **The register behind the mark, as a chip under the box's name** — Jeff's
                  (2026-09-09), shaped after the Alarms tab's own severity filters.

                  Where the mark has been, in order: the raw register name at the card's
                  *foot* in `text-xs text-secondary`, which was camouflaged — the same grey
                  as the four metric labels above it, one step smaller, last in reading
                  order, so the one exceptional thing on the card read as a fifth metric row
                  whose value had gone missing. Then a full-bleed tinted band, first across
                  the card's top edge and then a row lower so `SJB 1` stayed first. Now a
                  chip in the same place the band was.

                  `AlarmPill` carries the whole argument for the shape — why the rank
                  leads the register, why the entire pill takes the severity's colour
                  rather than colouring the glyph and greying the name, and why it wraps
                  here while the detail panels let it cut. It is shared with `ModuleRack`
                  and both cabinet panels, which is what stopped this from being one idiom
                  drawn four ways.

                  ## What still marks the card, and why the chip can be quiet

                  The card keeps `edgeClassName` and `tintClassName` — Jeff's call when the
                  chip went in, and the right one. The chip is a neutral surface with one
                  coloured glyph, so on its own it would be a *quieter* mark than the band
                  it replaced; the edge and the tint are what a reader scanning seven cards
                  actually catches, and the chip is what tells them which register once
                  they have stopped. Two jobs, two elements, neither doing the other's.

                  ## Why the badge above it stays

                  The chip was briefly the card's only mark, on the argument that it names
                  the register and the card is already the severity's colour, so a
                  `Critical` badge opposite the label was a second mark twenty pixels away
                  saying strictly less.

                  That was wrong twice over, and Jeff put the badge back the same day
                  (2026-09-09). The two are not one mark drawn twice: the badge answers
                  *how bad* and the chip answers *which register*, and dropping either
                  leaves the other doing a job it is not shaped for. And the severity was
                  left to a **hue** — which `severityMeta.ts` warns about directly, because
                  `NEUTRAL`'s edge and tint are deliberately achromatic, so a neutral box
                  would have shown a grey chip with nothing at all ranking it. Every
                  `PV N Array Fault` on this estate is `MA` and comes out critical, so the
                  gap was invisible today and would have opened the first time one was
                  re-ranked.

                  ## What the position costs

                  A marked card runs **38px** taller than its neighbours — the chip's 24px,
                  the card's `gap-2.5`, and 4px more on the name row where the badge is
                  taller than the label beside it — so `Current generation` and the kW figures sit
                  that much lower and no longer read straight across the row. Comparing
                  those figures box to box is why this band replaced a dial, so the loss is
                  real; it is the price of putting the fault above the figures rather than
                  below them, and it was taken knowingly. Moving the chip back under the
                  metric rows is a two-line move of this block. */}
              {fault !== undefined && (
                <AlarmPill
                  fault={fault}
                  to="/solar/$systemId/alarms"
                  params={{systemId: system.id}}
                  wrap
                />
              )}

              {/* `Current generation` **over** its figure rather than beside it, and the
                  stacking is forced by the five-card cap on the grid.

                  Jeff asked for the label and then the value (2026-09-09), replacing a
                  fill bar that sat here. As another `MetricRow` it would not fit: the
                  label alone runs about 127px and the figure 45px, so the row wants
                  188px of content against the 166px a five-across card has on a laptop.
                  `MetricRow` truncates the label to resolve that, and
                  `Current generatio…` is worse than either arrangement. Stacked, the
                  label has the whole card width and the figure reads as a figure.

                  The headline number that used to sit here went with the bar rather
                  than surviving it, because this label **names** it — keeping both would
                  print `2.4 kW` twice on a card 190px wide, and a live figure printed
                  twice is two things to keep in step.

                  ⚠️ **This figure does not drop when the box is marked, and that is
                  correct.** The kilowatts are the array's measured output shared by live
                  strings; the mark is a register on the monitoring unit. They are two
                  sources and the model has no wire between them, so a box can read
                  2.4 kW with `PV 1 Array Fault` standing. That combination is not a
                  contradiction the page should hide — it is the case `plantAlarms.ts`
                  says the register exists to expose, "the only register in the poll set
                  that separates cloud from a string being gone".

                  An em dash rather than `0.0` where nobody has heard from the site:
                  zero says the box made nothing, and what is known is that nobody heard
                  it. At night zero is correct, and the badge in the header says why. */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-secondary">Current generation</span>
                <p className="flex items-baseline gap-0.5">
                  <span
                    className={cn(
                      'text-lg leading-7 font-semibold',
                      carrying ? 'text-primary' : 'text-tertiary',
                    )}
                  >
                    {box.outputKw === null ? '—' : box.outputKw.toFixed(1)}
                  </span>
                  {box.outputKw !== null && (
                    <span
                      className={cn(
                        'text-xs font-medium',
                        carrying ? 'text-primary' : 'text-tertiary',
                      )}
                    >
                      kW
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                {/* `Strings 4` and `Panels 8` rather than one `Strings · 4 × 2 panels`
                    row, and the split is what makes five cards to a row possible at a
                    real band width.

                    `Strings` beside `4 × 2 panels` comes to about 178px once
                    `MetricRow`'s 16px gutter is counted, and a five-across card on a
                    1000px band has 166px of content. `MetricRow` resolves that by
                    truncating the *label*, so the row would have read `String…` — and
                    it would have read it on the maintainer's own screen rather than at
                    some contrived width. Two short rows put the widest row at about
                    136px, which fits from `@4xl` up.

                    It is also the better pair of facts. `8` is this box's panel count,
                    which is the unit the survey was taken in — thirty panels, two to a
                    string, four strings to a box — so the cards now sum to the array's
                    panel count as well as its strings. */}
                <MetricRow label="Strings" value={`${box.strings}`} />
                <MetricRow label="Panels" value={`${box.strings * panelsPerString}`} />
                {/* `3 of 4` in the ordinary grey, with no mark on the card — see the
                    note at the top of this file on why a box short of strings is not
                    flagged where a box with an asserted register is. Printed at every
                    box rather than only the short ones, so the cards keep one height
                    and a full box states its own completeness instead of leaving a
                    reader to infer it from a missing row. */}
                <MetricRow label="Delivering" value={`${box.liveStrings} of ${box.strings}`} />
                <MetricRow label="Capacity" value={amount(box.capacityKwp, 'kWp', 1)} />
              </div>

            </li>
          );
        })}
      </ul>
    </div>
  );
};
