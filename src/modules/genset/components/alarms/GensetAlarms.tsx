import {useSession} from '@/modules/auth/session';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {ALERT_SEVERITIES} from '../../types/alert.type';
import {byUrgency, isStanding} from '../../types/alarmState.type';
import type {AlarmView} from '../../types/alarmView.type';
import {assertedPlantAlarms, plantAlarmsWatched} from '../../data/assertedAlarms';
import {controllerAlarms} from '../../data/alarmViews';
import {useAlarmHandling} from '../../data/alarms';
import type {Genset} from '../../types/genset.type';
import {AlarmLists} from './AlarmLists';

/**
 * The Alarms tab — every alarm this genset is carrying, and what has been done
 * about each one.
 *
 * ## What this page is, against the home page's alerts band
 *
 * The home page answers *is anything wrong right now*, mixes the register map's
 * alarms with the app's own rows — a leak, a low tank, a service falling due — and
 * files them under the operator's tags. This page answers *what is the state of
 * the alarm list*, and is the only screen where an alarm can be acted on. The two
 * read from one store so they cannot disagree about which are standing.
 *
 * ## Two devices, one list
 *
 * The set's own controller is not the only thing watching it. Where a site has a
 * **monitoring unit** on its DC plant and no utility incomer, the nine per-phase AC
 * registers that unit polls are about this machine's output — the generator is the
 * only AC source on the yard, so a phase failure there is a dropped phase on this
 * engine. Those rows are merged into one queue rather than banded underneath,
 * because a reader asking *what is this set carrying* should not have to scan two
 * lists and hope the worse row is in the upper one.
 *
 * They are told apart on the row, not by position: each names the device asserting
 * it and carries that device's own protection class. And they stop here — see
 * `assertedAlarms.ts` on why a register nobody has read must not colour the estate
 * map.
 *
 * ## What is not here
 *
 * The threshold rules behind the controller's alarms. They are panel configuration
 * — the voltage window this box treats as over-voltage — and this prototype has
 * never read one. Guessing them on a settings screen would be the app asserting a
 * setpoint nobody has confirmed. Ticketing, assignment to a named engineer and
 * notification routing are likewise absent: they are the layer above
 * acknowledgement, and they need a decision about who gets told and how before they
 * are worth drawing.
 */
export const GensetAlarms = ({genset}: {genset: Genset}) => {
  // Live, so a click on either button redraws this page — and the home page's
  // alerts band and the fleet's counts with it.
  const handling = useAlarmHandling();
  const session = useSession();
  const by = session?.email ?? 'operator';

  /**
   * `''` for a machine standing in the yard rather than on a plinth.
   *
   * It has no site, so no monitoring unit, so no AC rows — the same answer the
   * twenty-four sites without a unit get. Spelled as a fallback rather than a
   * branch because the hook cannot be called conditionally, and `useSitePowerRole`
   * answers the fallback role for an id it has never heard of.
   */
  const siteId = genset.siteId ?? '';
  const role = useSitePowerRole(siteId);

  const rows: Array<AlarmView> = [
    ...controllerAlarms(genset.id, handling),
    ...assertedPlantAlarms(siteId, role, 'GENSET', handling),
  ];

  const standing = rows
    .filter(isStanding)
    .sort(byUrgency((alarm) => ALERT_SEVERITIES.indexOf(alarm.severity)));

  const cleared = rows
    .filter((alarm) => !isStanding(alarm))
    .sort(
      (left, right) =>
        new Date(right.handling.clearedAt ?? 0).getTime() -
        new Date(left.handling.clearedAt ?? 0).getTime(),
    );

  // Nine at a site with a unit and no incomer, and zero everywhere else.
  const watched = plantAlarmsWatched(siteId, role, 'GENSET');

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <AlarmLists
        standing={standing}
        cleared={cleared}
        by={by}
        subject="this genset"
        device="the controller"
      />

      {/* The reconciliation, and it is needed rather than pedantic.

          The site's Alarms tab prints a cross-reference — `Genset 9` — for the rows
          the monitoring unit files against this set, and a reader who has seen that
          number and then finds one or two rows here would reasonably conclude the
          rest have gone missing. They have not: nine registers are watched and the
          unit is asserting these. */}
      {watched > 0 && (
        <p className="max-w-prose text-xs text-tertiary">
          The site's monitoring unit polls {watched} per-phase AC registers against this
          set, because the yard has no utility incomer and the generator is its only AC
          source. Those rows sit in the tables above alongside the controller's own, each
          naming the device that raised it. Declare an incomer on the site's settings tab
          and all {watched} become site alarms instead — a phase is no longer this
          machine's to answer for.
        </p>
      )}
    </div>
  );
};
