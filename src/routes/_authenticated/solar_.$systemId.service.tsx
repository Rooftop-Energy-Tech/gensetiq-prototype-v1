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
 * There is a second clock this tab would once have carried and no longer does.
 * Fan and filter changes ran per inverter and on hours rather than on dust, and a
 * telco site has no inverter: the array feeds a −48 V DC bus and there is no AC
 * stage to invert to. What is left under a system is glass, cable and a combiner,
 * and the only maintenance any of it has is the wash and the inspection.
 */
export const Route = createFileRoute('/_authenticated/solar_/$systemId/service')({
  component: () => (
    <ComingSoon
      icon={BrushCleaningIcon}
      title="Service"
      description="Washing and inspection for this system: what was last done, what is next due, and what the soiling loss between visits cost in diesel. Empty."
    />
  ),
});
