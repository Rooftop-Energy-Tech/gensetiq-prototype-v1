import {useMemo} from 'react';

import {useSession} from '@/modules/auth/session';
import {AlarmLists} from '@/modules/genset/components/alarms/AlarmLists';
import {useSiteAlarmQueue} from '@/modules/site/data/siteAlarmQueue';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {dayMonth, stampDate} from '@/lib/format';
import type {DeploymentRow} from '../../data/feed';

/**
 * What was raised while this job stood, by the machines on it.
 *
 * ## Why this is the site's queue filtered, and not a new one
 *
 * There is one handling store in this app, keyed on each alarm's own id, and every
 * page that lists alarms lists the same rows out of it. So acknowledging a dropped
 * phase here acknowledges it on the machine's page and on the site's, which is the
 * property the site's Alarms tab was rebuilt to get. A second derivation for this
 * page would be a second opinion about what is wrong.
 *
 * The filter is two clauses: the alarm belongs to a machine on this job, and it
 * stood at some point inside the job's window — raised before the window closed,
 * and not cleared before it opened. It was *raised inside* the window until
 * 2026-10-05, which hid a service that fell overdue the week before the lorry left
 * and was still overdue on site.
 *
 * ## What this page cannot do, said plainly
 *
 * **Alarms in this prototype are a live state rather than a log.** The rows are what
 * is asserting now, so a job that closed last month has nothing to show, and that is
 * honest rather than empty: the record of what its controllers were saying in August
 * is not in the fixtures. The page says so instead of drawing an empty table that
 * reads as a quiet fortnight.
 *
 * A monitoring-unit register is keyed on the **site** rather than on a machine, so
 * those rows are the yard's rather than this job's and are left out here. They show
 * on each machine's own Alarms tab instead; the site's tab that held them is gone.
 */
export const DeploymentAlarms = ({row, now}: {row: DeploymentRow; now: number}) => {
  const queue = useSiteAlarmQueue(row.deployment.siteId, now);
  const session = useSession();
  const by = session?.email ?? 'operator';

  const onJob = useMemo(
    () => row.members.map((member) => member.membership.gensetId),
    [row.members],
  );

  const inWindow = (alarm: AlarmView) => {
    const raised = new Date(alarm.raisedAt).getTime();
    const cleared =
      alarm.handling.clearedAt === null ? Number.POSITIVE_INFINITY : new Date(alarm.handling.clearedAt).getTime();
    return raised <= row.endedMs && cleared >= row.startedMs;
  };

  const mine = (id: string) => onJob.some((gensetId) => id.startsWith(gensetId));

  const standing = queue.standing.filter((alarm) => mine(alarm.id) && inWindow(alarm));
  const cleared = queue.cleared.filter((alarm) => mine(alarm.id) && inWindow(alarm));

  if (row.state === 'planned') {
    return (
      <div className="flex flex-col gap-2 overflow-y-auto px-4 pt-4 pb-6">
        <h2 className="text-base font-medium text-primary">Alarms</h2>
        <p className="max-w-2xl text-sm text-secondary">
          This deployment starts on {stampDate(row.deployment.startsAt)}. Nothing can be asserting
          against a deployment whose machines have not arrived.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-4 pt-4 pb-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-primary">
          Alarms
          <span className="font-normal text-secondary">
            {' · '}
            {dayMonth(row.startedMs)} to {row.state === 'active' ? 'now' : dayMonth(row.endedMs)}
          </span>
        </h2>
        <p className="max-w-2xl text-sm text-secondary">
          What stood against the machines on {row.deployment.reference} inside its window: their
          controllers&rsquo; alarms, and the app&rsquo;s own for a low tank or a service falling due.
          Clearing a row here clears it on the machine&rsquo;s own tab too: one queue, one set of rows.
        </p>
      </div>

      {standing.length === 0 && cleared.length === 0 ? (
        <p className="rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
          {row.state === 'active'
            ? 'Nothing standing. The controllers on this deployment are reporting and asserting nothing.'
            : 'Nothing on the record for this window. Alarms here are a live view of what is asserting now, so a closed deployment usually has none.'}
        </p>
      ) : (
        <AlarmLists standing={standing} cleared={cleared} by={by} subject="this deployment" />
      )}
    </div>
  );
};
