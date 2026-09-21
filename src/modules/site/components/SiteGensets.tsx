import {useId, useState} from 'react';
import {Link, useNavigate} from '@tanstack/react-router';
import {ArrowRightIcon, BoomBoxIcon, PlusIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {dayMonth, duration} from '@/lib/format';
import {cn} from '@/lib/utils';
import {DEPLOYMENT_STATE_META} from '@/modules/deployment/components/stateMeta';
import {
  createDeployment,
  deploymentMembers,
  deploymentsAtSite,
  useDeployments,
} from '@/modules/deployment/data/store';
import {deploymentElapsedMs, deploymentState} from '@/modules/deployment/types/deployment.type';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {useFleet} from '@/modules/genset/data/deployment';
import type {SiteSummary} from '../data/sites';

/**
 * Which gensets stand at this site, and the job each one is here under.
 *
 * ## What replaced the attach picker, and why
 *
 * This section used to carry an `Attach genset` picker that moved a machine on
 * click. It was the only way to place plant, and it wrote membership with **no
 * window**: a machine was at a yard, with nothing recording since when or for how
 * long. That is the gap the deployment model closes, so the control is gone and this
 * section is a *reading* of the jobs standing here.
 *
 * A machine is now at a yard **because a job put it there**, which means the only
 * honest control on a site is one that starts a job. That is the button at the
 * bottom: it opens a deployment at this site and sends the reader to its Gensets
 * section, which is where machines go on. Two steps, and they are the two steps the
 * work actually has — the job is agreed with a customer, and the sets are found
 * afterwards.
 *
 * Where a job is already standing here, the primary way in is that job rather than a
 * new one: adding a fourth set to a five-week hire is the common case, and starting a
 * second job at the same yard for it would split one hire into two records.
 *
 * ## Why collecting is not offered here at all
 *
 * Because collecting a machine is an act on the job rather than on the yard: the
 * membership closes, the machine leaves and nothing moves. A `Detach` button on a
 * site would be the old model's control with the new model's data underneath it,
 * which is exactly how a page starts disagreeing with the record it draws.
 */
export const SiteGensets = ({summary}: {summary: SiteSummary}) => {
  const fleet = useFleet();
  const navigate = useNavigate();
  const ids = useId();
  const [opening, setOpening] = useState(false);
  const [endsAt, setEndsAt] = useState('');

  // The record, live: opening a job here has to show up without a reload.
  useDeployments();
  const [now] = useState(() => Date.now());

  const {site} = summary;

  // Standing and booked, because both are things about this yard a reader needs. The
  // closed ones are the site's Deployments section, which is the history.
  const jobs = deploymentsAtSite(site.id).filter(
    (job) => deploymentState(job, now) !== 'completed',
  );
  const standing = jobs.filter((job) => deploymentState(job, now) === 'active');

  const open = () => {
    const job = createDeployment({
      siteId: site.id,
      startsAt: new Date(now).toISOString(),
      endsAt: endsAt === '' ? null : new Date(`${endsAt}T12:00:00`).toISOString(),
    });
    // Straight to where the machines go on: a job with nothing on it is a page
    // waiting to be filled, and leaving the reader here would make them find it.
    void navigate({
      to: '/deployments/$deploymentId/gensets',
      params: {deploymentId: job.id},
    });
  };

  return (
    <section aria-labelledby="gensets-deployed" className="flex flex-col gap-5 px-6 py-7">
      <div className="flex flex-col gap-1">
        <h2 id="gensets-deployed" className="text-sm font-medium text-primary">
          Gensets deployed here
        </h2>
        <p className="max-w-2xl text-sm text-secondary">
          The machines standing at {site.name}, and the deployment each one is here
          under. A machine is at a yard because a job put it there, so machines go on
          and come off from the job rather than from the site.
        </p>
      </div>

      <div className="flex max-w-3xl flex-col gap-4">
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
            No deployment standing or booked here. Nothing of ours is in this yard.
          </p>
        ) : (
          jobs.map((job) => {
            const state = deploymentState(job, now);
            const meta = DEPLOYMENT_STATE_META[state];
            const StateIcon = meta.icon;
            const members = deploymentMembers(job.id).filter(
              (member) => member.collectedAt === null,
            );

            return (
              <div key={job.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                      to="/deployments/$deploymentId"
                      params={{deploymentId: job.id}}
                      className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                    >
                      {job.reference}
                    </Link>
                    <Badge variant="element" className="border-subtle">
                      <StateIcon className={meta.iconClassName} aria-hidden="true" />
                      {meta.label}
                    </Badge>
                    <span className="text-[13px] text-secondary">
                      {state === 'planned'
                        ? `from ${dayMonth(job.startsAt)}`
                        : `${duration(deploymentElapsedMs(job, now))} standing`}
                    </span>
                  </div>

                  <Button variant="outline" size="sm" asChild>
                    <Link to="/deployments/$deploymentId/gensets" params={{deploymentId: job.id}}>
                      {state === 'active' ? 'Add or collect' : 'Book gensets'}
                      <ArrowRightIcon aria-hidden="true" />
                    </Link>
                  </Button>
                </div>

                {members.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-subtle px-4 py-4 text-center text-[13px] text-secondary">
                    Nothing on this deployment yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {members.map((member) => {
                      const genset = fleet.find((machine) => machine.id === member.gensetId);
                      const runMeta =
                        genset === undefined ? undefined : RUN_STATE_META[genset.runState];
                      const RunIcon = runMeta?.icon;

                      return (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-element p-3"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-highlight">
                              <BoomBoxIcon
                                className="size-[18px] text-secondary"
                                aria-hidden="true"
                              />
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <Link
                                to="/gensets/$gensetId"
                                params={{gensetId: member.gensetId}}
                                className="truncate rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                              >
                                {genset?.tag ?? member.gensetId}
                              </Link>
                              <span className="truncate text-[13px] leading-[18px] text-secondary">
                                {genset?.model ?? ''}
                              </span>
                            </span>
                            {RunIcon !== undefined && runMeta !== undefined && (
                              <Badge variant="element" className="ml-1 shrink-0 border-subtle">
                                <RunIcon
                                  className={cn('size-3', runMeta.iconClassName)}
                                  aria-hidden="true"
                                />
                                {runMeta.label}
                              </Badge>
                            )}
                          </span>

                          <span className="flex shrink-0 items-center gap-3 text-[13px] text-secondary">
                            {/* Worth saying before anybody collects it. The site's
                                draw and its whole diagram hang off whichever set is
                                on the bus. */}
                            {member.gensetId === summary.defaultDutyId && <span>on the bus</span>}
                            <span className="text-tertiary">{member.lorryPlate}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Starting a job here. Secondary where one is already standing, because adding
          to that one is almost always what somebody means. */}
      <div className="flex max-w-3xl flex-col gap-2">
        {opening ? (
          <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-element p-3">
            <p className="text-sm font-medium text-primary">Start a deployment at {site.name}</p>
            <p className="text-[13px] text-secondary">
              It opens today. Machines go on from the deployment&rsquo;s own Gensets
              section, which is where you land next.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-ends`} className="text-[13px] font-medium text-primary">
                  Agreed end
                </label>
                <Input
                  id={`${ids}-ends`}
                  type="date"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className="w-44"
                />
              </div>
              <Button size="sm" onClick={open}>
                Open deployment
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpening(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-[13px] text-tertiary">
              Leave the date empty for a job with no agreed end. A machine on an
              open-ended job cannot be booked to a later one.
            </p>
          </div>
        ) : (
          <Button
            variant={standing.length > 0 ? 'ghost' : 'outline'}
            size="sm"
            className="self-start"
            onClick={() => setOpening(true)}
          >
            <PlusIcon aria-hidden="true" />
            {standing.length > 0 ? 'Start another deployment here' : 'Deploy gensets here'}
          </Button>
        )}
      </div>
    </section>
  );
};
