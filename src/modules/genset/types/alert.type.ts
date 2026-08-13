/**
 * Alerts and the tags operators file them under.
 *
 * An alert is a **threshold on a reading**, not an event. `Undervoltage` is the
 * name of a rule that watches `battery-voltage` and fires below 24 V; it is not
 * a log line saying the voltage dropped. That is why an alert carries a
 * `readingKey` and a `threshold` — and why the page can always show the number
 * that tripped it right underneath the alert's name. An alert with no reading
 * behind it would be unfalsifiable.
 *
 * Severity is a property of the rule, so the same reading can carry two rules at
 * different severities (a warning band and a critical band) without either
 * needing to know about the other.
 */

/** Ordered worst-first — this is the sort and the "worst wins" precedence. */
export const ALERT_SEVERITIES = ['CRITICAL', 'WARNING', 'NEUTRAL'] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export type GensetAlert = {
  id: string;
  /** The rule's operator-facing name, e.g. `Undervoltage`. */
  name: string;
  severity: AlertSeverity;
  /** Key of the `Reading` this rule watches. */
  readingKey: string;
  /** How the rule is written, e.g. `< 24 V`. Shown so the number has a context. */
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
