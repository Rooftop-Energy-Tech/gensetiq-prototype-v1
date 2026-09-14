import {useMemo} from 'react';

import {FALLBACK_POWER_ROLE, useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {countBySeverity} from '../types/alert.type';
import type {AlertSeverity} from '../types/alert.type';
import type {Genset} from '../types/genset.type';
import type {AlarmHandling} from '../types/alarmState.type';
import type {TrackedAlarm} from '../types/alarmState.type';
import type {AlarmView} from '../types/alarmView.type';
import {standingAlarms, trackedAlarms, useAlarmHandling} from './alarms';
import {plantAlarmQueue} from './assertedAlarms';

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

/**
 * Every set's standing count, by severity — one pass over the fleet.
 *
 * `useEstateAlarmCounts`' shape, over machines rather than yards, and for its
 * reasons: the register draws one pill per row, and a hook per row would be three
 * subscriptions apiece over a thirty-machine fleet, each free to be counting a
 * different moment from the row above it.
 *
 * **What it counts is what the set's own Alarms tab lists**, which is the whole
 * point of it existing: the controller's own bits *plus* the site monitoring unit's
 * rows filed against this set. `GensetHome` records what counting one of them
 * alone did — a strip reading `2` beside a tab listing `4` — and a register column
 * is the same promise made thirty times over.
 *
 * A set with no site sorts to an empty count rather than being dropped: `siteId` is
 * nullable because a machine can sit in the yard unassigned, and it still has a
 * controller that can be asserting something.
 */
export const useFleetAlarmCounts = (
  gensets: ReadonlyArray<Genset>,
): Record<string, Record<AlertSeverity, number>> => {
  const handling = useAlarmHandling();
  const roles = useSitePowerRoles();

  return useMemo(
    () =>
      Object.fromEntries(
        gensets.map((genset) => {
          const controller = standingAlarms(genset.id, handling);
          const plant =
            genset.siteId === null
              ? []
              : plantAlarmQueue(
                  genset.siteId,
                  roles[genset.siteId] ?? FALLBACK_POWER_ROLE,
                  'GENSET',
                  handling,
                ).standing;

          return [genset.id, countBySeverity([...controller, ...plant])];
        }),
      ),
    [gensets, handling, roles],
  );
};
