import {CircleIcon, MoonIcon, PowerOffIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {lightToken} from '@/styles/colors';
import type {SystemState} from '../types/system.type';

/**
 * How a system's state is written and coloured in a badge, and on a pin.
 *
 * `RUN_STATE_META`'s pattern exactly — the surface stays neutral and only the
 * glyph carries state, so a column of mixed badges reads as one family rather
 * than a traffic light — and the same three tokens, because an operator reading a
 * genset row and a solar row on adjacent screens should not have to learn two
 * palettes for `Offline`.
 *
 * `IDLE` takes a moon rather than the genset's pause bars. A paused genset is a
 * machine somebody has not started; an idle solar system is a working system at
 * ten at night, and drawing the two the same way would put a fault glyph on every
 * solar row on the estate for half of every day.
 *
 * ## `mapColor`, which this record used to argue against
 *
 * It said: *"No `mapColor`. This register has no map: a system is at a site, the
 * sites map already has a pin there, and a second map of the same twenty-five points
 * coloured differently invites a comparison nobody asked for."*
 *
 * The register has a map now, and the objection was answered rather than overruled.
 * The comparison it feared is between a sites pin and a solar pin — but a reader on
 * `/solar` is asking *which arrays are working*, and the sites map cannot answer
 * that: its pins carry the worst condition among a yard's **gensets**, so a site
 * whose array went dark last month still draws green there. Two maps of one estate
 * are worth having exactly when they answer two questions, which these do.
 *
 * The colour is a literal rather than a token name because MapLibre evaluates paint
 * properties in a shader, where `var(--status-idle)` means nothing. It lives here,
 * beside the class the badge wears, for the reason `RUN_STATE_META` keeps the fleet
 * map's: the pin and the badge are two readings of one state, and a second copy of
 * the colour is how they end up disagreeing.
 */
export const SYSTEM_STATE_META: Record<
  SystemState,
  {label: string; icon: LucideIcon; iconClassName: string; mapColor: string}
> = {
  GENERATING: {
    label: 'Generating',
    icon: CircleIcon,
    iconClassName: 'text-status-running',
    mapColor: lightToken['status-running'],
  },
  IDLE: {
    label: 'Idle',
    icon: MoonIcon,
    iconClassName: 'text-status-idle',
    mapColor: lightToken['status-idle'],
  },
  OFFLINE: {
    label: 'Offline',
    icon: PowerOffIcon,
    iconClassName: 'text-status-offline',
    mapColor: lightToken['status-offline'],
  },
};
