import {HourglassIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, duration, fuelFraction, fuelHeadline, stampDate} from '@/lib/format';
import type {Genset} from '../../types/genset.type';
import type {GensetFuelDetail} from '../../data/detail';
import {FuelTank} from './FuelTank';
import {MetricRow} from './MetricRow';

const HOUR = 3_600_000;

/**
 * The fuel half of the top row.
 *
 * Structured to answer the two questions in the order they get asked: *how much
 * is in there* (the tank glyph and the headline figure) and *when do I have to do
 * something about it* (the runway badge, then the date).
 *
 * The runway counts down to the reserve line rather than to empty, because empty
 * is not a number anybody plans against — a set that runs its tank dry picks up
 * air in the fuel system and needs bleeding before it will restart.
 *
 * **The runway is stated differently for a stopped set, and it has to be.** For a
 * running one, litres-above-reserve ÷ burn rate is both an amount of runtime and
 * an amount of wall-clock, so "17 hours to 30%" and a refuel date say the same
 * thing. A stopped set is burning nothing: the same arithmetic is still the runtime
 * it would get if you started it, but a *date* would claim the tank is draining
 * while the engine sits idle. So a stopped set gets the runtime and no date, and
 * its rate is labelled as the one from its last run rather than a current one.
 */
export const FuelPanel = ({
  genset,
  fuel,
  running,
}: {
  genset: Genset;
  fuel: GensetFuelDetail;
  running: boolean;
}) => {
  const reserve = Math.round(fuel.reserveFraction * 100);
  const belowReserve = genset.fuelLitres <= fuel.reserveFraction * fuel.maxLitres;

  const runway = belowReserve
    ? `Below ${reserve}% reserve`
    : fuel.hoursToReserve === 0
      ? `Under an hour to ${reserve}%`
      : running
        ? `${fuel.hoursToReserve} hours to ${reserve}%`
        : `${fuel.hoursToReserve} hours of runtime left`;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-8 p-3">
      <div className="flex shrink-0 flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <FuelTank fraction={fuelFraction(genset.fuelLitres, fuel.maxLitres)} />
          <p className="text-base font-medium whitespace-pre text-primary">
            {fuelHeadline(genset.fuelLitres, fuel.maxLitres)}
          </p>
        </div>

        <Badge variant="element" className="border-subtle">
          <HourglassIcon className="text-fuel" aria-hidden="true" />
          {runway}
        </Badge>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <MetricRow label="Max capacity" value={amount(fuel.maxLitres, 'L')} />
        <MetricRow
          label={running ? 'Fuel consumption rate' : 'Rate at last run'}
          value={amount(fuel.litresPerHour, 'L/hr', 1)}
        />
        {running ? (
          <MetricRow label="Refuel by" value={stampDate(fuel.refuelBy)} />
        ) : (
          <MetricRow
            label="Runtime to reserve"
            value={
              belowReserve
                ? 'none'
                : fuel.hoursToReserve === 0
                  ? 'under an hour'
                  : duration(fuel.hoursToReserve * HOUR)
            }
          />
        )}
      </div>
    </div>
  );
};
