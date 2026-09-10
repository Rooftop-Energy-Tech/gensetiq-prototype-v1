import {Link} from '@tanstack/react-router';
import {PackageOpenIcon, ThermometerIcon} from 'lucide-react';

import {AlarmPill} from '@/components/global/AlarmPill';
import {BatteryGlyph} from '@/components/global/BatteryGlyph';
import {Badge} from '@/components/ui/badge';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {SiteDeviceCard} from '@/modules/site/components/SiteDeviceCard';
import {monitoringUnit} from '@/modules/site/data/monitoringUnit';
import {IMBALANCE_POINTS} from '../../data/modules';
import type {BatteryBank} from '../../types/bank.type';
import type {ModuleCabinet, ModuleSlot} from '../../types/moduleCabinet.type';

/**
 * Whichever slot is selected, in full — the other half of the line-up drawing.
 *
 * `SubrackPanel` for the bank, on the same `SiteDeviceCard` the subrack's bays and
 * the site diagram's devices use, so a reader who has clicked a bay recognises this
 * before reading a word of it.
 *
 * ## What it is for
 *
 * The drawing gives a slot 150px and spends it on the two facts a person at the
 * cabinet door needs — which module this is, and how full. Everything else a module
 * has lives here: its health, its temperature, what it is actually holding, and the
 * register behind a fault. That is the trade the subrack made when its card rack
 * became an elevation, and it is the same trade here — the cards printed four figures
 * for every module at once and could not tell you which door to open.
 *
 * The figures are `ModuleRack`'s, in `ModuleRack`'s order and for its reasons: health
 * explains the charge, temperature corroborates both, and stored energy is the
 * arithmetic that goes last because it is the one a reader could derive.
 *
 * ## Why the part number is conditional
 *
 * `ESM-48150B1` is printed only where a monitoring unit is fitted, which is the four
 * surveyed sites. Those are the banks whose module count came off the site census
 * rather than out of a division, and whose derived module size — around 7.1 kWh —
 * lands where a 48 V / 150 Ah `CloudLi` module actually sits.
 *
 * Everywhere else the count is `bank.kwh` divided by a nominal 5.12 kWh, so the boxes
 * are a modelled size and no survey says what they are. Printing a Huawei part number
 * on them would be naming hardware nobody has seen, on the one screen whose whole job
 * is to tell a technician what to go and unbolt. The nameplate figure is printed
 * instead, which is a claim the model can support.
 *
 * ## Why a spare slot gets a panel at all
 *
 * Because it is an answer. A reader asking whether this site can take more storage
 * gets *which* positions are free and in which cabinet, rather than counting dashes
 * in the drawing — and the `ESC330`'s ceiling is the thing that actually limits an
 * autonomy quote, since capacity is bought a cabinet at a time.
 */
