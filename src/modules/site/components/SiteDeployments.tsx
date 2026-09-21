import {Link} from '@tanstack/react-router';
import {useState} from 'react';

import {Badge} from '@/components/ui/badge';
import {amount, dayMonth, duration} from '@/lib/format';
import {DEPLOYMENT_STATE_META} from '@/modules/deployment/components/stateMeta';
import {jobTotals} from '@/modules/deployment/data/seed';
import {deploymentMembers, deploymentsAtSite, useDeployments} from '@/modules/deployment/data/store';
import {deploymentElapsedMs, deploymentState} from '@/modules/deployment/types/deployment.type';
import {gensetById} from '@/modules/genset/data/deployment';
import {siteLabel} from '../data/siteSeed';

/**
 * Every job that has stood at this yard, newest first.
 *
 * ## The question this section exists for
 *
 * *Have we had a set at Kapit before, and what did it cost?* It is the question asked
 * before quoting one, and until deployments were a record the site could only answer
 * the present tense: what is standing here now. The register can answer it too — its
 * search matches the placename — but a reader who is already on the site should not
 * have to go to a fleet-wide list and filter it back down to the site they left.
 *
 * ## Why the whole record and not only the closed jobs
 *
 * Because "what has been here" includes what is here and what is coming. A reader
 * scanning this list is building a picture of the yard over time, and cutting the
 * standing job out of it would put the one row they can still act on somewhere else.
 * The state badge is what separates them, and it is the same badge the register and
 * the job's own page use.
 */
export const SiteDeployments = ({siteId}: {siteId: string}) => {
  // Live, so a job opened from the Gensets section appears here without a reload.
  useDeployments();
  const [now] = useState(() => Date.now());

  const jobs = deploymentsAtSite(siteId);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-6 py-7">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-primary">Deployments at {siteLabel(siteId)}</h2>
        <p className="max-w-2xl text-sm text-secondary">
          Every job this yard has held, newest first. What each one cost is the same
          figure its own page and the register report.
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="max-w-3xl rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
          Nothing has been deployed here in the period this record covers.
        </p>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-2">
          {jobs.map((job) => {
            const state = deploymentState(job, now);
            const meta = DEPLOYMENT_STATE_META[state];
            const StateIcon = meta.icon;
            const members = deploymentMembers(job.id);
            const totals = jobTotals(job, members, now);

            return (
              <li key={job.id}>
                <Link
                  to="/deployments/$deploymentId"
                  params={{deploymentId: job.id}}
                  className="flex flex-col gap-1.5 rounded-lg border border-subtle bg-element p-3 outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-primary">{job.reference}</span>
                    <Badge variant="element" className="border-subtle">
                      <StateIcon className={meta.iconClassName} aria-hidden="true" />
                      {meta.label}
                    </Badge>
                    <span className="text-[13px] text-secondary">
                      {dayMonth(job.startsAt)}
                      {job.endsAt === null ? ' – ongoing' : ` – ${dayMonth(job.endsAt)}`}
                      {state !== 'planned' && ` · ${duration(deploymentElapsedMs(job, now))}`}
                    </span>
                  </span>

                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-secondary">
                    <span className="truncate">
                      {members.length === 0
                        ? 'No machines'
                        : members
                            .map((member) => gensetById(member.gensetId)?.tag ?? member.gensetId)
                            .join(', ')}
                    </span>
                    {/* A planned job has nothing to report, and a row of zeros would
                        read as a job that stood and did nothing. */}
                    {state !== 'planned' && (
                      <span className="text-tertiary">
                        {amount(totals.runtimeHours, 'h')} on load ·{' '}
                        {amount(totals.fuelBurnedLitres, 'L')} burned
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
