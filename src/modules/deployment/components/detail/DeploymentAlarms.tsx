import {useMemo} from 'react';

import {useSession} from '@/modules/auth/session';
import {AlarmLists} from '@/modules/genset/components/alarms/AlarmLists';
import {useSiteAlarmQueue} from '@/modules/site/data/siteAlarmQueue';
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
 * The filter is two clauses: the alarm belongs to a machine on this job, and it was
 * raised inside the job's window.
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

  const inWindow = (raisedAt: string) => {
    const at = new Date(raisedAt).getTime();
    return at >= row.startedMs && at <= row.endedMs;
  };

  const mine = (id: string) => onJob.some((gensetId) => id.startsWith(gensetId));

  const standing = queue.standing.filter((alarm) => mine(alarm.id) && inWindow(alarm.raisedAt));
  const cleared = queue.cleared.filter((alarm) => mine(alarm.id) && inWindow(alarm.raisedAt));

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
          What the controllers on {row.deployment.reference} raised inside its window. Clearing a
          row here clears it on the machine&rsquo;s own tab too: one queue, one set of rows.
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
