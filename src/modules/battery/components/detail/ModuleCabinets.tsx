import {useState} from 'react';

import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {siteHasCabinet} from '@/modules/cabinet/data/shelf';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {
  IMBALANCE_POINTS,
  bankModules,
  faultedModules,
  moduleChargeRange,
  moduleTempRange,
} from '../../data/modules';
import {allSlots, moduleCabinets, moduleCabinetsFit} from '../../data/moduleCabinets';
import type {ModuleCabinet} from '../../types/moduleCabinet.type';
import type {BatteryBank} from '../../types/bank.type';
import {ModuleCabinetFigure} from './ModuleCabinetFigure';
import {ModuleRack} from './ModuleRack';
import {ModuleSlotPanel} from './ModuleSlotPanel';

/**
 * The modules band: the bank's cabinets drawn front-on, and whichever slot is
 * selected beside them.
 *
 * `SubrackShelf` in the bank's terms — a figure on the left, a panel on the right,
 * one `useState` between them and nothing else. That sameness is the point: a reader
 * who has clicked a bay on the cabinet page already knows how this works, and two
 * pages of one app sharing a shape is worth more than either having its own.
 *
 * Jeff asked for the cabinets and for this interaction, 2026-09-10.
 *
 * ## Why the cabinets, when the cards already drew every module
 *
 * `ModuleRack` answers *how are the modules doing* and cannot answer *which one do I
 * open*. Thirteen cards in a grid that reflows with the browser window have no
 * relationship to the metal — `M09` is first on a row at one width and last at
 * another, and a technician standing in front of two steel boxes has to pick a door
 * before any of the figures help.
 *
 * That is the same gap the cabinet page had before its elevation replaced its card
 * rack, and the answer is the same. The line-up also shows the one thing no card grid
 * ever could: the **spare slots** — how much more the site takes before another
 * cabinet has to be poured a pad.
 *
 * ## The fallback is not dead code
 *
 * `ModuleRack` is still rendered whenever `moduleCabinetsFit` says no, exactly as
 * `SubrackShelf` falls back to `SubrackRack`. The seven-slot `ESC330-D6` comes off
 * one survey of one telco tower; the utility brand's mini-grid banks run to 900
 * modules, which is 129 cabinets and an installation of a completely different kind.
 * Drawing those as a row of outdoor battery cabinets would trade a real question for
 * a wrong one.
 *
 * The grid brings its own heading, which is why that branch returns before this one
 * draws one.
 */
