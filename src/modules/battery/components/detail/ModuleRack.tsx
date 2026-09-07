import {TankGlyph} from '@/components/global/TankGlyph';
import {bankModules, moduleChargeRange} from '../../data/modules';
import type {BatteryBank} from '../../types/bank.type';

/**
 * The bank opened up: one tile per module, each drawn as the same battery the
 * hero glyph is, at a third of the size.
 *
 * It sits to the **right** of that hero glyph and it is the same picture at the
 * next level down — which is the whole argument for the layout. A reader's eye goes
 * to the big battery for the pack's answer, then straight across to see whether the
 * modules behind it agree with each other. Underneath it, or in a band of its own,
 * the two would be readings taken at different times as far as the page is
 * concerned; side by side they are one statement.
 *
 * ## Why the same glyph rather than a bar chart
 *
 * A row of twelve bars would compare the modules more precisely, and it would lose
 * the thing that matters more: that these *are* the battery on the left. Repeating
 * the shape is what makes the relationship legible without a word of caption — the
 * pack is the modules, and the modules are little packs. The precision the bars
 * would have bought is on each tile in figures anyway.
 *
 * Six segments rather than the hero's eight, per `TankGlyph`'s note on `sm`: at
 * 26px wide, eight bars merge into a block. It costs nothing here because the tile
 * prints its own percentage.
 *
 * ## Why a wrapping grid with a ceiling on it
 *
 * A CelcomDigi bank is six to twenty modules and lays out in a row or two. An SESB
 * bank is *hundreds* — its loads run to 248 kW against a tower's 5, and
 * `banks.ts` divides the same 5.12 kWh module into it. Neither the row nor a
 * fixed grid survives both, so the tiles wrap and the rack takes a maximum height
 * with its own scroll. Every module is still drawn: capping the count and printing
 * "showing 24 of 970" would be picking twenty-four modules to care about, and
 * nothing about a rack makes the first twenty-four the interesting ones.
 *
 * The scroll never appears on the estate the design was drawn for; it is what stops
 * the other estate from pushing the chart below it off the screen.
 */
export const ModuleRack = ({bank}: {bank: BatteryBank}) => {
  const modules = bankModules(bank);
  const {low, high} = moduleChargeRange(modules);
  const percent = (soc: number): number => Math.round(soc * 100);

  return (
    <section aria-label="Battery modules" className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex max-h-[248px] flex-wrap gap-x-3 gap-y-4 overflow-y-auto">
        {modules.map((module) => (
          <div key={module.id} className="flex w-11 shrink-0 flex-col items-center gap-1">
            <TankGlyph
              fraction={module.soc}
              tone="battery"
              size="sm"
              // The glyph carries the label because the two lines under it are the
              // only text on the tile, and read on their own — "M03", "62%" — they
              // are a heading and an orphan rather than a reading.
              label={`${module.label}: ${percent(module.soc)}% charged`}
            />
            <span aria-hidden="true" className="text-[10px] leading-4 text-secondary">
              {module.label}
            </span>
            <span aria-hidden="true" className="text-xs font-medium text-primary">
              {percent(module.soc)}%
            </span>
          </div>
        ))}
      </div>

      {/* What the tiles cannot say at a glance, in one line.

          The range leads, because it is the reason the rack is drawn and the only
          thing here the page does not say elsewhere: `57–65%` under a bank reading
          61 is a pack in balance, and `38–68%` under the same 61 is a module about
          to be replaced. It also stands in for sorting the tiles, which `modules.ts`
          declines to do so the labels stay in rack order.

          The count and the module size follow it rather than open the line. They are
          the `Number of modules` row of the details band at the foot of the page, and
          repeating them is deliberate — a reader looking at a tile should not have to
          scroll past a chart to find out what one tile is — but they are the part
          already answered, so they go second. */}
      <p className="text-xs text-secondary">
        {`${percent(low)}–${percent(high)}% across the rack · ${bank.modules.toLocaleString('en-MY')} modules of ${bank.moduleKwh} kWh`}
      </p>
    </section>
  );
};
