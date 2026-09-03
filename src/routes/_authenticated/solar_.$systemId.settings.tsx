import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';

/**
 * What this system is, as figures somebody can edit.
 *
 * Its capacity, its module count and rating, the date it was commissioned — the
 * details band on the home page prints all of these and every one of them is a
 * constant today. So are the thresholds the health band fires on: the insulation
 * floor, the wash interval, and how long a silence has to last before it counts.
 *
 * Beside them belongs the answer to a question this model has not had to face
 * yet: when a site has a generation meter *and* inverter telemetry, the two will
 * not agree — AC losses, auxiliary draw, one box out of contact — and whichever
 * is made the truth, the other becomes a reconciliation.
 */
export const Route = createFileRoute('/_authenticated/solar_/$systemId/settings')({
  component: () => (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      description="What this system is and the lines its health rules fire on — capacity, modules, commissioning date, the insulation floor and the wash interval — as editable figures rather than constants in the model. Empty."
    />
  ),
});
