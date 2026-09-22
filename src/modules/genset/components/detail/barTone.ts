import type {AlertSeverity} from '../../types/alert.type';

/**
 * How a bar's filled portion is coloured: by the worst alarm standing against the
 * reading it draws.
 *
 * The same three tokens the marks and the alarm chips use, so one fault is one
 * colour wherever it appears on the page. Teal is the absence of a fault rather than
 * a fourth severity — it is the colour every bar was before any of this, and a bar
 * that went green on "nothing wrong" would make a healthy output card a wall of
 * green, which is louder than the amber it is supposed to make findable.
 *
 * `NEUTRAL` falls through to teal for the reason it falls through to green on a
 * mark: an informational bit standing against a reading is not a reason to stop
 * calling that reading healthy.
 */
export const barFill = (severity: AlertSeverity | undefined): string => {
  if (severity === 'CRITICAL') return 'bg-severity-critical';
  if (severity === 'WARNING') return 'bg-severity-warning';
  return 'bg-teal';
};
