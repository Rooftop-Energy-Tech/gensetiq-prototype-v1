import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';

import {NotFound} from '@/components/global/NotFound';
import {InverterList} from '@/modules/solar/components/detail/InverterList';
import {systemDetail} from '@/modules/solar/data/systemDetail';
import {systemHealth} from '@/modules/solar/data/systemHealth';
import {useSolarSystem} from '@/modules/solar/data/systems';

/**
 * `Devices` — the boxes this system is built from, and the way to each one's page.
 *
 * ## Why the inverter list is here and not on the home page
 *
 * It was on the home page, because the page was built before this section existed.
 * The design's home page has five bands and none of them is a device list — and
 * `Devices` is where a reader looks for devices, so the band moved rather than
 * being deleted.
 *
 * That mattered more than tidiness. The rail deliberately does not list the boxes
 * (a mini-grid is ten of them, and a nested list would be an inventory — see
 * `SystemDetailShell`), so this list is the **only** route to
 * `/solar/<id>/inverters/<id>`. Deleting it would have left every inverter page
 * reachable by typing its id and by nothing else.
 *
 * ## The alerts are the system's, not the box's
 *
 * Built from `systemHealth` here and handed down, exactly as the home page did.
 * A rule like `string-out` is this app's arithmetic over the system's monthly
 * series and only *then* attributed to a box; deriving it per inverter would mean a
 * second derivation of the same claim, which is the shape every disagreement in
 * this app has had.
 *
 * ## What is still missing from this section
 *
 * The glass. `systems.ts` models the electrical side — capacity, boxes, how the
 * strings divide between them, the commissioning date — and the home page's
 * details band now prints the module count and rating derived from the capacity.
 * What no page holds is the modules' make, and the tilt and azimuth they sit at.
 *
 * That last pair is the seed of the only entity this model deliberately left out. A
 * tilt and an azimuth define a *plane*, and a plane is what lets a shortfall be
 * pinned to a piece of roof rather than to the boxes. Every site on both estates is
 * one plane, so there is nothing to attribute and the level would only ever hold
 * one child. The day a customer arrives with an east and a west roof, this is where
 * the second one shows up.
 */
const SystemDevicesRoute = () => {
  const {systemId} = Route.useParams();
  // One clock for the page, the rule every screen in this module follows.
  const [now] = useState(() => Date.now());
  const system = useSolarSystem(systemId, now);

  // The intraday curve is the expensive half of `systemDetail` and nothing here
  // draws it, so it is skipped — the flag exists for exactly this caller shape.
  const detail = system === undefined ? undefined : systemDetail(system, now, false);

  // The role was changed out from under the page — the same guard the section's
  // shell carries, and it cannot be thrown from a render.
  if (system === undefined || detail === undefined) return <NotFound />;

  const {alerts} = systemHealth(system, detail, now);

  return (
    <div className="flex flex-col px-4 pt-3 pb-24 md:pb-6">
      <InverterList system={system} alerts={alerts} now={now} />
    </div>
  );
};

export const Route = createFileRoute('/_authenticated/solar_/$systemId/equipment')({
  component: SystemDevicesRoute,
});
