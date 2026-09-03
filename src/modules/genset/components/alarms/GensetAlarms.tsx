import type {ReactNode} from 'react';
import {BellIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {relativeTime, stampAt} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useSession} from '@/modules/auth/session';
import {ALERT_SEVERITIES, countBySeverity} from '../../types/alert.type';
import type {TrackedAlarm} from '../../types/alarmState.type';
import {standingOf} from '../../types/alarmState.type';
import {
  acknowledgeAlarm,
  clearAlarm,
  clearedAlarms,
  orderedStanding,
  reopenAlarm,
  useAlarmHandling,
} from '../../data/alarms';
import type {Genset} from '../../types/genset.type';
import {SEVERITY_META} from '../detail/severityMeta';
import {STANDING_META} from './standingMeta';

const Th = ({children, align}: {children: ReactNode; align?: 'right'}) => (
  <th
    scope="col"
    className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
  >
    {children}
  </th>
);

/**
 * The alarm's own identity — its name, the rule that raised it, and where in the
 * register map it lives.
 *
 * The register line is the same claim of provenance the home page's cards make,
 * and it matters more here than there. This page is the log: a row that gets
 * screenshotted into a message to the panel supplier has to say which bit it came
 * from, or it is one crew's paraphrase of a fault.
 */
const AlarmIdentity = ({alarm}: {alarm: TrackedAlarm}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="font-medium text-primary">{alarm.name}</span>
    <span className="text-xs text-secondary">
      {alarm.threshold} · register {alarm.register} bit {alarm.bit}
    </span>
  </div>
);

/** The controller's protection class, in the severity's colour. Same pairing as `AlertCard`. */
const ClassBadge = ({alarm}: {alarm: TrackedAlarm}) => (
  <Badge variant="element" className="border-subtle whitespace-nowrap">
    <BellIcon className={SEVERITY_META[alarm.severity].textClassName} aria-hidden="true" />
    {alarm.type}
  </Badge>
);

/**
 * One standing alarm, and the two things that can be done to it.
 *
 * **Acknowledge does not remove the row.** That is the behaviour the whole
 * two-axis model exists to produce, and it is the one thing a reader coming from
 * an inbox-shaped UI will not expect: taking an alarm on says a person is dealing
 * with it, not that the engine is well. The row stays, its standing changes, and
 * the name of whoever claimed it appears on it.
 *
 * The buttons are asymmetric on purpose. `Acknowledge` disappears once somebody
 * has, because acknowledging twice is meaningless and the store ignores it
 * anyway; `Clear` is always there, because an alarm can be dealt with by a person
 * who never bothered to claim it first and refusing that would only teach people
 * to click two buttons in a row.
 */
const StandingRow = ({alarm, by}: {alarm: TrackedAlarm; by: string}) => {
  const standing = standingOf(alarm.handling);
  const meta = STANDING_META[standing];
  const StandingIcon = meta.icon;

  return (
    <tr className="border-b border-subtle last:border-b-0">
      <td className="px-3 py-2.5">
        <AlarmIdentity alarm={alarm} />
      </td>
      <td className="px-3 py-2.5">
        <ClassBadge alarm={alarm} />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-secondary">
        {stampAt(alarm.raisedAt)}
        <span className="block text-xs text-tertiary">{relativeTime(alarm.raisedAt)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', meta.textClassName)}>
          <StandingIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {meta.label}
        </span>
        {alarm.handling.acknowledgedBy !== null && (
          <span className="block text-xs text-tertiary">
            by {alarm.handling.acknowledgedBy}
            {alarm.handling.acknowledgedAt !== null &&
              ` · ${relativeTime(alarm.handling.acknowledgedAt)}`}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-2">
          {alarm.handling.acknowledgedAt === null && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => acknowledgeAlarm(alarm.id, by)}
            >
              Acknowledge
            </Button>
          )}
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => clearAlarm(alarm.id, by)}
          >
            Clear
          </Button>
        </div>
      </td>
    </tr>
  );
};

/** One alarm somebody has finished with, and the way back if they were wrong. */
const ClearedRow = ({alarm}: {alarm: TrackedAlarm}) => (
  <tr className="border-b border-subtle last:border-b-0">
    <td className="px-3 py-2.5">
      <AlarmIdentity alarm={alarm} />
    </td>
    <td className="px-3 py-2.5">
      <ClassBadge alarm={alarm} />
    </td>
    <td className="px-3 py-2.5 whitespace-nowrap text-secondary">{stampAt(alarm.raisedAt)}</td>
    <td className="px-3 py-2.5 whitespace-nowrap text-secondary">
      {alarm.handling.clearedAt === null ? '—' : stampAt(alarm.handling.clearedAt)}
      <span className="block text-xs text-tertiary">by {alarm.handling.clearedBy}</span>
    </td>
    <td className="px-3 py-2.5">
      <div className="flex justify-end">
        <Button type="button" size="xs" variant="ghost" onClick={() => reopenAlarm(alarm.id)}>
          Reopen
        </Button>
      </div>
    </td>
  </tr>
);

