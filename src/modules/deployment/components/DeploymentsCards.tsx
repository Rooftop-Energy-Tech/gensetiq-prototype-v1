import {Link} from '@tanstack/react-router';
import {ChevronRightIcon, CircleIcon, DropletIcon, MapPinIcon, TruckIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, dayMonth, duration} from '@/lib/format';
import type {DeploymentRow} from '../data/feed';

/**
 * The feed at phone width: one card per posting.
 *
 * The registers' call, and their reason — the columns that would survive a narrow
 * screen are not the ones the list is read for. Here the kept facts are what is out,
 * where it went, how long it has been standing and what it burned, which is the order
 * the table's own columns ask them in.
 *
 * The whole card opens the **machine**, not the site. At this width there is no
 * preview panel to select into, so the card has one destination to choose and the
 * machine is the one a reader standing in a yard with a phone actually wants. The
 * site is on the card as a line of text rather than as a second link, because two
 * tap targets inside one card is how a list stops being tappable.
 */
const DeploymentCard = ({row}: {row: DeploymentRow}) => (
  <Link
    to="/gensets/$gensetId"
    params={{gensetId: row.deployment.gensetId}}
    className="flex items-center gap-3 rounded-md border border-subtle bg-element px-3 py-3 outline-none transition-colors active:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
  >
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-primary">{row.tag}</p>
        <p className="truncate text-xs text-secondary">{row.model}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {row.ongoing ? (
          <Badge variant="secondary">
            <CircleIcon className="text-severity-ok" aria-hidden="true" />
            {duration(row.elapsedMs)} standing
          </Badge>
        ) : (
          <Badge variant="secondary">
            <TruckIcon className="text-tertiary" aria-hidden="true" />
            {dayMonth(row.deployment.startedAt)} –{' '}
            {row.deployment.endedAt === null ? 'ongoing' : dayMonth(row.deployment.endedAt)}
          </Badge>
        )}
        <Badge variant="secondary">
          <DropletIcon className="text-fuel" aria-hidden="true" />
          {amount(row.totals.fuelBurnedLitres, 'L')}
        </Badge>
      </div>

      <p className="flex min-w-0 items-center gap-1.5 text-xs text-secondary">
        <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {row.siteName} · {row.deployment.lorryPlate}
        </span>
      </p>
    </div>

    <ChevronRightIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
  </Link>
);

export const DeploymentsCards = ({rows}: {rows: Array<DeploymentRow>}) => (
  <div className="h-full overflow-y-auto">
    {/* `pb-20` clears the floating nav — the last card has to be scrollable out from
        under it, not merely reachable. */}
    <ul aria-label="Deployments" className="flex flex-col gap-2 pb-20">
      {rows.map((row) => (
        <li key={row.deployment.id}>
          <DeploymentCard row={row} />
        </li>
      ))}
    </ul>
  </div>
);
