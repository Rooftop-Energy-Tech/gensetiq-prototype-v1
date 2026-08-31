import {createFileRoute} from '@tanstack/react-router';
import {BrushCleaningIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * Carried down from `/solar/service`, narrowed from the estate to one system.
 *
 * The home page already says how long since the modules were washed and raises a
 * warning at four months. What is missing is the other half of a service tab: the
 * log of visits, and the generation lost to soiling between them.
 *
 * Inverter servicing belongs here too and is a different clock — fan and filter
 * changes are per box and run on hours, not on dust.
 */
export const Route = createFileRoute('/_authenticated/solar_/$systemId/service')({
  component: () => (
    <ComingSoon
      icon={BrushCleaningIcon}
      title="Service"
      description="Washing and inspection for this system, and the inverters' own maintenance clock: what was last done, what is next due, and what the soiling loss between visits cost in diesel. Empty."
    />
  ),
});
