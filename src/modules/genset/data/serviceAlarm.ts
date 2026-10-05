import {UNHANDLED} from '../types/alarmState.type';
import type {AlarmHandling} from '../types/alarmState.type';
import type {AlarmView} from '../types/alarmView.type';
import {serviceNoticesOf} from './services';

/**
 * A service item falling due, as a standing alarm row (Jeff, 2026-10-05).
 *
 * `ServiceNotice` in `service.type.ts` holds the rule and the argument; this is the
 * adapter into the one row shape every Alarms table, count and verdict reads, the
 * way `lowFuelAlarm.ts` is for the tank.
 *
 * **It ends when the item is done, and not before.** Logging a service with the item
 * ticked moves its counters back to zero and the row goes with them, so there is
 * nothing for a person to clear — clearing would declare an item serviced that is
 * not. It can be *acknowledged* ("seen, booked"), so its handling is read from the
 * same store as every other row, with any `cleared` stamp ignored.
 */
export const serviceAlarms = (
  gensetId: string,
  handling: Record<string, AlarmHandling>,
): Array<AlarmView> =>
  serviceNoticesOf(gensetId).map((notice) => {
    const held = handling[notice.id] ?? UNHANDLED;

    return {
      id: notice.id,
      name: notice.message,
      provenance: `${notice.rule} · ${notice.source}`,
      className: 'Service',
      severity: notice.severity,
      raisedAt: notice.raisedAt,
      // Acknowledgement carries; a clear does not — see the note above.
      handling: {...held, clearedAt: null, clearedBy: null},
      clearable: false,
      endsWhen: 'Clears when serviced',
    };
  });
