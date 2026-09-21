import {HourglassIcon} from 'lucide-react';

import {TankGlyph} from '@/components/global/TankGlyph';
import {Badge} from '@/components/ui/badge';
import {amount, fuelFraction, fuelHeadline, runtimeSpan, stampDate} from '@/lib/format';
import type {Genset} from '../../types/genset.type';
import type {FuelIntegrityState} from '../../types/fuelIntegrity.type';
import {fuelRunway} from '../../types/fuelLevel.type';
import {instrumentsOf} from '../../data/fuelInstruments';
import type {GensetFuelDetail} from '../../data/detail';
import {LeakBadge} from './LeakBadge';
import {MetricRow} from './MetricRow';

/**
 * The fuel half of the top row.
 *
 * Structured to answer the two questions in the order they get asked: *how much
 * is in there* (the tank glyph and the headline figure) and *when do I have to do
 * something about it* (the runway badge, then the date).
 *
 * The runway phrasing — what it counts down to, and why a stopped set is worded
 * differently — belongs to `fuelRunway`, which the strip's tile reads too. What is
 * this component's own is the *rate* label: on a stopped set it says which run the
 * figure came from rather than presenting it as a current one.
 */
export const FuelPanel = ({
  genset,
  fuel,
  running,
  integrity,
}: {
  genset: Genset;
  fuel: GensetFuelDetail;
  running: boolean;
  integrity: FuelIntegrityState;
}) => {
  const metered = instrumentsOf(genset.id).flowMeter !== null;
  const belowReserve = genset.fuelLitres <= fuel.reserveFraction * fuel.maxLitres;
  const runway = fuelRunway(genset.fuelLitres, fuel, running);

  return (
    // The tank and its three figures sit side by side at every width — the tank is
    // 46px and the rows are label/value pairs, so the pair fits a phone with room
    // over. Only the gap gives way.
    // `md:min-w-[420px]` is a floor, and it is what makes the band wrap instead of
    // squeezing. The run half beside this one already has a 560px floor; with none
    // of its own this panel simply took whatever was left, and once the section
    // rail claimed 240px of the window that was around 380px — enough to render
    // but not enough for `Max capacity` and `Metered rate`, which truncated to
    // `Ma…` and `E…` beside intact figures. Below `md` the floor is dropped: at
    // 390px it is unsatisfiable and would push the page into a sideways scroll.
    <div className="flex min-w-0 flex-1 items-center gap-5 p-3 md:min-w-[420px] md:gap-8">
      <div className="flex shrink-0 flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <TankGlyph
            fraction={fuelFraction(genset.fuelLitres, fuel.maxLitres)}
            tone="fuel"
          />
          <p className="text-base font-medium whitespace-pre text-primary">
            {fuelHeadline(genset.fuelLitres, fuel.maxLitres)}
          </p>
        </div>

        <Badge variant="element" className="border-subtle">
          <HourglassIcon className="text-fuel" aria-hidden="true" />
          {runway}
        </Badge>

        {/* The verdict only. The arithmetic behind it is a nine-row derivation and
            belongs beside the threshold that governs it, not in a band whose job is
            "how much is in there and when do I fill it". */}
        <LeakBadge gensetId={genset.id} state={integrity} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <MetricRow label="Max capacity" value={amount(fuel.maxLitres, 'L')} />
        {/* Metered or estimated, said out loud. Without a flow meter this figure is
            computed from the electrical load — a good estimate, and not a
            measurement — and the difference is the whole premise of the alarm
            below it. Presenting the two identically would make the one screen that
            depends on the distinction the one screen that hides it.
            The provenance replaces the word "Fuel" rather than being added after
            it: this column truncates at 375px, and a parenthetical would be the
            first thing a phone dropped. */}
        <MetricRow
          label={
            running
              ? metered
                ? 'Metered rate'
                : 'Estimated rate'
              : metered
                ? 'Metered, last run'
                : 'Estimated, last run'
          }
          value={amount(fuel.litresPerHour, 'L/hr', 1)}
        />
        {running ? (
          <MetricRow label="Refuel by" value={stampDate(fuel.refuelBy)} />
        ) : (
          <MetricRow
            label="Runtime to reserve"
            value={belowReserve ? 'none' : runtimeSpan(fuel.hoursToReserve)}
          />
        )}
      </div>
    </div>
  );
};
