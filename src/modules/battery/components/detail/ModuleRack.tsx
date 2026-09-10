import {TriangleAlertIcon} from 'lucide-react';

import {AlarmPill} from '@/components/global/AlarmPill';
import {BatteryGlyph} from '@/components/global/BatteryGlyph';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {
  IMBALANCE_POINTS,
  bankModules,
  faultedModules,
  moduleChargeRange,
  moduleTempRange,
} from '../../data/modules';
import {bankFlow} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';
import type {BatteryModule} from '../../types/module.type';

/**
 * The bank opened up: one card per module, each carrying the four figures a module
 * has — what it is holding, how much of it is left, how warm it is running, and how
 * much energy that adds up to.
 *
 * ## Why it is a band of its own now
 *
 * It used to be a strip of 44px tiles sitting to the **right** of the hero glyph,
 * each tile a battery, a label and a percentage. That arrangement was built around
 * one figure per module and it cannot hold four: a card with four figures needs
 * about 160px, and there are only two of those beside the pack once the app's rail
 * and the section's have taken their 334px. Thirteen modules would have become a
 * seven-row scrolling column next to the hero battery — the same content, read
 * through a letterbox.
 *
 * So the pack keeps `Charge now` to itself and the rack takes the full width under
 * it, five or six cards across. What that costs is the old layout's one real
 * argument: side by side, the pack and the rack were a single statement, and a
 * reader's eye went from the big battery to the small ones without crossing a rule.
 * What buys it back is that the card is still the same picture — the same glyph, the
 * same big percentage beside it, at a third of the size — so the relationship is
 * carried by the shape repeating rather than by the two being adjacent. It is also
 * directly under the pack rather than off to one side, which is the next best thing
 * to beside it.
 *
 * ## Why the same glyph rather than a bar chart
 *
 * A row of thirteen bars would compare the modules more precisely, and it would lose
 * the thing that matters more: that these *are* the battery above them. Repeating
 * the shape is what makes the relationship legible without a word of caption — the
 * pack is the modules, and the modules are little packs. The precision the bars
 * would have bought is on each card in figures anyway, three more of them than the
 * bars could have carried.
 *
 * Which is why the cards moved to `BatteryGlyph` with the hero rather than after it.
 * The pack became a horizontal battery with a continuous bar; a rack of vertical
 * segmented tanks under it would have left the page carrying two battery shapes and
 * broken the one relationship this band is drawn to show.
 *
 * `sm` rather than the hero's `lg`, and it carries the charging bolt like the hero
 * does — which is what took `sm` from 34 × 18 to 44 × 22, since a bolt inside an 18px
 * body is a speck. The direction is the **pack's**, because a module has none of its
 * own: `charging` is read once from `bankFlow` and handed to all thirteen, so the rack
 * cannot disagree with the battery above it.
 *
 * ## Why charge is the headline and the other three are rows
 *
 * Charge is what the page is for — *will this last the night* — so it gets the
 * glyph and the large figure, exactly as the pack does. Health, temperature and
 * stored energy are what a reader consults **once a module has caught their eye**,
 * and they read as a specification block rather than as three more headlines. They
 * are `MetricRow`, the same label-left value-right pair the details band at the foot
 * of this page is built from, so the eye already knows how to read them.
 *
 * The three are in that order for a reason. Health explains the charge — a module
 * three points under the pack is a fact, and a module three points under *and* four
 * points down on health is a module to quote for. Temperature corroborates both.
 * Stored energy is the arithmetic, and it goes last because it is the one figure a
 * reader can derive from the two above it.
 *
 * ## Why a wrapping grid with a ceiling on it
 *
 * Every bank on this estate is seven to eighteen modules and lays out in two or
 * three rows. But `banks.ts` divides the same module into whatever a site needs, and
 * an estate whose loads run to 248 kW against a tower's 5 would put *hundreds* here.
 * Neither a single row nor a grid with a fixed *height* survives both, so the cards wrap
 * — five to a row at most, the ladder the junction box rack uses — and the rack takes a
 * maximum height with its own scroll. Every module is still drawn: capping the
 * count and printing "showing 24 of 970" would be picking twenty-four modules to
 * care about, and nothing about a rack makes the first twenty-four the interesting
 * ones.
 *
 * The scroll never appears on the estate the design was drawn for; it is what stops
 * the other estate from pushing the chart below it off the screen.
 *
 * ## Two marks, and the fill is what tells them apart
 *
 * A card can carry two completely different claims and they must not look alike:
 *
 * - **`Lithium Battery 4 Abnormal` is standing.** The module's own BMS reports a
 *   problem with itself, on a register the site's monitoring unit polls. A *reported*
 *   fact. The card takes an edge, a fill **and its `AlarmPill`** from the row's own
 *   severity — red and `Critical` for what every module row on this estate is, amber
 *   and `Warning` a rank down, and the achromatic grey `Neutral` for a note. All three
 *   come out of one `SEVERITY_META` entry, so nothing on the card can disagree with
 *   anything else on it about how bad the row is.
 * - **The module is `IMBALANCE_POINTS` or more under the pack.** This app's own
 *   arithmetic over figures it derived. It has no alarm and therefore no severity, so
 *   it stays amber, takes the **edge** only, and keeps the plain `element` surface it
 *   always had.
 *
 * Two rules say the same thing twice on purpose. **Hue**: red means a device reported
 * it, amber means this app worked it out. **Fill**: a filled card is reported, an
 * outlined one derived. Either alone would do it today — but hue alone fails the day
 * a module row arrives at `WARNING` severity, when both marks would be amber and only
 * the fill still separates them, and fill alone is what was here before and drew a
 * critical fault in the warning colour.
 *
 * The estate proves the two are worth separating rather than merging. At SWK-0559 the
 * faulted module is `M12` at 70.1% against a 66.5% pack — the **fullest module in the
 * rack**, and permanently so: the per-module offsets are fixed and the pack's charge
 * only shifts all thirteen together, so no hour of the day makes `M12` look like the
 * problem it is. The BMS is asserting a fault on the one module this file's own spread
 * is most confident about. A single mark covering both claims would have had to pick
 * which of those two facts to report, and either choice loses the other.
 *
 * Both are drawn when both apply, fault first. Nothing on this estate is currently
 * both — all four banks with a unit are 93–96% health, so no module is five points
 * down — and it is a tired bank away from happening.
 */

