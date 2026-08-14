/**
 * Alerts and the tags operators file them under.
 *
 * An alert is a **bit in the controller's alarm map**, and the set of them is
 * closed: it is the Modbus register map's alarm bits marked *To Include in
 * Dashboard*, and nothing else. Each one names its register and bit, so any row
 * on the page can be traced back to the sheet it came from. Invented alarms are
 * not allowed here, however plausible they read.
 *
 * Most of those bits are a **threshold on a reading**: `AL Battery Voltage` is
 * the controller's name for a rule that watches `battery-voltage` and fires
 * below 24 V, which is why an alert can carry a `readingKey` and a `threshold`
 * and the page can show the number that tripped it right underneath the name.
 *
 * Some are not, and `readingKey` is `null` for those. The five `AL Common *`
 * bits are roll-ups over other protections and `Sd Override` is a statement
 * about the panel's configuration; there is no single reading behind either, so
 * the card shows the name and the rule in prose and no value. Forcing a reading
 * onto them would be inventing a measurement to justify a flag.
 *
 * Severity is a property of the rule, so the same reading can carry two rules at
 * different severities (a warning band inside a shutdown band — which is how a
 * controller is actually configured) without either needing to know about the
 * other.
 */

/** Ordered worst-first — this is the sort and the "worst wins" precedence. */
export const ALERT_SEVERITIES = ['CRITICAL', 'WARNING', 'NEUTRAL'] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/**
 * The protection class the register map gives each bit, in the map's own words.
 *
 * Carried alongside `severity` rather than replaced by it because the two are
 * different questions. Severity is how loudly the page should shout, and it has
 * three values because the design has three chips. The type is what the
 * controller will actually *do*, and `Shutdown Alarm` (stop the engine now) is
 * not `Alarm` (open the breaker, cool down) even though both are critical to a
 * reader deciding where to look first. Collapsing them into the severity would
 * lose the distinction the panel is built on.
 */
export const ALARM_TYPES = ['Shutdown Alarm', 'Alarm', 'Warning', 'Info'] as const;

export type AlarmType = (typeof ALARM_TYPES)[number];

/**
 * Type → severity. The only place the mapping is written.
 *
 * Both alarm classes are `CRITICAL`: a set that has shut down and a set that has
 * dropped its breaker are both a call-out. `Info` is `NEUTRAL` — a note, not a
 * problem — which is what keeps `AL Gen Voltage` from turning the condition
 * verdict amber just because the voltage is off nominal.
 */
export const SEVERITY_OF_ALARM_TYPE: Record<AlarmType, AlertSeverity> = {
  'Shutdown Alarm': 'CRITICAL',
  Alarm: 'CRITICAL',
  Warning: 'WARNING',
  Info: 'NEUTRAL',
};

/** Which side of the limit trips the rule. */
export type AlertComparator = '>' | '<';

export type GensetAlert = {
  id: string;
  /** The rule's name as the register map writes it, e.g. `AL Battery Voltage`. */
  name: string;
  /** Modbus register holding the bit, and the bit within it — the sheet's coordinates. */
  register: number;
  bit: number;
  type: AlarmType;
  severity: AlertSeverity;
  /** Key of the `Reading` this rule watches, or `null` for a bit with none. */
  readingKey: string | null;
  /**
   * The limit as a number on the reading's own scale, or `null` for a rule with
   * no fixed line — `Phase imbalance` fires on a 10% *deviation between phases*,
   * which is not a height on the current axis.
   *
   * Held as a number and not only as prose because the analysis chart draws it:
   * a threshold you can see the trace approach is the difference between "there
   * is an alarm" and "here is where it went wrong". `threshold` below is derived
   * from this, never authored beside it, so the line and the label cannot
   * disagree.
   */
  limit: number | null;
  comparator: AlertComparator;
  /** How the rule reads, e.g. `< 24 V`. Shown so the number has a context. */
  threshold: string;
  /** ISO 8601 — when the reading first crossed the threshold. */
  raisedAt: string;
};

/**
 * A user-defined grouping of readings — "Start up", "Coolant", "SLA
 * performance".
 *
 * Tags are the operator's own filing system, not the controller's. Two crews
 * running identical hardware will group it differently depending on what they get
 * called out for, so a tag is a list of reading keys and nothing more. Selecting
 * one is how the alerts section narrows from "everything this machine reports" to
 * "the handful of numbers I care about right now", and it pulls in each reading's
 * alerts along with it.
 */
export type GensetTag = {
  id: string;
  label: string;
  readingKeys: Array<string>;
};

/**
 * The single-word verdict above the alerts section.
 *
 * Derived from the alerts rather than stored, so it cannot drift from them.
 * Worst severity wins, and `NEUTRAL` alerts do not spoil it — a neutral alert is
 * a note (a service coming due), not a problem.
 */
export type GensetCondition = 'OPTIMUM' | 'ATTENTION' | 'CRITICAL';

export const conditionOf = (alerts: Array<GensetAlert>): GensetCondition => {
  if (alerts.some((alert) => alert.severity === 'CRITICAL')) return 'CRITICAL';
  if (alerts.some((alert) => alert.severity === 'WARNING')) return 'ATTENTION';
  return 'OPTIMUM';
};

/** How many alerts sit at each severity — the counts on the three filter chips. */
export const countBySeverity = (
  alerts: Array<GensetAlert>,
): Record<AlertSeverity, number> => {
  const counts: Record<AlertSeverity, number> = {CRITICAL: 0, WARNING: 0, NEUTRAL: 0};
  for (const alert of alerts) counts[alert.severity] += 1;
  return counts;
};

/**
 * The worst severity among a set of alerts, or `undefined` for none.
 *
 * Used to colour a tag chip: a tag whose readings are all inside their
 * thresholds gets the green `ok` glyph, and one with a warning behind it gets
 * amber before anybody clicks it.
 */
export const worstSeverity = (alerts: Array<GensetAlert>): AlertSeverity | undefined =>
  ALERT_SEVERITIES.find((severity) => alerts.some((alert) => alert.severity === severity));
