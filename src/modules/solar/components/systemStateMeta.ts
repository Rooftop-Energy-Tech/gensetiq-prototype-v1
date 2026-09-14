import {MoonIcon, PowerOffIcon, SunMediumIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {lightToken} from '@/styles/colors';
import type {SystemState} from '../types/system.type';

/**
 * How a system's state is written and coloured in a badge, and on a pin.
 *
 * `RUN_STATE_META`'s pattern — the surface stays neutral and only the glyph
 * carries state, so a column of mixed badges reads as one family rather than a
 * traffic light. `IDLE` and `OFFLINE` keep the fleet's own tokens too, because an
 * operator reading a genset row and a solar row on adjacent screens should not
 * have to learn two palettes for `Offline`.
 *
 * **`GENERATING` is the one that departs, in both glyph and colour**, and it went
 * on 2026-09-14. It drew `CircleIcon` in `text-status-running` — the blue dot the
 * fleet list gives a running engine. It now draws `SunMediumIcon` in `text-solar`,
 * the deep amber this app already spends on solar everywhere else: the rail's
 * `Solar`, the site strip's `On solar` badge, an SSU in the cabinet, the array in a
 * site's settings, the solar band in every chart.
 *
 * The reasoning is the same for both halves. A blue circle said *this row is live*,
 * which is equally true of a turning diesel engine; a sun in the colour this app
 * has already taught the reader to mean *solar* says what is making the power,
 * which is the only thing a solar register is about. The shared palette was worth
 * keeping for the two states that mean **a system is not working** — those a reader
 * really does cross between screens to compare — and worth spending for the one
 * that means it is.
 *
 * `IDLE`'s moon was already there, and it reads as the sun's other half now rather
 * than as an exception. It is a moon rather than the genset's pause bars because a
 * paused genset is a machine somebody has not started, while an idle solar system
 * is a working system at ten at night — drawing the two the same way would put a
 * fault glyph on every solar row on the estate for half of every day.
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
    // `mapColor` moves with `iconClassName`, which is the whole reason the two sit
    // on one record — see the note above. A pin left on `status-running` while the
    // badge went amber is exactly the disagreement this record exists to prevent.
    label: 'Generating',
    icon: SunMediumIcon,
    iconClassName: 'text-solar',
    mapColor: lightToken.solar,
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