/**
 * The Alarms tab — every alarm this genset is carrying, and what has been done
 * about each one.
 *
 * ## What this page is, against the home page's alerts band
 *
 * The home page answers *is anything wrong right now*, mixes the register map's
 * alarms with the app's own rows — a leak, a low tank, a service falling due — and
 * files them under the operator's tags. This page answers *what is the state of
 * the alarm list*, carries the register map alone, and is the only screen where
 * an alarm can be acted on. The two are the same alarms seen through different
 * questions, and they read from one store so they cannot disagree about which are
 * standing.
 *
 * ## Two tables, because there are two axes
 *
 * `Standing` holds everything still live, acknowledged or not — clearing is what
 * moves a row out of it, and acknowledging deliberately does not. `Cleared` is the
 * log: what was raised, when it was closed, and by whom. Splitting them is what
 * lets the first table be a work queue rather than a mixture of jobs and receipts.
 *
 * ## What is not here
 *
 * The threshold rules behind these alarms, which the tab's earlier placeholder
 * also promised. They are controller configuration — the voltage window this panel
 * treats as over-voltage — and this prototype has never read one. Guessing them on
 * a settings screen would be the app asserting a setpoint nobody has confirmed.
 * Ticketing, assignment to a named engineer and notification routing are likewise
 * absent: they are the layer above acknowledgement and they need a decision about
 * who gets told and how before they are worth drawing.
 */
export const GensetAlarms = ({genset}: {genset: Genset}) => {
  // Live, so a click on either button redraws this page — and the home page's
  // alerts band and the fleet's counts with it.
  const handling = useAlarmHandling();
  const session = useSession();
  const by = session?.email ?? 'operator';

  const standing = orderedStanding(genset.id, handling);
  const cleared = clearedAlarms(genset.id, handling);
  const counts = countBySeverity(standing);
  const unacknowledged = standing.filter(
    (alarm) => alarm.handling.acknowledgedAt === null,
  ).length;

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-medium text-primary">Alarms</h1>

        {/* The counts, not as filters. The home page's identical-looking chips are
            a single-select filter over a short list; here the list is already
            split into two tables by the thing a reader would filter on, and a
            second filter on top of that split would be two controls fighting over
            one question. */}
        <div className="flex flex-wrap gap-1.5">
          {ALERT_SEVERITIES.map((severity) => (
            <Badge
              key={severity}
              variant="element"
              size="md"
              className={cn('border-subtle', counts[severity] === 0 && 'opacity-50')}
            >
              <BellIcon className={SEVERITY_META[severity].textClassName} aria-hidden="true" />
              <span className="text-secondary">
                {SEVERITY_META[severity].label} {counts[severity]}
              </span>
            </Badge>
          ))}
        </div>
      </div>

      <section aria-label="Standing alarms" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-medium text-primary">Standing</h2>
          {/* The number that decides whether anybody needs to do something. An
              acknowledged alarm has a name against it; an unacknowledged one is
              the backlog, and it is the only count on this page worth stating in
              words rather than leaving to be counted off the rows. */}
          <p className="text-sm text-secondary">
            {standing.length === 0
              ? 'Nothing standing'
              : `${standing.length} standing · ${unacknowledged} unacknowledged`}
          </p>
        </div>

        {standing.length === 0 ? (
          <p className="max-w-prose text-sm text-secondary">
            No alarms are standing against this genset. That means none are standing{' '}
            <em>in this browser</em> — the panel is polled, and an alarm cleared here is
            cleared for whoever cleared it.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle text-xs text-secondary">
                  <Th>Alarm</Th>
                  <Th>Class</Th>
                  <Th>Raised</Th>
                  <Th>Standing</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {standing.map((alarm) => (
                  <StandingRow key={alarm.id} alarm={alarm} by={by} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Cleared alarms" className="flex flex-col gap-3">
        <h2 className="text-base font-medium text-primary">Cleared</h2>

        {cleared.length === 0 ? (
          <p className="max-w-prose text-sm text-secondary">
            Nothing has been cleared on this genset yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle text-xs text-secondary">
                  <Th>Alarm</Th>
                  <Th>Class</Th>
                  <Th>Raised</Th>
                  <Th>Cleared</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {cleared.map((alarm) => (
                  <ClearedRow key={alarm.id} alarm={alarm} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* The limit, named on the screen rather than left to be discovered.

          On a live panel a fault still asserting its bit raises again on the next
          poll, which is what makes a manual clear safe: it disposes of a stale
          alarm and cannot hide a live one. Here the bits are a fixture built at
          module load and never change, so a cleared alarm stays cleared. That is
          the one place this page's behaviour parts company with the thing it is
          modelled on, and a reader deciding whether to trust the Standing count
          needs to know it. */}
      <p className="max-w-prose text-xs text-tertiary">
        Acknowledging records that somebody has taken an alarm on; it does not clear it.
        Clearing marks it finished with. Neither reaches the controller — this prototype has
        no write path to the panel, and on a live system an alarm whose fault is still
        present would raise again at the next poll. Here the register bits are fixed, so a
        cleared alarm stays cleared until it is reopened.
      </p>
    </div>
  );
};
