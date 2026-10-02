import {Link} from '@tanstack/react-router';
import {ArrowRightIcon, XIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import {modelKva} from '@/modules/genset/types/genset.type';
import type {DeploymentRow} from '../data/feed';
import {CustomerCard} from './CustomerCard';
import {DEPLOYMENT_STATE_META} from './stateMeta';

/** What a job's machines are, by the job's state — `Gensets · 2 deployed`. */
const MEMBER_WORD: Record<DeploymentRow['state'], string> = {
  planned: 'booked',
  active: 'deployed',
  completed: 'used',
};

const DetailRow = ({
  label,
  children,
  wrap = false,
}: {
  label: string;
  children: ReactNode;
  /** Let a long value run onto more lines — the address, which the table leaves out. */
  wrap?: boolean;
}) => (
  <div className={cn('flex gap-px', wrap ? 'items-start' : 'items-center')}>
    {/* 122px matches the registers' panels, so every preview in this app lines its
        values up at the same place. */}
    <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">{label}</dt>
    <dd
      className={cn(
        'flex min-w-0 flex-1 text-primary',
        wrap ? 'py-1.5 leading-5' : 'items-center truncate',
      )}
    >
      {children}
    </dd>
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
  onClose,
}: {
  row: DeploymentRow | undefined;
  now: number;
  className?: string;
  /** Put the panel away — it clears the selection, as a click on the basemap does. */
  onClose: () => void;
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
          <div className="flex shrink-0 items-center gap-0.5">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 shrink-0"
                  onClick={onClose}
                  aria-label="Close panel"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Close</TooltipContent>
            </Tooltip>
          </div>
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
          <DetailRow label="Address" wrap>
            <span className="text-primary">{row.address}</span>
          </DetailRow>
          <DetailRow label={row.state === 'planned' ? 'Starts on' : 'Started on'}>
            {stampDate(row.deployment.startsAt)}
          </DetailRow>
          <DetailRow label={row.state === 'completed' ? 'Ended on' : 'Planned end'}>
            {row.deployment.endsAt === null ? (
              <span className="text-secondary">No planned end</span>
            ) : (
              stampDate(row.deployment.endsAt)
            )}
          </DetailRow>
          {/* How long a standing job has left before its planned end (2026-09-30).
              Named after the genset page's `Fuel remaining`. Standing jobs only: a
              planned one says `in …` in its badge, and a completed one has none. */}
          {row.state === 'active' && row.agreedEndMs !== undefined && (
            <DetailRow label="Time remaining">
              {row.agreedEndMs > now ? (
                duration(row.agreedEndMs - now)
              ) : (
                <span className="text-severity-critical">
                  Past planned end by {duration(now - row.agreedEndMs)}
                </span>
              )}
            </DetailRow>
          )}
        </dl>

        <CustomerCard deployment={row.deployment} />

        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-primary">
            Gensets
            <span className="font-normal text-secondary">
              {' · '}
              {/* A bare count read as unfinished; the word says what the machines are
                  to this job in its current state. */}
              {row.members.length} {MEMBER_WORD[row.state]}
            </span>
          </h3>

          {row.members.length === 0 ? (
            <p className="text-secondary">
              Nothing on this deployment yet. Its own page is where machines go on.
            </p>
          ) : (
            // Labelled as the Gensets table labels it, so a bare `BRU 3805` reads as
            // the machine's plate rather than a stray code.
            <dl className="flex flex-col">
              <DetailRow label="Number plate" wrap>
                <ul className="flex flex-1 flex-col gap-1">
                  {row.members.map((member) => (
                    <li
                      key={member.membership.id}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <Link
                        to="/gensets/$gensetId"
                        params={{gensetId: member.membership.gensetId}}
                        className="truncate rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                      >
                        {member.plate}
                      </Link>
                      {member.collected && (
                        <span className="shrink-0 text-xs text-tertiary">collected</span>
                      )}
                    </li>
                  ))}
                </ul>
              </DetailRow>
              {/* One line per machine, in the plates' order above, so a pair reads
                  across: the first plate's rating is the first line. */}
              <DetailRow label="Capacity" wrap>
                <ul className="flex flex-1 flex-col gap-1">
                  {row.members.map((member) => (
                    <li key={member.membership.id} className="text-primary tabular-nums">
                      {member.model === '' ? '—' : `${modelKva(member.model).toLocaleString('en-MY')} kVA`}
                    </li>
                  ))}
                </ul>
              </DetailRow>
            </dl>
          )}
        </section>

        {/* A planned job has no runs to report and no litres to account for. The
            section is dropped rather than drawn with dashes in it, which is this app's
            rule about offering only what is there. */}
        {row.state !== 'planned' && (
          <section className="flex flex-col gap-3">
            <h3 className="font-medium text-primary">Summary</h3>

            <dl className="flex flex-col">
              <DetailRow label="Running hours">{amount(row.totals.runtimeHours, 'hrs')}</DetailRow>
              <DetailRow label="Energy produced">{amount(row.totals.energyKwh, 'kWh')}</DetailRow>
              <DetailRow label="Fuel burned">{amount(row.totals.fuelBurnedLitres, 'L')}</DetailRow>
              {/* `Fuel delivered` left the panel on 2026-09-29: without the tank's own
                  change beside it the two litre figures read as a puzzle. It stays on
                  the job's page. */}
              {/* The figure the whole model exists to make readable: what the job
                  produced against what it drank. Withheld rather than printed as
                  `0.00` where nothing turned, because a ratio over no energy is not a
                  ratio.

                  `kWh/L` — energy out per litre in — matching the runs log, its
                  CSV and the leak detector. This printed `L/kWh` until
                  2026-09-22, so a reader moving from here to the runs beside it
                  met 0.12 and then 8.6 for one machine: the same fact, inverted,
                  and nothing on either screen said so. Labelled `SFC`, as the runs log
                  and the genset's deployment log label the same figure. */}
              <DetailRow label="SFC">
                {row.totals.energyKwh < 1 ? (
                  <span className="text-secondary">Nothing on load yet</span>
                ) : (
                  `${(row.totals.energyKwh / row.totals.fuelBurnedLitres).toFixed(2)} kWh/L`
                )}
              </DetailRow>
            </dl>
          </section>
        )}
      </>
    )}
  </aside>
);