export const ModuleCabinets = ({bank}: {bank: BatteryBank}) => {
  /**
   * Live, the way the shelf's bays are: clearing `Lithium Battery 4 Abnormal` on this
   * bank's Alarms tab unmarks the slot on the way back and empties the panel's chip in
   * the same pass, because the mark and the row are one alarm rather than a copy of
   * it. The role is read for the reason `assertedPlantAlarms` takes one — the
   * catalogue a site publishes moves with how it is fed.
   */
  const handling = useAlarmHandling();
  const role = useSitePowerRole(bank.id);
  const faults = faultedModules(bank, role, handling);

  const modules = bankModules(bank);
  /* Whether there is an `ICC330` on this pad at all — the app's own answer, so the
     line-up cannot put a module in a cabinet the site page says is not there and the
     panel's link cannot lead to a page that does not exist. False at three of the
     seven banks on this estate. */
  const hasPower = siteHasCabinet(bank.siteId, role);
  const cabinets = moduleCabinets(modules, hasPower);
  const charge = moduleChargeRange(modules);
  const temperature = moduleTempRange(modules);

  /**
   * The modules this app's own arithmetic calls out, by id.
   *
   * Computed here and handed to the drawing rather than recomputed there, so the
   * amber edge in the line-up and the `pts low` badge in the panel are one finding.
   * `ModuleRack`'s `noteFor` makes the same comparison for the cards.
   */
  const flagged = new Set(
    modules
      .filter((module) => Math.round((bank.soc - module.soc) * 100) >= IMBALANCE_POINTS)
      .map((module) => module.id),
  );

  const [picked, setPicked] = useState<string | undefined>(undefined);
  const selected = picked ?? defaultSlot(cabinets, faults, flagged);

  const found = cabinets
    .flatMap((cabinet) => cabinet.slots.map((slot) => ({cabinet, slot})))
    .find((entry) => entry.slot.key === selected);

  /* Not a line-up this app is willing to draw — the grid is the honest answer, and it
     heads itself. See the note above. */
  if (!moduleCabinetsFit(bank, hasPower) || found === undefined) {
    return <ModuleRack bank={bank} />;
  }

  const spare = allSlots(cabinets).length - modules.length;
  /* The register counts modules from one across the whole bank; the drawing groups
     them by cabinet. `M04` is the fourth module wherever it stands, so the label is
     the join — the same one the figure makes. */
  const index =
    found.slot.module === undefined ? undefined : Number(found.slot.module.label.slice(1));

  return (
    <section aria-label="Battery modules" className="flex flex-col gap-3 py-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-medium text-primary">The modules</h2>
        {/* `ModuleRack`'s caption, with the line-up's own fact added at the end.

            The fault clause still leads where there is one, because it is the only
            thing here somebody has to act on, and there is deliberately **no zero
            state**: a bank with no monitoring unit would otherwise read `0 modules
            faulted`, which is nothing watching presented as nothing wrong.

            Then the charge range, which is the reason the band is drawn and the one
            fact the page does not state elsewhere; then the temperature range, which
            says what the panel's `Temp` row is to be read against.

            The spare slots are new and go last. They are what the drawing adds over
            the cards, and they are the figure an autonomy quote actually turns on —
            capacity past the cabinet's seven costs another cabinet, not another
            module. Drawn only when there are some, so a full line-up does not carry
            `0 spare slots` as chrome. */}
        <p className="text-xs text-tertiary">
          {faults.size > 0 && (
            <span className="text-severity-warning">
              {`${faults.size} module${faults.size === 1 ? '' : 's'} faulted · `}
            </span>
          )}
          {`${Math.round(charge.low * 100)}–${Math.round(charge.high * 100)}% across the rack · ${temperature.low.toFixed(1)}–${temperature.high.toFixed(1)} °C · ${bank.modules.toLocaleString('en-MY')} modules of ${bank.moduleKwh} kWh`}
          {spare > 0 && ` · ${spare} spare slot${spare === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Figure left, panel right — **the subrack band's track, to the rem.** Jeff made
          the cabinet page the definitive guide for this band's spacing (2026-09-10), so
          the two are now the same declaration: 44rem of drawing, the panel taking the
          rest at no less than 20rem, which is 346px at the 1440px design width.

          It was `max-content`, on the argument that a line-up drawn to the hardware's
          own proportion is only about 27rem wide and a fixed track would leave dead
          space between the drawing and the panel. That is answered rather than
          abandoned: `ModuleCabinetFigure`'s boxes now flex to fill the column, so there
          is no dead space and the panel is the same width it is one page across. What it
          cost is the cabinets' true proportion — that file's own note carries the trade.

          One column until `xl`, the subrack's breakpoint: two side by side inside these
          rails below it would squeeze the panel under the 20rem its rows need. */}
      <div
        className="flex flex-col gap-4 xl:grid xl:items-start xl:gap-6"
        style={{gridTemplateColumns: 'minmax(0, 44rem) minmax(20rem, 1fr)'}}
      >
        <ModuleCabinetFigure
          cabinets={cabinets}
          packSoc={bank.soc}
          faults={faults}
          flagged={flagged}
          selected={selected}
          onSelect={setPicked}
        />

        <div className="min-w-0">
          <ModuleSlotPanel
            bank={bank}
            cabinet={found.cabinet}
            slot={found.slot}
            fault={index === undefined ? undefined : faults.get(index)}
          />
        </div>
      </div>
    </section>
  );
};

/**
 * Which slot the band opens on.
 *
 * `shelfDefaultBay`'s rule and its reason: a page should open on whatever a reader
 * would have clicked first.
 *
 * 1. **A faulted module.** If the unit is asserting `Lithium Battery 4 Abnormal` then
 *    that is why anybody opened this page, and making them find the lit slot in a
 *    line-up of thirteen is the panel arriving one click late.
 * 2. **A module this app has flagged as low.** No device is claiming anything, but it
 *    is the only module on the page with a mark on it.
 * 3. **The first module.** Not the *lowest*, though it is tempting: some module has
 *    to be last, and opening its panel on a pack in good order would dress a signpost
 *    as a finding. `M01` is where a person's eye lands, which is the same argument
 *    the shelf makes for `Rectifier 1`.
 */
const defaultSlot = (
  cabinets: ReadonlyArray<ModuleCabinet>,
  faults: ReadonlyMap<number, unknown>,
  flagged: ReadonlySet<string>,
): string => {
  const slots = cabinets.flatMap((cabinet) => cabinet.slots);

  const faulted = slots.find(
    (slot) =>
      slot.module !== undefined && faults.has(Number(slot.module.label.slice(1))),
  );
  if (faulted !== undefined) return faulted.key;

  const low = slots.find(
    (slot) => slot.module !== undefined && flagged.has(slot.module.id),
  );
  if (low !== undefined) return low.key;

  const first = slots.find((slot) => slot.module !== undefined);
  return first?.key ?? slots[0]?.key ?? '';
};
