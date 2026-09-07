import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {ArrayEquipment} from '@/modules/solar/components/detail/ArrayEquipment';
import {useSolarSystem} from '@/modules/solar/data/systems';

/**
 * `Devices` — what this system is built from.
 *
 * ## Why this route no longer builds a detail
 *
 * It used to build a `systemDetail` and a `systemHealth` to hand the inverter list
 * a set of alerts, because most of those rules named a box and a row had to be able
 * to show which one was down. There are no boxes: a telco site runs a −48 V DC bus
 * and its loads are DC, so the array feeds the bus and there is no AC stage to
 * invert to. What is left under a system is glass, cable and a combiner, and every
 * figure `ArrayEquipment` prints is already on the system.
 *
 * So the only lookup here is the system itself, live off the power-role store — the
 * guard every screen in this module carries, for the case where a reader flips this
 * site away from `SOLAR_HYBRID` while the page is open.
 *
 * The alerts did not go with the list. `string-out` is the rule that survived the
 * boxes, and it is on the home page's health band with the month it started, where
 * every other rule this system carries already was.
 */
const SystemDevicesRoute = () => {
  const {systemId} = Route.useParams();
  // One clock for the page, the rule every screen in this module follows.
  const [now] = useState(() => Date.now());
  const system = useSolarSystem(systemId, now);

  // The role was changed out from under the page — the same guard the section's
  // shell carries, and it cannot be thrown from a render.
  if (system === undefined) return <NotFound />;

  return (
    <div className="flex flex-col px-4 pt-3 pb-24 md:pb-6">
      <ArrayEquipment system={system} />
    </div>
  );
};

export const Route = createFileRoute('/_authenticated/solar_/$systemId/equipment')({
  component: SystemDevicesRoute,
});
