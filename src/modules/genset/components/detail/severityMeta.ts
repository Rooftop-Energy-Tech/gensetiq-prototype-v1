import {ActivityIcon, CircleCheckIcon, CircleXIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {darkToken} from '@/styles/colors';
import type {AlertSeverity, GensetCondition} from '../../types/alert.type';

/**
 * How each severity is written and coloured.
 *
 * Unlike `runStateMeta.ts` — where the badge surface stays neutral and only the
 * glyph carries colour — severity colours the glyph *and* the text. Run state is
 * one of four mutually exclusive values a reader can learn once; severity is a
 * ranking, and a chip row mixing all three has to make the ordering visible
 * without being read left to right.
 *
 * `NEUTRAL` deliberately has no colour of its own. It is `text-primary`, the
 * same value the design exports on its neutral bell, because a neutral alert is
 * a note rather than a problem and giving it a hue would put it on the same
 * footing as the two that are.
 */
export const SEVERITY_META: Record<
  AlertSeverity,
  {label: string; textClassName: string; strokeClassName: string; fillClassName: string}
> = {
  CRITICAL: {
    label: 'Critical',
    textClassName: 'text-severity-critical',
    // The SVG pair, for the analysis chart's threshold lines. Tailwind resolves
    // `stroke-*` and `fill-*` from the same token as `text-*`, so an alarm line
    // and its caption cannot end up different shades of the same red.
    strokeClassName: 'stroke-severity-critical',
    fillClassName: 'fill-severity-critical',
  },
  WARNING: {
    label: 'Warning',
    textClassName: 'text-severity-warning',
    strokeClassName: 'stroke-severity-warning',
    fillClassName: 'fill-severity-warning',
  },
  NEUTRAL: {
    label: 'Neutral',
    textClassName: 'text-primary',
    strokeClassName: 'stroke-primary',
    fillClassName: 'fill-primary',
  },
};

/**
 * The verdict above the alerts section, and the glyph that carries it.
 *
 * `OPTIMUM` gets a tick rather than the design's activity trace: the trace is the
 * section's icon in every state, so using it for the verdict too means the one
 * element that is supposed to change with the machine's health is the one that
 * looks the same whatever it says.
 *
 * `mapColor` is the same colour as a literal, for the sites map's pins — MapLibre
 * evaluates paint properties in a shader, where a CSS variable means nothing. It
 * lives here rather than in the site module for the reason `RUN_STATE_META`
 * carries the fleet map's: the pin and the badge are two readings of one verdict,
 * and a second copy of the colour is how they end up disagreeing.
 */
export const CONDITION_META: Record<
  GensetCondition,
  {label: string; icon: LucideIcon; textClassName: string; mapColor: string}
> = {
  OPTIMUM: {
    label: 'Optimum',
    icon: CircleCheckIcon,
    textClassName: 'text-severity-ok',
    mapColor: darkToken['severity-ok'],
  },
  ATTENTION: {
    label: 'Attention',
    icon: ActivityIcon,
    textClassName: 'text-severity-warning',
    mapColor: darkToken['severity-warning'],
  },
  CRITICAL: {
    label: 'Critical',
    icon: CircleXIcon,
    textClassName: 'text-severity-critical',
    mapColor: darkToken['severity-critical'],
  },
};
