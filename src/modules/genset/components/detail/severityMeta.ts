import {ActivityIcon, CircleCheckIcon, CircleXIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

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
  {label: string; textClassName: string}
> = {
  CRITICAL: {label: 'Critical', textClassName: 'text-severity-critical'},
  WARNING: {label: 'Warning', textClassName: 'text-severity-warning'},
  NEUTRAL: {label: 'Neutral', textClassName: 'text-primary'},
};

/**
 * The verdict above the alerts section, and the glyph that carries it.
 *
 * `OPTIMUM` gets a tick rather than the design's activity trace: the trace is the
 * section's icon in every state, so using it for the verdict too means the one
 * element that is supposed to change with the machine's health is the one that
 * looks the same whatever it says.
 */
export const CONDITION_META: Record<
  GensetCondition,
  {label: string; icon: LucideIcon; textClassName: string}
> = {
  OPTIMUM: {label: 'Optimum', icon: CircleCheckIcon, textClassName: 'text-severity-ok'},
  ATTENTION: {label: 'Attention', icon: ActivityIcon, textClassName: 'text-severity-warning'},
  CRITICAL: {label: 'Critical', icon: CircleXIcon, textClassName: 'text-severity-critical'},
};
