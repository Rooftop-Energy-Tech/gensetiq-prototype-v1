import {CircleIcon, MoonIcon, PowerOffIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {InverterState} from '../types/system.type';

/**
 * How each state is written and coloured in a badge — used for one inverter and
 * for a whole system, since the roll-up returns the same three words.
 *
 * `RUN_STATE_META`'s pattern exactly — the surface stays neutral and only the
 * glyph carries state, so a column of mixed badges reads as one family rather
 * than a traffic light — and the same three tokens, because an operator reading a
 * genset row and a solar row on adjacent screens should not have to learn two
 * palettes for `Offline`.
 *
 * `IDLE` takes a moon rather than the genset's pause bars. A paused genset is a
 * machine somebody has not started; an idle inverter is a working inverter at ten
 * at night, and drawing the two the same way would put a fault glyph on every
 * solar row on the estate for half of every day.
 *
 * No `mapColor`. This register has no map: a system is at a site, the sites map
 * already has a pin there, and a second map of the same twenty-five points
 * coloured differently invites a comparison nobody asked for.
 */
export const INVERTER_STATE_META: Record<
  InverterState,
  {label: string; icon: LucideIcon; iconClassName: string}
> = {
  GENERATING: {label: 'Generating', icon: CircleIcon, iconClassName: 'text-status-running'},
  IDLE: {label: 'Idle', icon: MoonIcon, iconClassName: 'text-status-idle'},
  OFFLINE: {label: 'Offline', icon: PowerOffIcon, iconClassName: 'text-status-offline'},
};
