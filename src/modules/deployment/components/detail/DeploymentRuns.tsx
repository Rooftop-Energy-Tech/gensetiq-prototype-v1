import {Link} from '@tanstack/react-router';
import {useMemo} from 'react';

import {amount, clockTime, dayMonth, duration, stampDate} from '@/lib/format';
import {runsInWindow} from '@/modules/genset/data/history';
import type {GensetRun} from '@/modules/genset/types/run.type';
import type {DeploymentRow} from '../../data/feed';

/**
 * What the machines on this job actually ran, inside its window.
 *
 * ## Why this is not the runs panel the other two levels use
 *
 * A genset's runs section and a site's both wrap `RunsPanel`, which carries a range
 * picker: the reader chooses seven days, thirty, or a calendar span. That control is
 * the wrong one here, because **the window is the job** — the whole reason a
 * deployment is a first-class record is that its span is exact where a calendar is
 * day-granular. Offering a picker would invite a reader to choose a range that means
 * nothing and to read totals that reconcile with no record.
 *
 * So the window is fixed and stated, the log is the runs inside it, and the totals
 * under the heading are the same figures the register's row and the job's home page
 * report. Three screens, one derivation: see `jobTotals`.
 *
 * ## The energy figure, and the trap it shares with the site page
 *
 * A job's total is the energy its **sets produced**, which is not the energy the
 * **site received**: only one set is on the bus at a time, and a second set turning
 * while isolated delivered nothing to the load. The page says which of the two it is
 * reporting rather than picking one silently, which is the site page's own rule.
 */
type Row = {run: GensetRun; tag: string; gensetId: string};

export const DeploymentRuns = ({row, now}: {row: DeploymentRow; now: number}) => {
  const from = row.startedMs;
  const to = Math.min(row.endedMs, now);

  const rows = useMemo(() => {
    const collected: Array<Row> = [];

    for (const member of row.members) {
      // Each machine's own end, so a set collected on day nine does not pick up runs
      // from the days after it went home.
      const memberTo =
        member.membership.collectedAt === null
          ? to
          : Math.min(new Date(member.membership.collectedAt).getTime(), to);

      for (const run of runsInWindow(member.membership.gensetId, from, memberTo)) {
        collected.push({run, tag: member.tag, gensetId: member.membership.gensetId});
      }
    }

    // Newest first, which is every run log in this app.
    return collected.sort((a, b) => b.run.startedAt.localeCompare(a.run.startedAt));
  }, [row.members, from, to]);

  if (row.state === 'planned') {
    return (
      <div className="flex flex-col gap-2 overflow-y-auto px-6 py-7">
        <h2 className="text-sm font-medium text-primary">Runs</h2>
        <p className="max-w-2xl text-sm text-secondary">
          This job starts on {stampDate(row.deployment.startsAt)}. Nothing has run on it,
          because nothing has been delivered yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-6 py-7">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-primary">
          Runs
          <span className="font-normal text-secondary">
            {' · '}
            {dayMonth(from)} to {row.state === 'active' ? 'now' : dayMonth(row.endedMs)}
          </span>
        </h2>
        <p className="max-w-2xl text-sm text-secondary">
          Every run the machines on {row.deployment.reference} started inside its window.
          {' '}
          {amount(row.totals.runtimeHours, 'hrs')} on load ·{' '}
          {amount(row.totals.energyKwh, 'kWh')} produced ·{' '}
          {amount(row.totals.fuelBurnedLitres, 'L')} burned. Energy is what the sets
          produced rather than what the site drew: only one set is on the bus at a time.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="max-w-3xl rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
          No runs inside this window. The machines stood and did not turn.
        </p>
      ) : (
        <div className="max-w-3xl overflow-x-auto rounded-md border border-subtle">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Runs inside {row.deployment.reference}, newest first
            </caption>
            <thead>
              <tr>
                {['Genset', 'Started', 'Ran for', 'Energy', 'Fuel'].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="h-10 border-b border-subtle bg-canvas px-3 text-left font-medium whitespace-nowrap text-secondary"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({run, tag, gensetId}) => {
                const started = new Date(run.startedAt).getTime();
                const ended = run.endedAt === null ? now : new Date(run.endedAt).getTime();

                return (
                  <tr key={run.id}>
                    <td className="h-12 border-b border-subtle px-3 font-medium">
                      <Link
                        to="/gensets/$gensetId"
                        params={{gensetId}}
                        className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {tag}
                      </Link>
                    </td>
                    <td className="h-12 border-b border-subtle px-3 whitespace-nowrap text-primary">
                      {dayMonth(started)} · {clockTime(started)}
                    </td>
                    <td className="h-12 border-b border-subtle px-3 whitespace-nowrap text-primary">
                      {/* An open run is measured to now and said to be running, which
                          is the run log's own treatment of it. */}
                      {duration(ended - started)}
                      {run.endedAt === null && (
                        <span className="text-tertiary"> · running</span>
                      )}
                    </td>
                    <td className="h-12 border-b border-subtle px-3 whitespace-nowrap text-primary">
                      {amount(run.energyProducedKwh, 'kWh')}
                    </td>
                    <td className="h-12 border-b border-subtle px-3 whitespace-nowrap text-primary">
                      {amount(run.fuelConsumedLitres, 'L')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
