import {Link} from '@tanstack/react-router';
import {TriangleAlertIcon} from 'lucide-react';

import {TankGlyph} from '@/components/global/TankGlyph';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {
  IMBALANCE_POINTS,
  bankModules,
  faultedModules,
  moduleChargeRange,
  moduleTempRange,
} from '../../data/modules';
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
 * Six segments rather than the hero's eight, per `TankGlyph`'s note on `sm`: at
 * 26px wide, eight bars merge into a block. It costs nothing here because the card
 * prints its own percentage beside the glyph.
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
 * Neither a row nor a fixed grid survives both, so the cards wrap and the rack takes
 * a maximum height with its own scroll. Every module is still drawn: capping the
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
 *   fact. The card takes an edge, a fill **and its badge** from the row's own severity
 *   — red and `Critical` for what every module row on this estate is, amber and
 *   `Warning` a rank down, and the achromatic grey `Neutral` for a note. All three
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
 * The reported mark: the row's severity, in the row's own words and colour.
 *
 * It said `Fault` in flat amber at every severity, which was one word doing two jobs
 * badly — it named the *kind* of mark while the card's surface named the rank, so a
 * critical module and a neutral note carried identical pills and a reader had to read
 * the border to tell them apart. `Critical`, `Warning` and `Neutral` are the app's own
 * severity words, the same three the Alarms tab ranks the row by and the same
 * `SEVERITY_META` the surface is drawn from, so the pill and the card cannot disagree.
 *
 * `NEUTRAL` gets no hue, which is `SEVERITY_META`'s deliberate choice and not a gap: a
 * neutral alert is a note rather than a problem, and giving it one would put it on the
 * same footing as the two that are. It is still plainly a mark — the badge's own
 * surface, a glyph, and the card's grey edge and shade — just an achromatic one.
 */
const FaultBadge = ({severity}: {severity: AlertSeverity}) => {
  const meta = SEVERITY_META[severity];

  return (
    <Badge variant="secondary" className="gap-1">
      <TriangleAlertIcon className={meta.textClassName} aria-hidden="true" />
      <span className={meta.textClassName}>{meta.label}</span>
    </Badge>
  );
};

/**
 * The register behind the mark, linked to the tab that can act on it.
 *
 * The label the gateway publishes, exactly — `Lithium Battery 4 Abnormal` — because
 * that raw string is what the Alarms tab lists, what history is keyed on, and what a
 * reader is matching this card against. A card that tidied it to `Module 4 fault`
 * would name one alarm two ways across two tabs of one asset.
 *
 * It exists here because the rack has no detail panel. The shelf can afford to mark a
 * bay and let the card beside it name the row; a 10rem card in a wrapping grid is the
 * only surface this mark has, so the name and the navigation come with it. Truncated
 * rather than wrapped, with the whole string in the tooltip: two lines of register
 * name would make the faulted card taller than its neighbours and break the grid's
 * one useful property, which is that every module looks like every other until
 * something is wrong with it.
 */
const FaultRow = ({bankId, fault}: {bankId: string; fault: AlarmView}) => (
  <Link
    to="/battery/$bankId/alarms"
    params={{bankId}}
    title={fault.name}
    className="block min-w-0 truncate text-xs text-secondary underline-offset-2 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-outline"
  >
    {fault.name}
  </Link>
);

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

  // The rack is in slot order, so the lowest module has to be found rather than
  // read off an end — see `modules.ts` on why it is not sorted.
  const lowest = modules.reduce((low, module) => (module.soc < low.soc ? module : low));

  return (
    <section aria-label="Battery modules" className="flex flex-col gap-3 py-6">
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

      {/* `auto-fill` at a 10rem minimum rather than a column count: the band sits
          inside two rails whose width the viewport does not describe, so the number
          of cards that fit is a fact about this container and nothing else. 10rem is
          where `Stored ──── 4.09 kWh` stops truncating.

          48rem is about four rows of cards, which is every bank on this estate at
          five columns or more — so the ceiling is invisible on a desktop and does its
          work in the two places it is needed: a phone, where eighteen cards in one
          column would put 3,000px between the pack and the chart, and the estate that
          would put hundreds of modules here. */}
      <ul className="grid max-h-[48rem] grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3 overflow-y-auto">
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
                  {fault !== undefined && <FaultBadge severity={fault.severity} />}

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

              <div className="flex items-center gap-2.5">
                <TankGlyph
                  fraction={module.soc}
                  tone="battery"
                  size="sm"
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

              {/* Under the figures rather than beside the badge, because it is the
                  answer to *why* and the figures are the answer to *how bad* — and a
                  reader who has already decided to act on this card is the one who
                  wants the register. */}
              {fault !== undefined && <FaultRow bankId={bank.id} fault={fault} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
