import {assertedPlantAlarms} from '@/modules/genset/data/assertedAlarms';
import {UNHANDLED, byUrgency, isStanding} from '@/modules/genset/types/alarmState.type';
import type {AlarmHandling} from '@/modules/genset/types/alarmState.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import type {SystemAlert} from '../types/health.type';
import type {SolarSystem} from '../types/system.type';
import type {SystemDetail} from './systemDetail';
import {systemAlerts} from './systemHealth';

/**
 * Every alarm an array is carrying, from both the things that can raise one.
 *
 * ## Why this exists
 *
 * Because two screens count the same rows and they were giving different answers.
 * The system's home page printed `1` in its strip — the app's own overdue-wash rule
 * — while the Alarms tab listed `2` off the monitoring unit, and neither number was
 * wrong about its own source. A reader has no way to know that, and a summary that
 * disagrees with the page it summarises trains people to ignore both.
 *
 * So the union is computed **once, here**, and the strip, the register's row and the
 * two tables are readings of one list. `plantAlarmQueue` is the same pattern for the
 * bank; this is that plus the derived rules, which only the array has.
 *
 * ## The two sources, and why they still read apart on the row
 *
 * A **register** is a device's own claim — an address on the Huawei SMU02C, nothing
 * in between. A **derived** row is this app's arithmetic over the generation model:
 * nothing on the roof can see that output stepped down in March, or that a wash is
 * 176 days overdue. `health.type.ts` argues that distinction at length and it is not
 * softened by merging the lists — the `Class` column says `Derived` where the app is
 * the one talking, and the line under the name names the rule rather than a device.
 *
 * Merged rather than banded, for the reason the genset's two devices are: a reader
 * asking *what is this array carrying* should not have to scan two lists and hope the
 * worse row is in the upper one.
 *
 * ## What merging them costs
 *
 * A derived row becomes clearable, and clearing it hides a condition the arithmetic
 * still says is true — the wash is still overdue tomorrow. That is a real loss and it
 * is the same one the controller's own bits already carry: the fixture never changes,
 * so nothing raises again at the next poll. `AlarmLists` states it at the foot of the
 * page in those words, which is why it belongs to that component and not to a comment
 * here.
 */

/**
 * A derived rule as a row.
 *
 * `provenance` keeps the shape both device sources use — rule first, then who is
 * asserting it — so a reader scanning the column does not change how they read it
 * halfway down. Where the others name a box and a register, this names the rule that
 * fired, because that is the whole of what there is to name.
 */
const viewOf = (
  alert: SystemAlert,
  handling: Record<string, AlarmHandling>,
): AlarmView => ({
  id: alert.id,
  name: alert.name,
  provenance: `${alert.threshold} · ${alert.source}`,
  // Not a protection class, because no device graded this one. The word is the
  // honest answer to the column's question and it is what tells the two kinds of
  // row apart at a glance.
  className: 'Derived',
  severity: alert.severity,
  raisedAt: alert.raisedAt,
  handling: handling[alert.id] ?? UNHANDLED,
});

export const solarAlarmRows = (
  system: SolarSystem,
  detail: SystemDetail,
  now: number,
  handling: Record<string, AlarmHandling>,
): Array<AlarmView> => [
  ...systemAlerts(system, detail, now).map((alert) => viewOf(alert, handling)),
  // A system's id is its site's — one array per site, feeding one −48 V bus.
  ...assertedPlantAlarms(system.id, system.role, 'SOLAR', handling),
];

/**
 * The rows split into the two tables, each ordered as its table wants.
 *
 * `standing` is what the strip counts and what the queue shows, so clearing a row on
 * the tab drops the count on the home page — the behaviour a reader checks first.
 */
export const solarAlarmQueue = (
  system: SolarSystem,
  detail: SystemDetail,
  now: number,
  handling: Record<string, AlarmHandling>,
): {standing: Array<AlarmView>; cleared: Array<AlarmView>} => {
  const rows = solarAlarmRows(system, detail, now, handling);

  return {
    // Unclaimed first, then worse severity first — the work-queue ordering.
    standing: rows
      .filter(isStanding)
      .sort(byUrgency((alarm) => ALERT_SEVERITIES.indexOf(alarm.severity))),
    // Most recently dealt with first — the log ordering.
    cleared: rows
      .filter((alarm) => !isStanding(alarm))
      .sort(
        (left, right) =>
          new Date(right.handling.clearedAt ?? 0).getTime() -
          new Date(left.handling.clearedAt ?? 0).getTime(),
      ),
  };
};
