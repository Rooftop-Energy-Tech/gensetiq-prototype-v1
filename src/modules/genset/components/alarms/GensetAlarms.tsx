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
 * ## The tables are the whole tab
 *
 * There was a second band above them — the **alerts section**, the one that used to
 * close the genset's home page: the register map's alarms mixed with the app's own
 * rows, a leak, a low tank, a service falling due, each drawn as a card against the
 * reading and the line it crossed, under a row of category chips that filtered it.
 * It came off on 2026-09-14 (Tristan), and the tables below are what this tab is now.
 *
 * It was a **second rendering of the same list** — the band and the tables read one
 * store, so they could never disagree about the facts, and a reader arriving here met
 * the same alarms twice in two shapes, the upper of which could not be acted on. The
 * tables can: acknowledging and clearing live there, they carry the provenance and
 * the class, and they hold the cleared log as well as what is standing. A diagnosis
 * you cannot act on, printed above the thing you act on, is a screen's worth of
 * scrolling between a reader and the control.
 *
 * The band's category chips went with it. The tables have their own filters — by
 * severity and by asset — which is the filtering this tab actually needed, and the
 * search parameter that carried the band's chip selection went too: a URL that names
 * a filter nothing applies is worse than no URL state.
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
  // Live, so a click on either button redraws this page — these tables, the home
  // page's alarm counts and the fleet's with it.
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