/** `57%` from `0.57` — the unit every percentage on the card is printed in. */
const percent = (fraction: number): number => Math.round(fraction * 100);

/**
 * What a card says about itself when it is not just another module.
 *
 * Two intensities of one mark, and the difference between them is the whole of the
 * decision. **`lowest`** is a neutral note: some module has to be last, and naming
 * it saves a reader comparing thirteen numbers to find out which. **`8 pts low`** is
 * a finding — that module is `IMBALANCE_POINTS` or more under the pack — and it
 * takes the warning colour and a coloured card edge with it.
 *
 * The lowest module of a healthy rack gets the neutral note and nothing else. That
 * is deliberate: a 55–61% pack at 93% health is a pack in good order, and marking
 * its last module as a problem would light a warning on every bank on the estate.
 * `IMBALANCE_POINTS` carries the argument about where the line sits.
 *
 * `undefined` for every other module, so a rack of thirteen carries one mark and not
 * thirteen.
 */
type ModuleNote = {text: string; flagged: boolean} | undefined;

const noteFor = (module: BatteryModule, bank: BatteryBank, lowestId: string): ModuleNote => {
  const shortfall = percent(bank.soc - module.soc);
  if (shortfall >= IMBALANCE_POINTS) return {text: `${shortfall} pts low`, flagged: true};

  return module.id === lowestId ? {text: 'lowest', flagged: false} : undefined;
};

/**
 * A faulted module's mark is **one `AlarmPill`** directly under its label — the rank and
 * the register together, in the row's own severity colour, linking to the Alarms tab.
 * The same element the junction box cards and both cabinet panels draw.
 *
 * ## How it got here, because each step answered the last one's failure
 *
 * A bare `<Link>` with the raw register name at the card's foot in
 * `text-xs text-secondary`, byte-identical to a copy in `JunctionBoxRack`. Both were
 * camouflaged for the same reason: that grey is the grey of the `Health` / `Temp` /
 * `Stored` labels stacked above it, one step smaller and last in reading order, so the
 * one exceptional thing on the card read as a metric row with its value missing.
 *
 * Then the shared `FaultChip` under the label, plus a `FaultBadge` in the top-right
 * corner naming the rank (2026-09-09, Jeff) — which fixed the camouflage and left the
 * mark **split in two**, `how bad` in one corner and `which register` in the other.
 *
 * Then one pill carrying both (2026-09-10, Jeff), after the same merge landed on the
 * cabinet's bay panel. `FaultChip` and `FaultBadge` had no callers left and were deleted.
 *
 * ## The two arguments that survived every step
 *
 * **The label is the string the gateway publishes, exactly** — `Lithium Battery 4
 * Abnormal` — because that is what the Alarms tab lists and what history is keyed on.
 *
 * **It wraps rather than cuts.** That one reversed: the chip truncated, because a grid
 * row is as tall as its tallest card and a wrapped name deepens every card beside it. A
 * 10rem card cuts `Lithium Battery 4 Abnormal` at any size, and with the rank now in
 * front of it there is less room again — so cutting stopped being the occasional cost
 * and became the normal case. Jeff took the extra line instead. `AlarmPill`'s `wrap`
 * prop carries the trade; the detail panels are wide enough not to need it.
 */

