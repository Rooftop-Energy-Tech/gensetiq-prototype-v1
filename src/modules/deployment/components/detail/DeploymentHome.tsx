import {Link} from '@tanstack/react-router';
import {ArrowRightIcon, BoomBoxIcon, MapPinIcon, TruckIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {MetricStrip} from '@/components/global/MetricStrip';
import {amount, dayMonth, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import {RUN_STATE_META} from '@/modules/genset/components/runStateMeta';
import {useFleet} from '@/modules/genset/data/deployment';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {useSiteAlarmQueue} from '@/modules/site/data/siteAlarmQueue';
import type {DeploymentRow} from '../../data/feed';
import {DEPLOYMENT_STATE_META} from '../stateMeta';

/**
 * A job's home page: what it is, what it cost, and what is on it.
 *
 * Three bands, in the order the questions are asked. The **header** says which job,
 * where, and how far through it is. The **strip** is what it cost, and it is the
 * band this whole change exists for: energy produced against fuel burned, over a
 * window, is *efficiency by deployment* — the figure
 * `genset-usage-scenarios.md` names as the one operators want and the screen
 * inventory recorded as unobtainable while a genset carried one `siteId` with no
 * time dimension. The **machines** close the page, each a door to its own pages.
 *
 * ## What a planned job draws instead
 *
 * Not this page with zeros in it. A job that has not started has produced nothing,
 * burned nothing and raised nothing, so the strip is dropped and the page says what
 * is committed and when the lorry is wanted. Printing `0 L` against a job that has
 * not begun is the same mistake as a `0 kWh` generation figure at a site with no
 * array, which this app goes out of its way not to make.
 */
export const DeploymentHome = ({row, now}: {row: DeploymentRow; now: number}) => {
  const meta = DEPLOYMENT_STATE_META[row.state];
  const StateIcon = meta.icon;

  const fleet = useFleet();

  /**
   * What is standing at this yard, restricted to the machines on this job.
   *
   * The site's own queue rather than a second derivation of it: one handling store,
   * one set of rows, so clearing an alarm here clears it on the machine's page and
   * on the site's. Only meaningful while the job is standing, which is why the strip
   * that shows it is only drawn then.
   */
  const queue = useSiteAlarmQueue(row.deployment.siteId, now);
  const counts = countBySeverity(
    queue.standing.filter((alarm) =>
      // A controller bit is keyed on the machine; a monitoring-unit register is keyed
      // on the site and belongs to the yard rather than to any one set on this job.
      row.members.some((member) => alarm.id.startsWith(member.membership.gensetId)),
    ),
  );

  return (
    <div className="flex flex-col gap-3.5 overflow-y-auto px-4 pt-3 pb-24 md:pb-6">
      <section aria-label="Deployment" className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-primary">{row.deployment.reference}</h1>
            <Badge variant="element" className="border-subtle">
              <StateIcon className={meta.iconClassName} aria-hidden="true" />
              {meta.label}
            </Badge>
          </div>

          <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-secondary">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <Link
              to="/sites/$siteId"
              params={{siteId: row.deployment.siteId}}
              className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
            >
              {row.siteName}
            </Link>
            <span className="text-tertiary">·</span>
            <span className="truncate">{row.locationLabel}</span>
          </p>
        </div>

        {/* The window, stated as the three facts it is: when it opened, when it is
            due to end, and how long that has been or will be. A job with no agreed
            end says so rather than showing a blank. */}
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-secondary">{row.state === 'planned' ? 'Starts' : 'Out since'}</dt>
            <dd className="font-medium text-primary">{stampDate(row.deployment.startsAt)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-secondary">
              {row.state === 'completed' ? 'Collected' : 'Agreed end'}
            </dt>
            <dd className="font-medium text-primary">
              {row.deployment.endsAt === null ? (
                <span className="font-normal text-secondary">No agreed end</span>
              ) : (
                stampDate(row.deployment.endsAt)
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-secondary">
              {row.state === 'planned' ? 'Lorry wanted' : 'Standing'}
            </dt>
            <dd className="font-medium text-primary">
              {row.state === 'planned'
                ? `in ${duration(row.startedMs - now)}`
                : duration(row.elapsedMs)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="border-t border-subtle" />

      {row.state === 'planned' ? (
        /* A commitment, and the one thing worth saying about it: nothing has moved.
           The sentence is here rather than in a tooltip because it is the single
           fact a reader most needs about a planned job — the machines are booked
           and they are still wherever they are standing. */
        <section
          aria-label="What is committed"
          className="flex flex-col gap-2 rounded-md border border-dashed border-subtle bg-element px-5 py-4"
        >
          <h2 className="text-sm font-medium text-primary">
            {row.members.length} {row.members.length === 1 ? 'genset' : 'gensets'} committed,
            from {dayMonth(row.deployment.startsAt)}
          </h2>
          <p className="max-w-2xl text-sm text-secondary">
            Nothing has moved. The machines below are booked to this job and are still
            standing wherever they are now; their pins move when the job starts. There
            are no runs, no litres and no alarms against a job that has not begun.
          </p>
        </section>
      ) : (
        <MetricStrip
          ariaLabel="What the job cost"
          metrics={[
            {
              label: 'On load',
              value: `${amount(row.totals.runtimeHours, 'h')}`,
            },
            {label: 'Energy', value: amount(row.totals.energyKwh, 'kWh')},
            {label: 'Fuel burned', value: amount(row.totals.fuelBurnedLitres, 'L')},
            {label: 'Fuel delivered', value: amount(row.fuelDeliveredLitres, 'L')},
            {
              // The point of the whole model. Withheld rather than printed as `0.00`
              // where nothing turned, because a ratio over no energy is not a ratio.
              label: 'Efficiency',
              value:
                row.totals.energyKwh < 1 ? (
                  <span className="text-base font-normal text-secondary">
                    Nothing on load yet
                  </span>
                ) : (
                  `${(row.totals.fuelBurnedLitres / row.totals.energyKwh).toFixed(2)} L/kWh`
                ),
            },
          ]}
          counts={counts}
          alarmLink={{
            to: '/deployments/$deploymentId/alarms',
            params: {deploymentId: row.deployment.id},
          }}
        />
      )}

      <div className="border-t border-subtle" />

      <section aria-labelledby="deployment-gensets" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="deployment-gensets" className="text-sm font-medium text-primary">
            Gensets on this job
            <span className="font-normal text-secondary">
              {' · '}
              {row.members.length}
            </span>
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link
              to="/deployments/$deploymentId/gensets"
              params={{deploymentId: row.deployment.id}}
            >
              Manage gensets
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {row.members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-subtle px-4 py-6 text-center text-sm text-secondary">
            No machines on this job yet. Put one on from the Gensets section.
          </p>
        ) : (
          <ul className="flex max-w-3xl flex-col gap-2">
            {row.members.map((member) => {
              const genset = fleet.find(
                (machine) => machine.id === member.membership.gensetId,
              );
              const runMeta =
                genset === undefined ? undefined : RUN_STATE_META[genset.runState];
              const RunIcon = runMeta?.icon;

              return (
                <li key={member.membership.id}>
                  <Link
                    to="/gensets/$gensetId"
                    params={{gensetId: member.membership.gensetId}}
                    className={cn(
                      'flex items-center justify-between gap-4 rounded-lg border border-subtle bg-element p-3',
                      'outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-highlight">
                        <BoomBoxIcon className="size-[18px] text-secondary" aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-primary">
                          {member.tag}
                        </span>
                        <span className="truncate text-[13px] leading-[18px] text-secondary">
                          {member.model}
                        </span>
                      </span>
                      {RunIcon !== undefined && runMeta !== undefined && (
                        <Badge variant="element" className="ml-1 shrink-0 border-subtle">
                          <RunIcon className={cn('size-3', runMeta.iconClassName)} aria-hidden="true" />
                          {runMeta.label}
                        </Badge>
                      )}
                    </span>

                    <span className="flex shrink-0 items-center gap-3 text-[13px] text-secondary">
                      {/* The lorry belongs to the machine, and this is the one place
                          the app can say which one took which set out. */}
                      {member.collected ? (
                        <span className="text-tertiary">
                          collected {dayMonth(member.membership.collectedAt as string)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <TruckIcon className="size-3.5 shrink-0" aria-hidden="true" />
                          {member.membership.lorryPlate}
                        </span>
                      )}
                      <ArrowRightIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
