import {Link} from '@tanstack/react-router';
import {BoomBoxIcon, ChevronRightIcon, DropletIcon, MapPinIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, dayMonth, duration} from '@/lib/format';
import type {DeploymentRow} from '../data/feed';
import {DEPLOYMENT_STATE_META} from './stateMeta';

/**
 * The register at phone width: one card per job.
 *
 * The registers' call, and their reason — the columns that would survive a narrow
 * screen are not the ones the list is read for. Here the kept facts are which job it
 * is, where it went, what state it is in, how many sets are on it and what they
 * burned, which is the order the table's own columns ask them in.
 *
 * The whole card opens the **job**. It used to open the machine, which was right
 * while a row *was* one machine's posting; a job with three sets has no single
 * machine to open, and its own page is the screen that lists them. The site and the
 * tags are lines of text rather than second links, because two tap targets inside one
 * card is how a list stops being tappable.
 */
const DeploymentCard = ({row, now}: {row: DeploymentRow; now: number}) => {
  const meta = DEPLOYMENT_STATE_META[row.state];
  const Icon = meta.icon;

  return (
    <Link
      to="/deployments/$deploymentId"
      params={{deploymentId: row.deployment.id}}
      className="flex items-center gap-3 rounded-md border border-subtle bg-element px-3 py-3 outline-none transition-colors active:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-primary">{row.deployment.reference}</p>
          <p className="truncate text-xs text-secondary">{row.siteName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            <Icon className={meta.iconClassName} aria-hidden="true" />
            {row.state === 'planned'
              ? `from ${dayMonth(row.deployment.startsAt)}`
              : row.state === 'active'
                ? `${duration(row.elapsedMs)} standing`
                : `${dayMonth(row.deployment.startsAt)} – ${
                    row.deployment.endsAt === null ? 'ongoing' : dayMonth(row.deployment.endsAt)
                  }`}
          </Badge>
          <Badge variant="secondary">
            <BoomBoxIcon className="text-secondary" aria-hidden="true" />
            {row.members.length} {row.members.length === 1 ? 'genset' : 'gensets'}
          </Badge>
          {/* A planned job has burned nothing, and a `0 L` badge would read as a job
              that stood and did nothing. */}
          {row.state !== 'planned' && (
            <Badge variant="secondary">
              <DropletIcon className="text-fuel" aria-hidden="true" />
              {amount(row.totals.fuelBurnedLitres, 'L')}
            </Badge>
          )}
        </div>

        <p className="flex min-w-0 items-center gap-1.5 text-xs text-secondary">
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {row.members.length === 0
              ? 'No machines on it yet'
              : row.members.map((member) => member.tag).join(', ')}
            {row.state === 'planned' && ` · in ${duration(row.startedMs - now)}`}
          </span>
        </p>
      </div>

      <ChevronRightIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
    </Link>
  );
};

export const DeploymentsCards = ({rows, now}: {rows: Array<DeploymentRow>; now: number}) => (
  <div className="h-full overflow-y-auto">
    {/* `pb-20` clears the floating nav — the last card has to be scrollable out from
        under it, not merely reachable. */}
    <ul aria-label="Deployments" className="flex flex-col gap-2 pb-20">
      {rows.map((row) => (
        <li key={row.deployment.id}>
          <DeploymentCard row={row} now={now} />
        </li>
      ))}
    </ul>
  </div>
);
