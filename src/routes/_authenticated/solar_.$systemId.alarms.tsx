import {createFileRoute} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * What changed since this placeholder was written at the section level.
 *
 * It used to say the estate had no array alarms at all, and that was true. The
 * home page's health band now derives three — a silent system, strings down, an
 * overdue wash — from the generation model and the site's own telemetry.
 *
 * It derived five until the inverters went. A box silent while its neighbours were
 * not, and an insulation resistance below the level at which a box refuses to
 * start, were both an inverter's own readings, and a telco site has no inverter:
 * the array feeds a −48 V DC bus and there is no AC stage to invert to. A rule
 * this app cannot derive is a rule it must not print.
 *
 * What is still absent is everything that makes a set of live conditions an
 * *alarm system*: history, acknowledgement, who saw it and when, and the
 * thresholds as editable lines rather than constants in `systemHealth.ts`. That is
 * this tab, and it is the same gap the genset's Alarms tab is standing over.
 */
export const Route = createFileRoute('/_authenticated/solar_/$systemId/alarms')({
  component: () => (
    <ComingSoon
      icon={BellIcon}
      title="Alarms"
      description="This system's alarm history — raised, acknowledged, cleared and by whom — with each rule's threshold as a line somebody can move. The live conditions are on the home page; nothing yet records them. Empty."
    />
  ),
});
