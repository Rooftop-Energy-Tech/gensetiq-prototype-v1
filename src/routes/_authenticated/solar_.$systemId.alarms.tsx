import {createFileRoute} from '@tanstack/react-router';
import {BellIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * What changed since this placeholder was written at the section level.
 *
 * It used to say the estate had no array alarms at all, and that was true. The
 * home page's health band now derives six — a silent system, a silent box, a
 * string down, a system that never met its number, low insulation, an overdue
 * wash — from the generation model and the inverters' own readings, and each one
 * that belongs to a box names it.
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
      description="This system's alarm history — raised, acknowledged, cleared, by whom, and on which inverter — with each rule's threshold as a line somebody can move. The live conditions are on the home page; nothing yet records them. Empty."
    />
  ),
});
