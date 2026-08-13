import {z} from 'zod';

import type {AlertSeverity} from './alert.type';

/**
 * How each severity is spelled in the URL.
 *
 * `satisfies Record<AlertSeverity, …>` is the point: add a fourth severity and
 * this object stops compiling, rather than silently shipping a chip whose
 * selection cannot be linked to.
 */
const SEVERITY_PARAM = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  NEUTRAL: 'neutral',
} as const satisfies Record<AlertSeverity, string>;

/**
 * Which chip is selected in the alerts section, as URL state.
 *
 * Same reason the fleet screen keeps its view in the URL: a link to a genset with
 * its coolant readings already open is the useful thing to paste into a message,
 * and the back button should step out of a filter rather than off the page.
 *
 * Both fields are `.catch()`-guarded. A hand-edited `?severity=urgent` should fall
 * back to no filter, not throw out of `validateSearch` and blank the route.
 */
export const gensetHomeSearchSchema = z.object({
  severity: z.enum(['critical', 'warning', 'neutral']).optional().catch(undefined),
  tag: z.string().optional().catch(undefined),
});

export type GensetHomeSearch = z.infer<typeof gensetHomeSearchSchema>;

/**
 * The resolved selection the alerts section works with.
 *
 * A tagged union rather than two optional fields, so "a severity is selected" and
 * "a tag is selected" cannot both be true inside the component. The URL *can*
 * express that contradiction — someone will hand-edit both params in — and
 * `alertFocus()` is the one place it gets resolved, in favour of severity.
 */
export type AlertFocus =
  | {kind: 'none'}
  | {kind: 'severity'; severity: AlertSeverity}
  | {kind: 'tag'; tagId: string};

export const alertFocus = (search: GensetHomeSearch): AlertFocus => {
  const match = Object.entries(SEVERITY_PARAM).find(([, param]) => param === search.severity);
  if (match !== undefined) return {kind: 'severity', severity: match[0] as AlertSeverity};
  if (search.tag !== undefined) return {kind: 'tag', tagId: search.tag};
  return {kind: 'none'};
};

/** The inverse — an `AlertFocus` back into search params, clearing the other. */
export const alertFocusSearch = (focus: AlertFocus): GensetHomeSearch => {
  if (focus.kind === 'severity') return {severity: SEVERITY_PARAM[focus.severity]};
  if (focus.kind === 'tag') return {tag: focus.tagId};
  return {severity: undefined, tag: undefined};
};
