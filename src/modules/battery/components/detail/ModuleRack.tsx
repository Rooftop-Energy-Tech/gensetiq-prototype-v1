import {TriangleAlertIcon} from 'lucide-react';

import {TankGlyph} from '@/components/global/TankGlyph';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {
  IMBALANCE_POINTS,
  bankModules,
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

export const ModuleRack = ({bank}: {bank: BatteryBank}) => {
  const modules = bankModules(bank);
  const charge = moduleChargeRange(modules);
  const temperature = moduleTempRange(modules);

  // The rack is in slot order, so the lowest module has to be found rather than
  // read off an end — see `modules.ts` on why it is not sorted.
  const lowest = modules.reduce((low, module) => (module.soc < low.soc ? module : low));

  return (
    <section aria-label="Battery modules" className="flex flex-col gap-3 py-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-medium text-primary">The modules</h2>
        {/* What the cards cannot say at a glance, in one line.

            The charge range leads, because it is the reason the rack is drawn and
            the only thing here the page does not say elsewhere: `55–61%` under a
            bank reading 57 is a pack in balance, and `38–68%` under the same 57 is a
            module about to be replaced. The temperature range follows it for the
            same reason — three degrees across a cabinet is airflow, nine is a
            finding — and it also tells a reader what the `Temp` rows are to be read
            against, which no single card can.

            The count and the module size come last rather than open the line. They
            are the `Number of modules` row of the details band at the foot of the
            page, and repeating them is deliberate — a reader looking at a card
            should not have to scroll past a chart to find out what one card is — but
            they are the part already answered, so they go third. */}
        <p className="text-xs text-tertiary">
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
        {modules.map((module) => {
          const note = noteFor(module, bank, lowest.id);

          return (
            <li
              key={module.id}
              className={cn(
                'flex flex-col gap-2.5 rounded-md border bg-element p-3',
                note?.flagged === true ? 'border-severity-warning/40' : 'border-subtle',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-secondary">{module.label}</span>

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
            </li>
          );
        })}
      </ul>
    </section>
  );
};
