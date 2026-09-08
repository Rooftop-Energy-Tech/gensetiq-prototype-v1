import type {AlarmHandling} from '../types/alarmState.type';
import type {TrackedAlarm} from '../types/alarmState.type';
import type {AlarmView} from '../types/alarmView.type';
import {trackedAlarms} from './alarms';

/**
 * A controller bit as a table row.
 *
 * ## Why this moved out of the component
 *
 * It was a local `viewOf` in `GensetAlarms.tsx` for as long as one page rendered
 * these. Two do now — the set's own Alarms tab, and the **site's**, which pools
 * every alarm on the yard from all four assets and three devices. A second copy
 * of the adapter is a second chance for the same bit to print its rule one way here
 * and another way there, in the one column whose whole job is to say where a row
 * came from.
 *
 * It is not a method on `TrackedAlarm` for the reason it never was: the alert type
 * is the fixture the analysis chart draws its threshold lines from, and a
 * presentation shape belongs to the presentation. The monitoring unit's adapter sits
 * in `assertedAlarms.ts` and the solar rules' in `solarAlarmQueue.ts`, both for the
 * same reason.
 */
export const controllerView = (alarm: TrackedAlarm): AlarmView => ({
  id: alarm.id,
  name: alarm.name,
  provenance: `${alarm.threshold} · register ${alarm.register} bit ${alarm.bit}`,
  className: alarm.type,
  severity: alarm.severity,
  raisedAt: alarm.raisedAt,
  handling: alarm.handling,
});

/**
 * Every bit this set's own controller is carrying, standing or cleared, as rows.
 *
 * `asset` is applied by the caller rather than here: on the set's own page there is
 * nothing to say — the page is about one machine — and on the site's page every row
 * needs it. See `AlarmView.asset`.
 */
export const controllerAlarms = (
  gensetId: string,
  handling: Record<string, AlarmHandling>,
): Array<AlarmView> => trackedAlarms(gensetId, handling).map(controllerView);
