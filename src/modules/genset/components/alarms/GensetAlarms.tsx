import {useState} from 'react';

import {useSession} from '@/modules/auth/session';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {ALERT_SEVERITIES} from '../../types/alert.type';
import {byUrgency, isStanding} from '../../types/alarmState.type';
import type {AlarmView} from '../../types/alarmView.type';
import type {AlertFocus} from '../../types/detailView.type';
import {assertedPlantAlarms, plantAlarmsWatched} from '../../data/assertedAlarms';
import {controllerAlarms} from '../../data/alarmViews';
import {standingAlarms, useAlarmHandling} from '../../data/alarms';
import type {GensetDetail} from '../../data/detail';
import {gensetCondition, useFuelIntegrity} from '../../data/fuelIntegrity';
import {useServiceStatus} from '../../data/services';
import {fuelLeakNotice} from '../../types/fuelIntegrity.type';
import {fuelLevelNotice} from '../../types/fuelLevel.type';
import {serviceNotice} from '../../types/service.type';
import type {Genset} from '../../types/genset.type';
import {AlertsSection} from '../detail/AlertsSection';
import {AlarmLists} from './AlarmLists';

/**
 * The Alarms tab — every alarm this genset is carrying, and what has been done
 * about each one.
 *
 * ## Two readings of one list, on one page
 *
 * The alerts band used to close the genset's home page, and it is the first thing
 * here now. It answers *is anything wrong right now* — the register map's alarms
 * mixed with the app's own rows, a leak, a low tank, a service falling due, filed
 * under the operator's tags and each card drawn against the reading and the line it
 * crossed. The tables under it answer *what is the state of the alarm list*, and
 * are the only place an alarm can be acted on.
 *
 * They were a page apart and they read from one store, so they could never
 * disagree — but a reader who had just read the band still had to walk to this tab
 * to do anything about it, and the home page was spending its last screen restating
 * a count its own strip had already given at the top. Together, the diagnosis is
 * directly above the log it is a diagnosis of.
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
export const GensetAlarms = ({
  genset,
  detail,
  focus,
  onFocusChange,
}: {
  genset: Genset;
  detail: GensetDetail;
  focus: AlertFocus;
  onFocusChange: (focus: AlertFocus) => void;
}) => {
  // Live, so a click on either button redraws this page — the band above the
  // tables, the home page's alarm counts and the fleet's with it.
  const handling = useAlarmHandling();

  // One clock reading for the page, so the band's ages and the tables' cannot land
  // either side of a minute boundary. Every screen in this app that shows a
  // relative time does this.
  const [now] = useState(() => Date.now());
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

  // Live for the reason the store above is: a service logged on the Service tab has
  // to clear the overdue notice in the band without a reload, and switching the leak
  // alarm off on Settings has to move the verdict beside it.
  const service = useServiceStatus(genset.id, now);
  const integrity = useFuelIntegrity(genset.id, now);

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      {/* The band the home page used to close on — thresholds and the numbers
          behind them.

          Above the tables rather than below them. It is the shorter read and the
          one that says whether anything needs doing; the tables are what a reader
          turns to having decided that something does. It is deliberately **not**
          given the monitoring unit's AC rows: every card in it prints the register,
          the reading and the line the reading crossed, and this prototype has read
          none of those registers — so there is no reading to draw. They are in the
          tables below, which is what the note at the foot of this page says. */}
      <AlertsSection
        detail={detail}
        alerts={standingAlarms(genset.id, handling)}
        service={service}
        notice={serviceNotice(genset.id, service)}
        leak={fuelLeakNotice(genset.id, integrity)}
        fuelLevel={fuelLevelNotice(genset)}
        condition={gensetCondition(genset.id, now)}
        focus={focus}
        onFocusChange={onFocusChange}
      />

      <hr className="border-subtle" />

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
