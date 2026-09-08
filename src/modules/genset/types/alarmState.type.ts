import type {GensetAlert} from './alert.type';

/**
 * What an operator has *done about* an alarm, held apart from what the alarm is.
 *
 * ## Two axes, not one status
 *
 * Acknowledgement and clearance answer different questions and neither implies
 * the other. **Acknowledged** says a person has seen it and taken it on; the bit
 * may still be set. **Cleared** says the condition is finished with; nobody need
 * ever have looked. A set can trip, recover and be cleared by its own controller
 * with no human involved, and a technician can acknowledge a coolant alarm at
 * 2am and still be driving to it at four.
 *
 * Every platform worth copying models it this way. Huawei's FusionSolar tracks
 * `Unacked → Acked` on one axis and active → cleared on the other, and SolarEdge
 * writes the product of the two out longhand — `Open`, `Open muted`, `Closed`,
 * `Closed muted`. Collapsing them into a single enum is the mistake that loses
 * the distinction, so the two live here as two nullable stamps and the one word
 * a reader sees is derived from them rather than stored beside them.
 *
 * ## Why stamps and names rather than booleans
 *
 * `acknowledged: true` cannot answer *since when* or *by whom*, which are the
 * two questions asked of an acknowledgement the moment there is more than one
 * name on the rota — and the second is the whole reason to record one at all. The
 * stamp costs nothing and the boolean is one `!== null` away.
 */
export type AlarmHandling = {
  /** ISO 8601 — when somebody took it on, or `null` if nobody has. */
  acknowledgedAt: string | null;
  /** Who did. The session's email, which is all this prototype has for a name. */
  acknowledgedBy: string | null;
  /** ISO 8601 — when it was cleared, or `null` while it still stands. */
  clearedAt: string | null;
  clearedBy: string | null;
};

/** An alarm nobody has touched — the state every alarm starts in. */
export const UNHANDLED: AlarmHandling = {
  acknowledgedAt: null,
  acknowledgedBy: null,
  clearedAt: null,
  clearedBy: null,
};

/**
 * The register map's alarm with the operator's handling of it attached.
 *
 * A join rather than a field on `GensetAlert`, because the two halves have
 * different owners and different lifetimes. The alarm is derived from the Modbus
 * bits at module load and is the same for everyone; the handling is one browser's
 * record of what its user did. Writing handling into `GensetAlert` would put a
 * mutable per-user value inside the fixture the analysis chart draws its
 * threshold lines from.
 */
export type TrackedAlarm = GensetAlert & {handling: AlarmHandling};

/**
 * The single word for a row, worst-first.
 *
 * Three values rather than four, because `cleared and unacknowledged` and
 * `cleared and acknowledged` are the same thing to a reader scanning a log: the
 * alarm is over. Who acknowledged it before it went is still on the row, in the
 * column that says so.
 */
export const ALARM_STANDINGS = ['UNACKNOWLEDGED', 'ACKNOWLEDGED', 'CLEARED'] as const;

export type AlarmStanding = (typeof ALARM_STANDINGS)[number];

export const standingOf = (handling: AlarmHandling): AlarmStanding =>
  handling.clearedAt !== null
    ? 'CLEARED'
    : handling.acknowledgedAt !== null
      ? 'ACKNOWLEDGED'
      : 'UNACKNOWLEDGED';

/**
 * Still standing — the test the whole app asks, and the reason this file exists.
 *
 * Typed on the one field it reads rather than on `TrackedAlarm`, so a row that
 * carries a handling without being a controller bit passes through it too. The
 * genset's Alarms page now shows two kinds of row in one table — its own register
 * map's bits, and the registers the site's monitoring unit watches on the same
 * set's AC output — and both are standing or cleared by the same question.
 */
export const isStanding = (alarm: {handling: AlarmHandling}): boolean =>
  alarm.handling.clearedAt === null;

/**
 * Sort for the active list: unacknowledged first, then worse severity first.
 *
 * Acknowledgement leads the ordering rather than severity, which is the one
 * arguable call here. The list is a work queue and an acknowledged critical
 * already has somebody's name against it; an unacknowledged warning does not, and
 * a row nobody has claimed is the row worth putting at the top. Severity still
 * decides everything within each half.
 */
export const byUrgency = <Alarm extends {handling: AlarmHandling}>(
  severityRank: (alarm: Alarm) => number,
): ((left: Alarm, right: Alarm) => number) => {
  const claimed = (alarm: Alarm) => (alarm.handling.acknowledgedAt === null ? 0 : 1);

  return (left, right) =>
    claimed(left) - claimed(right) || severityRank(left) - severityRank(right);
};
