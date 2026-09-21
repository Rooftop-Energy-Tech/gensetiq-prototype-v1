import {Link} from '@tanstack/react-router';
import {ArrowRightIcon, CircleIcon, TruckIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {DeploymentRow} from '../data/feed';

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
 * The posting preview beside the list, over the map, and under the Gantt.
 *
 * The registers' panels are the model and the rule is theirs: it states the facts a
 * pin cannot, and it carries a way out of itself. What differs is that a posting has
 * **two** ways out — the machine and the yard — and neither is more obviously the
 * one a reader wants. The arrow in the header opens the genset, because that is the
 * object the posting is *of*; the site is a link in the body.
 *
 * ## Why the totals are here and half of them are not in the table
 *
 * Energy came off the table when it grew a fourth view, and it lives here. The table
 * is read down a column — every figure in it has to be worth the width on eighty
 * rows — and a panel is read about one thing, where the fourth figure costs a line
 * nobody else pays for. Same argument, opposite answer, which is what a preview is
 * for.
 */
export const DeploymentDetailPanel = ({
  row,
  className,
}: {
  row: DeploymentRow | undefined;
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
            <h2 className="truncate font-medium text-primary">{row.tag}</h2>
            <p className="truncate text-xs text-secondary">{row.model}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" asChild>
                <Link
                  to="/gensets/$gensetId"
                  params={{gensetId: row.deployment.gensetId}}
                  aria-label={`Open ${row.tag}`}
                >
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Open genset</TooltipContent>
          </Tooltip>
        </div>

        {row.ongoing ? (
          <Badge variant="element" className="border-subtle">
            <CircleIcon className="text-severity-ok" aria-hidden="true" />
            Deployed · {duration(row.elapsedMs)}
          </Badge>
        ) : (
          <Badge variant="element" className="border-subtle">
            <TruckIcon className="text-tertiary" aria-hidden="true" />
            Completed · {duration(row.elapsedMs)}
          </Badge>
        )}

        <dl className="flex flex-col">
          <DetailRow label="Site">
            <Link
              to="/sites/$siteId"
              params={{siteId: row.deployment.siteId}}
              className="truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
            >
              {row.siteName}
            </Link>
          </DetailRow>
          <DetailRow label="Location">{row.locationLabel}</DetailRow>
          <DetailRow label="Out since">{stampDate(row.deployment.startedAt)}</DetailRow>
          <DetailRow label="Collected">
            {row.deployment.endedAt === null ? (
              <span className="text-secondary">Still on site</span>
            ) : (
              stampDate(row.deployment.endedAt)
            )}
          </DetailRow>
          <DetailRow label="Lorry">{row.deployment.lorryPlate}</DetailRow>
        </dl>

        <section className="flex flex-col gap-3">
          <h3 className="font-medium text-primary">
            What the posting cost
            <span className="font-normal text-secondary">
              {' · '}
              {row.totals.starts} start{row.totals.starts === 1 ? '' : 's'}
            </span>
          </h3>

          <dl className="flex flex-col">
            <DetailRow label="On load">{amount(row.totals.runtimeHours, 'h')}</DetailRow>
            <DetailRow label="Energy">{amount(row.totals.energyKwh, 'kWh')}</DetailRow>
            <DetailRow label="Fuel burned">
              {amount(row.totals.fuelBurnedLitres, 'L')}
            </DetailRow>
            {/* The tank at each end of the posting, which is the pair of readings the
                fuel figure above is reconciled against — and the one place this app
                states the level a machine *left* with. `endFuelLitres` is null while
                the posting is open, because the live level is telemetry rather than a
                stored figure; see `DeploymentSession`. */}
            <DetailRow label="Tank at start">
              {amount(row.deployment.startFuelLitres, 'L')}
            </DetailRow>
            <DetailRow label="Tank at close">
              {row.deployment.endFuelLitres === null ? (
                <span className="text-secondary">—</span>
              ) : (
                amount(row.deployment.endFuelLitres, 'L')
              )}
            </DetailRow>
          </dl>
        </section>
      </>
    )}
  </aside>
);
