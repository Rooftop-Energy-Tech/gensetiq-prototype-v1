import {fuelLevelKind} from '../types/fuelLevel.type';

/**
 * The ink for a fuel figure in the register: red below the reserve line, the
 * ordinary text colour above it.
 *
 * The line is `fuelLevelKind`'s — the 30% that raises the `Low fuel` alarm and files
 * a set under the `Low fuel` card — so a figure is red exactly when the machine is
 * carrying that alarm, and never on a threshold of its own.
 *
 * **Red, not the alarm's amber**, because that was the ask (2026-09-28): the figure
 * is the thing a reader scans a column of, and red is the one colour on the list
 * that nothing else in the column uses. The alarm itself stays a `WARNING`. The two
 * are different questions — how loud the queue shouts, and which number in a column
 * of numbers is the low one — and `severity-critical` is the only red token.
 *
 * One function for the table, the phone cards and the preview panel, which are one
 * screen at three widths and must not colour one tank three ways.
 */
export const fuelLevelTextClass = (litres: number, capacityLitres: number): string =>
  fuelLevelKind(litres, capacityLitres) === 'low' ? 'text-severity-critical' : 'text-primary';
