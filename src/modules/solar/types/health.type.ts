import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import type {AlertSeverity, GensetCondition} from '@/modules/genset/types/alert.type';

/**
 * What is wrong with a solar system, and where the claim came from.
 *
 * ## Why this is not `GensetAlert`
 *
 * A genset's alert carries a **register and a bit**, because every one of them is
 * a line on a Modbus map and the coordinates are how a reader checks the app
 * against the panel. A PV system has no such sheet: some of these rules are the
 * plant's own telemetry and some are *this app's own arithmetic* over the
 * generation model — nobody's box raises "output stepped down in March", because
 * nothing on the roof can see the months either side of it.
 *
 * The genset's alerts band — deleted 2026-09-14, along with this module's own health
 * band — established the rule that matters: a reader has to be able to
 * tell at a glance which rows are the plant talking and which are the app's own
 * reasoning, and the register line is what they use to do it. With no register to
 * print, `source` does that job and every card prints it.
 *
 * ## Why an alert names no device
 *
 * It used to. Every rule but two carried an `inverterId` and an `inverterLabel`,
 * because on a ten-box plant "String offline" was an alert nobody could act on
 * and `Inverter 4 · 9 of 13 strings` was a job with an address.
 *
 * There are no boxes on a telco site — the array feeds a −48 V DC bus and there
 * is no AC stage to invert to — so there is no address of that kind to give. What
 * an alert can still say is *how many* strings of how many went and *when* the
 * output stepped down, which is the pair that sends somebody up a ladder. The
 * address a technician actually needs is the site, and the site is the page they
 * are already on.
 *
 * Severity is shared with the genset module rather than redeclared. The three
 * chips are the *design's*, not the diesel's, and a second three-value union with
 * the same members would eventually be coloured from a second table.
 */
export {ALERT_SEVERITIES};
export type {AlertSeverity};

export type SystemAlert = {
  /** This rule on this system — `kdh-0431-string-out`. */
  id: string;
  /** The rule — `string-out` — shared by every system carrying it. */
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  /** Key of the reading this watches, or `null` where it watches no dial. */
  readingKey: string | null;
  /** How the rule reads — `> 120 days`. Shown so the verdict has a line behind it. */
  threshold: string;
  /**
   * The same limit as a number on the reading's own scale, or `null` for a rule
   * with no fixed line — a silent system is not a height on any axis.
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
 * The verdict over an array's derived rules.
 *
 * It headed a **health band** on the Alarms tab until 2026-09-14; the band is gone and
 * this is now read by the register's row ordering alone. See `SystemAlarms`.
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