export const ModuleSlotPanel = ({
  bank,
  cabinet,
  slot,
  fault,
}: {
  bank: BatteryBank;
  /** The box the slot is in, for the identity line and the spare's sentence. */
  cabinet: ModuleCabinet;
  slot: ModuleSlot;
  /** The standing row against this module, where the unit is asserting one. */
  fault: AlarmView | undefined;
}) => {
  /* The one place the app is willing to name the part — see the note above. */
  const surveyed = monitoringUnit(bank.siteId) !== undefined;

  if (slot.module === undefined) {
    return (
      <SiteDeviceCard
        label="Slot"
        identity={`${cabinet.label} · ${slot.slot} of ${cabinet.slots.length}`}
        badges={
          <Badge variant="secondary" className="whitespace-pre">
            <PackageOpenIcon className="text-tertiary" aria-hidden="true" />
            Empty
          </Badge>
        }
      >
        <div className="flex flex-col gap-1">
          <MetricRow label="Cabinet" value={cabinet.model} />
          <MetricRow label="Takes" value={`${bank.moduleKwh} kWh module`} />
        </div>

        {/* Stated rather than left to be inferred from a dashed outline. A spare slot
            is the site's headroom, and headroom is a fact somebody quotes on. */}
        <p className="text-xs text-tertiary">
          Nothing fitted. This position takes one more module without groundworks —
          past the cabinet's {cabinet.slots.length}, more storage means another
          cabinet on the pad.
        </p>
      </SiteDeviceCard>
    );
  }

  const module = slot.module;
  const charge = Math.round(module.soc * 100);
  const shortfall = Math.round(bank.soc * 100) - charge;

  return (
    <SiteDeviceCard
      label="Module"
      identity={`${module.label} · ${cabinet.label} slot ${slot.slot}`}
      badges={
        <>
          <Badge variant="secondary" className="whitespace-pre">
            <ThermometerIcon className="text-tertiary" aria-hidden="true" />
            {module.tempC.toFixed(1)} °C
          </Badge>

          {/* The standing row, rank and register in one pill, linking to the tab it is
              listed on. It replaced a pill that said `Critical` and nothing else plus a
              a `FaultChip` at the foot of the card that carried the name — the rank at the
              top and the reason at the bottom, four rows of specification apart. Jeff
              asked for them joined (2026-09-10), in the shape the subrack's bay panel
              now uses, so a faulted module and a faulted SSU announce themselves
              identically. At most one, because `faultedModules` keys one row per module.
              See `AlarmPill`. */}
          {fault !== undefined && (
            <AlarmPill
              fault={fault}
              to="/battery/$bankId/alarms"
              params={{bankId: bank.id}}
            />
          )}

          {/* The app's own finding, kept visibly apart from the device's. Amber and
              no severity, because it has no row — the distinction `ModuleRack`
              argues and the drawing repeats in its edges. */}
          {fault === undefined && shortfall >= IMBALANCE_POINTS && (
            <Badge variant="secondary" className="whitespace-pre">
              <span className="text-severity-warning">{shortfall} pts low</span>
            </Badge>
          )}
        </>
      }
    >
      {/* The same picture the card had and the pack above it has, at the same size —
          which is what says these little batteries *are* the big one. */}
      <div className="flex items-center gap-2.5">
        <BatteryGlyph
          fraction={module.soc}
          size="sm"
          charging={bank.powerKw < 0}
          label={`${module.label}: ${charge}% charged`}
        />
        <p aria-hidden="true" className="flex items-baseline gap-0.5">
          <span className="text-lg leading-7 font-semibold text-primary">{charge}</span>
          <span className="text-xs font-medium text-primary">%</span>
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <MetricRow label="Health" value={`${Math.round(module.soh * 100)}%`} />
        <MetricRow label="Temp" value={`${module.tempC.toFixed(1)} °C`} />
        <MetricRow label="Stored" value={`${module.storedKwh.toFixed(2)} kWh`} />
        <MetricRow label="Nameplate" value={`${bank.moduleKwh} kWh`} />
        {surveyed && <MetricRow label="Part" value="ESM-48150B1" />}
        <MetricRow label="Cabinet" value={cabinet.model} />
      </div>

      {/* The one cross-asset case in the line-up, and it is worth a sentence rather
          than a bare label. This module does not stand in a battery cabinet at all —
          it shares the `ICC330-H1-C8` with the rectifiers, the SSUs and the monitoring
          unit, which is a different box with a different door and a different key.

          The link goes to that cabinet's own page. Its elevation will *not* show this
          module: that drawing is a traced photograph of the subrack's bays and the
          battery position is not among them, so adding one would be inventing
          geometry. The page is still the right destination — it is the asset this
          module is inside. */}
      {cabinet.kind === 'POWER' && (
        <p className="text-xs text-tertiary">
          Not in a battery cabinet — this module shares the{' '}
          <Link
            to="/cabinet/$cabinetId"
            params={{cabinetId: bank.siteId}}
            className="underline underline-offset-2 outline-none hover:text-secondary focus-visible:ring-2 focus-visible:ring-outline"
          >
            power cabinet
          </Link>{' '}
          with the subrack.
        </p>
      )}
    </SiteDeviceCard>
  );
};
