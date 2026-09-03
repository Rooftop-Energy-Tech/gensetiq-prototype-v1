import {BellIcon, CircleCheckIcon, EyeIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {AlarmStanding} from '../../types/alarmState.type';

/**
 * How each standing is written and drawn.
 *
 * Deliberately **not** coloured by severity. The severity chip beside it already
 * carries the red, and a row that is red twice for two different reasons is a row
 * a reader has to decode; here the colour says only "has anybody dealt with
 * this", which is the question the column exists to answer.
 *
 * So there are two colours and a neutral, and the one that is coloured green is
 * `CLEARED` — the only one of the three that is genuinely good news. `ACKNOWLEDGED`
 * is `text-secondary` rather than amber on purpose: an acknowledged alarm is still
 * a live fault, and giving it a hue of its own invites it to be read as a state
 * between "wrong" and "fine", which it is not. It is the same fault with a name
 * against it.
 */
export const STANDING_META: Record<
  AlarmStanding,
  {label: string; icon: LucideIcon; textClassName: string}
> = {
  UNACKNOWLEDGED: {
    label: 'Unacknowledged',
    icon: BellIcon,
    textClassName: 'text-severity-critical',
  },
  ACKNOWLEDGED: {label: 'Acknowledged', icon: EyeIcon, textClassName: 'text-secondary'},
  CLEARED: {label: 'Cleared', icon: CircleCheckIcon, textClassName: 'text-severity-ok'},
};
