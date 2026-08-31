import {createFileRoute} from '@tanstack/react-router';
import {WrenchIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * Nameplate — what is bolted to the site and what it was rated at on the day.
 *
 * Most of the electrical side already exists (`systems.ts`): the capacity, the
 * boxes, how the strings divide between them, and the commissioning date, all of
 * which the header tooltip and band 2 print. What is missing is the **modules** —
 * their make, count, and the tilt and azimuth they sit at.
 *
 * That last pair is also the seed of the only entity this model deliberately left
 * out. A tilt and an azimuth define a *plane*, and a plane is what lets a
 * shortfall be pinned to a piece of roof rather than to the boxes. Every site on
 * both estates is one plane, so there is nothing to attribute and the level would
 * only ever hold one child. The day a customer arrives with an east and a west
 * roof, this tab is where the second one shows up.
 */
export const Route = createFileRoute('/_authenticated/solar_/$systemId/equipment')({
  component: () => (
    <ComingSoon
      icon={WrenchIcon}
      title="Equipment"
      description="Modules and their count, their tilt and azimuth, and the commissioning record. The electrical side is already in the header and the inverter list; this is the glass. Empty."
    />
  ),
});
