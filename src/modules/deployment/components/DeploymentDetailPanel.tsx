import {Link} from '@tanstack/react-router';
import {ArrowRightIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {DeploymentRow} from '../data/feed';
import {DEPLOYMENT_STATE_META} from './stateMeta';

const DetailRow = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex items-center gap-px">
    {/* 122px matches the registers' panels, so every preview in this app lines its
        values up at the same place. */}
    <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">
      {label}
    </dt>
    <dd className="flex min-w-0 flex-1 items-center truncate text-primary">{children}</dd>
  </div>
);

/**
 * The job preview beside the list, over the map, and under the timeline.
 *
 * The registers' panels are the model and the rule is theirs: it states the facts a
 * pin cannot, and it carries a way out of itself. The arrow in the header opens the
 * **job's own page**, which is the one destination a preview of a job can have — it
 * used to open the machine, and a job with three sets has no single machine to open.
 *
 * ## The machines are a list here and a count in the table
 *
 * A column has to be worth its width on eighty rows, so the table says `3 gensets`
 * and puts the tags in a tooltip. A panel is read about one thing, so it can spend
 * three lines naming them, each linking to the machine and each saying whether it has
 * been collected. Same fact, opposite treatment, which is what a preview is for.
 *
 * The plate rides with the machine rather than with the job, because that is where it
 * belongs: three sets on a job arrived on three lorries.
 */
export const DeploymentDetailPanel = ({
  row,
  now,
  className,
}: {
  row: DeploymentRow | undefined;
  now: number;
  className?: string;
}) => (
  <aside
    aria-label="Deployment details"
    className={cn(
      'flex flex-col gap-3 overflow-y-auto rounded-md border border-default bg-overlay px-4 py-3 text-sm',
      className,
    )}
  >
    {row === undefined ? (
      <p className="my-auto px-2 text-center text-secondary">
        Select a deployment to see its details.
      </p>
    ) : (
      <>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-medium text-primary">{row.deployment.reference}</h2>
            <p className="truncate text-xs text-secondary">{row.locationLabel}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" asChild>
                <Link
                  to="/deployments/$deploymentId"
                  params={{deploymentId: row.deployment.id}}
                  aria-label={`Open ${row.deployment.reference}`}
                >
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Open deployment</TooltipContent>
          </Tooltip>
        </div>

        {(() => {
          const meta = DEPLOYMENT_STATE_META[row.state];
          const Icon = meta.icon;
          return (
            <Badge variant="element" className="border-subtle">
              <Icon className={meta.iconClassName} aria-hidden="true" />
              {meta.label}
              {' · '}
              {row.state === 'planned'
                ? `in ${duration(row.startedMs - now)}`
                : duration(row.elapsedMs)}
            </Badge>
          );
        })()}

        <dl className="flex flex-col">
          <DetailRow label="Site">
            {/* Text, not a link. The yard had a page until 2026-09-22; naming it
                is still worth doing — it is where the machines went — but a link
                to a route that no longer exists is worse than no link. */}
            <span className="truncate text-primary">{row.siteName}</span>
          </DetailRow>
          <DetailRow label={row.state === 'planned' ? 'Starts' : 'Out since'}>
            {stampDate(row.deployment.startsAt)}
          </DetailRow>
          <DetailRow label={row.state === 'completed' ? 'Collected' : 'Agreed end'}>
            {row.deployment.endsAt === null ? (
              <span className="text-secondary">No agreed end</span>
            ) : (
              stampDate(row.deployment.endsAt)
            )}
          </DetailRow>
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-primary">
            Gensets
            <span className="font-normal text-secondary">
              {' · '}
              {row.members.length}
            </span>
          </h3>

          {row.members.length === 0 ? (
            <p className="text-secondary">
              Nothing on this job yet. Its own page is where machines go on.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {row.members.map((member) => (
                <li key={member.membership.id} className="flex items-baseline justify-between gap-2">
                  <Link
                    to="/gensets/$gensetId"
                    params={{gensetId: member.membership.gensetId}}
                    className="truncate rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {member.tag}
                  </Link>
                  <span className="shrink-0 text-xs text-tertiary">
                    {member.collected ? 'collected' : member.membership.lorryPlate}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* A planned job has no runs to report and no litres to account for. The
            section is dropped rather than drawn with dashes in it, which is this app's
            rule about offering only what is there. */}
        {row.state !== 'planned' && (
          <section className="flex flex-col gap-3">
            <h3 className="font-medium text-primary">
              What the job cost
              <span className="font-normal text-secondary">
                {' · '}
                {row.totals.starts} start{row.totals.starts === 1 ? '' : 's'}
              </span>
            </h3>

            <dl className="flex flex-col">
              <DetailRow label="On load">{amount(row.totals.runtimeHours, 'h')}</DetailRow>
              <DetailRow label="Energy">{amount(row.totals.energyKwh, 'kWh')}</DetailRow>
              <DetailRow label="Fuel burned">{amount(row.totals.fuelBurnedLitres, 'L')}</DetailRow>
              <DetailRow label="Fuel delivered">{amount(row.fuelDeliveredLitres, 'L')}</DetailRow>
              {/* The figure the whole model exists to make readable: what the job
                  produced against what it drank. Withheld rather than printed as
                  `0.00` where nothing turned, because a ratio over no energy is not a
                  ratio. */}
              <DetailRow label="Efficiency">
                {row.totals.energyKwh < 1 ? (
                  <span className="text-secondary">Nothing on load yet</span>
                ) : (
                  `${(row.totals.fuelBurnedLitres / row.totals.energyKwh).toFixed(2)} L/kWh`
                )}
              </DetailRow>
            </dl>
          </section>
        )}
      </>
    )}
  </aside>
);
