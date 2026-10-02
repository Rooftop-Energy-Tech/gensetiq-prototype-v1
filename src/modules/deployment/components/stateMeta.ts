import {CalendarClockIcon, TruckIcon} from 'lucide-react';
import type {ComponentType} from 'react';

import type {ChipTone} from '@/components/global/SummaryCards';
import {RunningPulse} from '@/modules/genset/components/RunningPulse';

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
  {
    label: string;
    /** A Lucide icon, or `RunningPulse` for the live state — both take `className`. */
    icon: ComponentType<{className?: string}>;
    iconClassName: string;
    tone: ChipTone;
    pin: string;
  }
> = {
  planned: {
    label: 'Planned',
    icon: CalendarClockIcon,
    // Deployed's green, hollow (2026-09-29): the same job before it starts, so the
    // same colour, and the outline says nothing is standing there yet — as the
    // map's hollow pin does. Teal and green read as one colour at dot size.
    iconClassName: 'text-severity-ok',
    tone: 'ok-hollow',
    // Hollow on the map, because nothing is standing there yet.
    pin: 'planned',
  },
  active: {
    label: 'Deployed',
    // The running genset's ping (2026-09-29): a deployed job is the live one, and
    // it pulses as a running set does on the Gensets tab. Filled, so hollow stays
    // Planned's alone.
    icon: RunningPulse,
    iconClassName: 'text-severity-ok',
    tone: 'ok',
    pin: 'active',
  },
  completed: {
    label: 'Completed',
    icon: TruckIcon,
    // Offline's slate (2026-09-29): a done job recedes, but the old 40% grey was
    // too faint to read as a dot.
    iconClassName: 'text-status-offline',
    tone: 'offline',
    pin: 'completed',
  },
};
