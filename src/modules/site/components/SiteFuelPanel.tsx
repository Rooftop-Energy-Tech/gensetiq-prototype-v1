import {FuelIcon} from 'lucide-react';

import {FuelTank} from '@/modules/genset/components/detail/FuelTank';
import {fuelFraction, fuelLevel} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {SiteSummary} from '../data/sites';

/**
 * The site's diesel, in the slot a solar site gives its intraday curve.
 *
 * ## Why this exists at all
 *
 * The top band is three columns wide. A solar site fills the third with what its
 * array is doing right now; a site with no array left it empty, so two thirds of
 * the band was content and the last third was the page being wide. Widening the
 * gaps to cover that was the previous answer and it only made the emptiness look
 * deliberate.
 *
 * What belongs there is the same *kind* of fact the curve is — the live quantity
 * that decides whether somebody has to do something today — and on a site running
 * on diesel that is unambiguously the tank. A prime site with no incomer and no
 * storage has exactly one thing between the tower and silence, and it is the
 * number of litres in that drum.
 *
 * ## Per genset, not summed
 *
 * A site's total litres is a figure with no decision attached to it: two sets at
 * 50% is not the same estate as one at 100% and one dry, and the tanker goes to
 * the dry one either way. `SiteSummaryPanel` already states the site total for
 * the record; this states the tanks, because tanks are what get filled.
 *
 * The reserve line at 30% is the same one the fleet's refuel bucket draws, so a
 * set showing red here is a set the overview is already counting.
 */
export const SiteFuelPanel = ({summary}: {summary: SiteSummary}) => (
  <div className="flex min-w-[15rem] flex-1 flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="text-sm font-medium text-primary">Fuel</span>
      <span className="text-xs text-secondary tabular-nums">
        {summary.fuelLitres.toLocaleString('en-MY')} L of{' '}
        {summary.fuelCapacityLitres.toLocaleString('en-MY')} on site
      </span>
    </div>

    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {summary.gensets.map(({genset, detail}) => {
        const fraction = fuelFraction(genset.fuelLitres, genset.fuelCapacityLitres);
        const low = fraction <= 0.3;

        return (
          <div key={genset.id} className="flex items-center gap-2.5">
            <FuelTank fraction={fraction} />

            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-primary">{genset.tag}</span>
              <span
                className={cn(
                  'text-sm tabular-nums',
                  low ? 'text-severity-warning' : 'text-primary',
                )}
              >
                {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
              </span>
              <span className="flex items-center gap-1 text-xs text-tertiary tabular-nums">
                <FuelIcon className="size-3 shrink-0" aria-hidden="true" />
                {/* Hours to the reserve line rather than to empty. Nobody runs a
                    set to the bottom of the drum, and a runway counted to zero is
                    a number the reader has to discount in their head. */}
                {detail.fuel.hoursToReserve <= 0
                  ? 'at reserve'
                  : `${detail.fuel.hoursToReserve} h to 30%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
