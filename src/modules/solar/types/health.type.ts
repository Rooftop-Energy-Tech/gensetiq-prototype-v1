import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import type {AlertSeverity, GensetCondition} from '@/modules/genset/types/alert.type';

/**
 * What is wrong with a solar system, and where the claim came from.
 *
 * ## Why this is not `GensetAlert`
 *
 * A genset's alert carries a **register and a bit**, because every one of them is
 * a line on a Modbus map and the coordinates are how a reader checks the app
 * against the panel. A PV system has no such sheet: some of these rules are an
 * inverter talking and some are *this app's own arithmetic* over the generation
 * model — nobody's box raises "output stepped down in March", because no inverter
 * can see the months either side of it.
 *
 * `AlertsSection` established the rule that matters: a reader has to be able to
 * tell at a glance which rows are the panel talking and which are the app's own
 * reasoning, and the register line is what they use to do it. With no register to
 * print, `source` does that job and every card prints it.
 *
 * ## Why an alert names an inverter
 *
 * Because most of them are about one box. "String offline" on a system of ten
 * inverters is useless without an address, and "Inverter not reporting" is a
 * different job depending on whether it is one box or all of them. `inverterId`
 * is `undefined` only for the rules that are genuinely about the whole system —
 * an overdue wash, a plant nobody can hear at all.
 *
 * Severity is shared with the genset module rather than redeclared. The three
 * chips are the *design's*, not the diesel's, and a second three-value union with
 * the same members would eventually be coloured from a second table.
 */
export {ALERT_SEVERITIES};
export type {AlertSeverity};

export type SystemAlert = {
  /** This rule on this system — `kdh-0431-string-out-inv-01`. */
  id: string;
  /** The rule — `string-out` — shared by every system carrying it. */
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  /** The box this is about, or `undefined` for a whole-system rule. */
  inverterId: string | undefined;
  /** `Inverter 4` — what the card prints, so a reader is not decoding an id. */
  inverterLabel: string | undefined;
  /** Key of the reading this watches, or `null` where it watches no dial. */
  readingKey: string | null;
  /** How the rule reads — `< 1 MΩ`. Shown so the verdict has a line behind it. */
  threshold: string;
  /**
   * The same limit as a number on the reading's own scale, or `null` for a rule
   * with no fixed line — a silent inverter is not a height on any axis.
   *
   * Held as a number as well as prose for the reason `GensetAlert.limit` is: a
   * chart draws it, and a threshold you can watch a trace approach is the
   * difference between "there is an alarm" and "here is where it went wrong".
   */
  limit: number | null;
  comparator: '>' | '<';
  /** What is actually true, in a sentence. */
  message: string;
  /** Who is asserting this. See the note above — this is doing the register's job. */
  source: string;
  raisedAt: string;
};

/**
 * The verdict over the health band.
 *
 * The genset's own three words, and the same derivation: worst severity wins and
 * a `NEUTRAL` does not spoil it. Aliased rather than redeclared so the two pages
 * cannot end up with different vocabularies for the same idea — an operator
 * reading `Attention` on a genset and `Degraded` on the system beside it would
 * reasonably assume the two meant different things.
 */
export type SystemCondition = GensetCondition;

export const systemCondition = (alerts: Array<SystemAlert>): SystemCondition => {
  if (alerts.some((alert) => alert.severity === 'CRITICAL')) return 'CRITICAL';
  return alerts.some((alert) => alert.severity === 'WARNING') ? 'ATTENTION' : 'OPTIMUM';
};