export const ModuleRack = ({bank}: {bank: BatteryBank}) => {
  const modules = bankModules(bank);
  const charge = moduleChargeRange(modules);
  const temperature = moduleTempRange(modules);

  /**
   * Live, exactly as the shelf's bays are: clearing `Lithium Battery 4 Abnormal` on
   * this bank's Alarms tab unmarks `M04` on the way back, because the mark and the row
   * are one alarm rather than a copy of it. The role is read for the same reason
   * `assertedPlantAlarms` takes one — the catalogue a site publishes moves with how it
   * is fed — and a bank's id is its site's, so no lookup stands between them.
   */
  const handling = useAlarmHandling();
  const role = useSitePowerRole(bank.id);
  const faults = faultedModules(bank, role, handling);

  /**
   * The pack's direction, handed to all of its modules.
   *
   * A module has no direction of its own and should not look as though it might: the
   * bus decides where the energy goes, so every module in a rack takes charge when the
   * pack does. Read from `bankFlow` — the same function the badge under the hero glyph
   * reads — so the thirteen little batteries and the big one cannot disagree about
   * whether anything is charging.
   */
  const charging = bankFlow(bank) === 'CHARGING';

  // The rack is in slot order, so the lowest module has to be found rather than
  // read off an end — see `modules.ts` on why it is not sorted.
  const lowest = modules.reduce((low, module) => (module.soc < low.soc ? module : low));

  return (
    <section aria-label="Battery modules" className="@container flex flex-col gap-3 py-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-medium text-primary">The modules</h2>
        {/* What the cards cannot say at a glance, in one line.

            A standing module fault leads where there is one, because it is the only
            clause here that somebody has to *do* something about — and because a
            reader arriving at this band should not have to find the lit card in a
            rack of thirteen to learn there is one. It is drawn only when it applies;
            see its own note below.

            The charge range leads otherwise, because it is the reason the rack is
            drawn and the only thing here the page does not say elsewhere: `55–61%`
            under a bank reading 57 is a pack in balance, and `38–68%` under the same
            57 is a module about to be replaced. The temperature range follows it for
            the same reason — three degrees across a cabinet is airflow, nine is a
            finding — and it also tells a reader what the `Temp` rows are to be read
            against, which no single card can.

            The count and the module size come last rather than open the line. They
            are the `Number of modules` row of the details band at the foot of the
            page, and repeating them is deliberate — a reader looking at a card
            should not have to scroll past a chart to find out what one card is — but
            they are the part already answered, so they go third. */}
        <p className="text-xs text-tertiary">
          {/* The finding leads, in the same amber the cards below it are marked in —
              which is what joins the sentence to the lit card a reader then goes
              looking for. It is a clause rather than a permanent column, so it cannot
              become chrome: **there is no zero state.** A rack with nothing faulted
              simply opens with its ranges, because the three banks on this estate with
              no monitoring unit would otherwise read `0 modules faulted` — nothing
              watching, presented as nothing wrong, which is the one failure this app's
              whole alarm model is designed against. `BankAlarms` says which of the two
              zeros this bank's is, at length, one tab across.

              Plural-safe though `groupOf` files all thirteen module addresses as one
              group, so at most one module row can stand and the count is always one
              today. That grouping is `assertedAlarms`' business and not this line's to
              depend on. */}
          {faults.size > 0 && (
            <span className="text-severity-warning">
              {`${faults.size} module${faults.size === 1 ? '' : 's'} faulted · `}
            </span>
          )}
          {`${percent(charge.low)}–${percent(charge.high)}% across the rack · ${temperature.low.toFixed(1)}–${temperature.high.toFixed(1)} °C · ${bank.modules.toLocaleString('en-MY')} modules of ${bank.moduleKwh} kWh`}
        </p>
      </div>

      {/* **Five cards to a row at most**, which is Jeff's (2026-09-09) and is the same
          ladder `JunctionBoxRack` climbs — so a rack of modules and a rack of junction
          boxes break into rows the same way on two pages of one app.

          It replaced `auto-fill` at a `minmax(10rem,1fr)`, and the argument for that is
          worth keeping because half of it still holds: the band sits inside two rails
          whose width the viewport does not describe, so the number of cards that fit is
          a fact about *this container* and nothing else. Container queries answer that
          more directly than `auto-fill` did — they measure the same box — which is why
          this is a swap of mechanism and not a retreat to a breakpoint. A `md:` split
          would fire at 768px, where the band is 288px wide.

          What the swap costs: `auto-fill` guaranteed a **minimum card** and let the
          count float, where a fixed count guarantees the **count** and lets the card
          shrink. So the 10rem floor — where `Stored ──── 4.09 kWh` stops truncating —
          has to be checked at every rung rather than declared, and it holds at all of
          them: 2 columns from 384px is 186px, 3 from 672px is 216px, and 5 from 896px
          is 169px. Five is taken at `@4xl` rather than `@5xl` for the reason the solar
          rack states — a laptop puts this band at about 1000px, which is *under*
          `@5xl`, so holding five back would show four on the machine the instruction
          came from.

          `max-h-[48rem]` and the scroll stay, and they are the other half of the
          original note. Every bank on this estate is seven to eighteen modules, which
          is four rows or fewer at five columns, so the ceiling is invisible here. It
          does its work in the two places it is needed: a phone, where eighteen cards in
          one column would put 3,000px between the pack and the chart, and the estate
          whose loads run to 248 kW and would put *hundreds* of modules in this grid. */}
      <ul className="grid max-h-[48rem] grid-cols-1 gap-3 overflow-y-auto @sm:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5">
        {modules.map((module, index) => {
          const note = noteFor(module, bank, lowest.id);
          /* Keyed on the slot, not the id: the row's label counts modules from one
             (`Lithium Battery 4 Abnormal`) and this rack indexes from zero, and the
             card's own `M04` is that same one-based number padded. */
          const fault = faults.get(index + 1);

          return (
            <li
              key={module.id}
              className={cn(
                'flex flex-col gap-2.5 rounded-md border p-3',
                // Three states, not two — the doc at the top of this file argues why.
                // A reported fault takes its **row's** edge and a tint; the derived
                // imbalance takes an amber edge and no tint, because it has no row and
                // therefore no severity to read. Fault wins the surface where both
                // apply, and the imbalance still says itself in the badge row below.
                fault !== undefined
                  ? cn(
                      SEVERITY_META[fault.severity].edgeClassName,
                      SEVERITY_META[fault.severity].tintClassName,
                    )
                  : note?.flagged === true
                    ? 'border-severity-warning/40 bg-element'
                    : 'border-subtle bg-element',
              )}
            >
              {/* Wrapping, and `items-start` with it. Both marks together are about
                  170px of badge against a card whose minimum is 160px, so the second
                  drops to its own line rather than squeezing `M04` — which is the one
                  thing on the card a person at the cabinet door is using. It costs a
                  row of height on a card that is already the tallest in the rack, and
                  only on the rack where both fire. */}
              <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-secondary">{module.label}</span>

                <span className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                  {note !== undefined &&
                    (note.flagged ? (
                      <Badge variant="secondary" className="gap-1">
                        <TriangleAlertIcon className="text-severity-warning" aria-hidden="true" />
                        <span className="text-severity-warning">{note.text}</span>
                      </Badge>
                    ) : (
                      // Not a badge. A pill is how this app draws a state worth
                      // acting on, and `lowest` is a signpost — giving it the same
                      // silhouette as the finding beside it would make the two read
                      // as one severity at two wordings.
                      <span className="text-xs text-tertiary">{note.text}</span>
                    ))}
                </span>
              </div>

              {/* Directly under the module's label, ahead of its figures — the position
                  `JunctionBoxRack` puts the same chip in, so the two racks read the same
                  way. It was under the figures before, on the argument that the register
                  is the answer to *why* and the figures the answer to *how bad*, so a
                  reader who had already decided to act was the one who wanted it. What
                  overrode that is that nobody was finding it at all: last in reading order
                  and dressed as a metric label, it was a fifth row with no value. */}
              {fault !== undefined && (
                <AlarmPill
                  fault={fault}
                  to="/battery/$bankId/alarms"
                  params={{bankId: bank.id}}
                  wrap
                />
              )}

              <div className="flex items-center gap-2.5">
                <BatteryGlyph
                  fraction={module.soc}
                  size="sm"
                  charging={charging}
                  // The glyph carries the whole reading because the figure beside it
                  // is `aria-hidden` — read on its own, "60 %" is a number with no
                  // subject, exactly as it is beside the pack above.
                  label={`${module.label}: ${percent(module.soc)}% charged`}
                />

                <p aria-hidden="true" className="flex items-baseline gap-0.5">
                  <span className="text-lg leading-7 font-semibold text-primary">
                    {percent(module.soc)}
                  </span>
                  <span className="text-xs font-medium text-primary">%</span>
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <MetricRow label="Health" value={`${percent(module.soh)}%`} />
                <MetricRow label="Temp" value={`${module.tempC.toFixed(1)} °C`} />
                <MetricRow label="Stored" value={`${module.storedKwh.toFixed(2)} kWh`} />
              </div>

            </li>
          );
        })}
      </ul>
    </section>
  );
};
