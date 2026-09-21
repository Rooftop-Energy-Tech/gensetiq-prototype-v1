import {CalendarClockIcon, CircleIcon, TruckIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {DeploymentState} from '../types/deployment.type';

/**
 * One description of a job's state, for the six places that draw it.
 *
 * The table's badge, the phone cards, the preview panel, the map's pin, the
 * timeline's bar and the job's own page all say the same three things, and a state
 * that read `Deployed` on one screen and `Out` on another would be two states as far
 * as a reader is concerned. The icon and the tint travel with the word for the same
 * reason.
 *
 * `active` is labelled **Deployed** rather than "Active": it is what the operations
 * room says, and it is the word the earlier feed used for the same rows.
 */
export const DEPLOYMENT_STATE_META: Record<
  DeploymentState,
  {label: string; icon: LucideIcon; iconClassName: string; pin: string}
> = {
  planned: {
    label: 'Planned',
    icon: CalendarClockIcon,
    // The brand accent rather than a severity: a booked job is not a condition, and
    // there are only three severities in this app on purpose (see `colors.ts`).
    iconClassName: 'text-brand',
    // Hollow on the map, because nothing is standing there yet.
    pin: 'planned',
  },
  active: {
    label: 'Deployed',
    icon: CircleIcon,
    iconClassName: 'text-severity-ok',
    pin: 'active',
  },
  completed: {
    label: 'Completed',
    icon: TruckIcon,
    iconClassName: 'text-tertiary',
    pin: 'completed',
  },
};
