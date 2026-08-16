import {Link} from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CirclePlayIcon,
  CircleStopIcon,
  FuelIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {gensetName} from '../types/genset.type';
import type {Genset, GensetActivityKind} from '../types/genset.type';
import {useServiceRecords, withServiceActivity} from '../data/services';

const ACTIVITY_ICON: Record<GensetActivityKind, LucideIcon> = {
  START: CirclePlayIcon,
  STOP: CircleStopIcon,
  REFUEL: FuelIcon,
  FAULT: TriangleAlertIcon,
  SERVICE: WrenchIcon,
};

const DetailRow = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex items-center gap-px">
    {/* 122px matches the design's label column, which is what keeps the four
        values flush with each other. */}
    <dt className="flex h-8 w-[122px] shrink-0 items-center font-medium text-secondary">{label}</dt>
    <dd className="flex min-w-0 flex-1 items-center truncate text-primary">{children}</dd>
  </div>
);

export const GensetDetailPanel = ({
  genset,
  className,
}: {
  genset: Genset | undefined;
  className?: string;
}) => {
  // The feed is the machine's history plus its service log, merged and re-sorted.
  // `fleet.ts` used to carry a hardcoded service line; now the entry and the
  // record are the same fact, so a service logged on the Service tab shows up
  // here without either file knowing about the other.
  const records = useServiceRecords();
  const activity = genset === undefined ? [] : withServiceActivity(genset, records);

  return (
    <aside
      aria-label="Genset details"
      className={cn(
        'flex flex-col gap-3 overflow-y-auto rounded-md border border-default bg-overlay px-4 py-3 text-sm',
        className,
      )}
    >
      {genset === undefined ? (
        <p className="my-auto px-2 text-center text-secondary">
          Select a genset to see its details.
        </p>
      ) : (
        <>
          {/* The panel is a preview, so it needs a way out of itself. Over the
              map this arrow is the *only* way into the genset's own pages — a
              map pin has nowhere to put a link, and clicking one has to keep you
              on the map or the selection is useless. */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate font-medium text-primary">{gensetName(genset)}</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" asChild>
                  <Link
                    to="/gensets/$gensetId"
                    params={{gensetId: genset.id}}
                    aria-label={`Open ${genset.tag}`}
                  >
                    <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Open genset</TooltipContent>
            </Tooltip>
          </div>

          <dl className="flex flex-col">
            <DetailRow label="Run state">
              <RunStateBadge runState={genset.runState} />
            </DetailRow>
            <DetailRow label="Fuel level">
              {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
            </DetailRow>
            <DetailRow label="Location">{genset.locationLabel}</DetailRow>
            <DetailRow label="Last updated">{relativeTime(genset.lastUpdated)}</DetailRow>
          </dl>

          <section className="flex min-h-0 flex-col gap-3">
            <h3 className="font-medium text-primary">Activity</h3>
            <ol className="flex flex-col">
              {activity.map((event, index) => {
                const Icon = ACTIVITY_ICON[event.kind];
                const last = index === activity.length - 1;

                return (
                  <li key={event.id} className="flex gap-3">
                    {/* The rail is drawn as a bordered spacer beside the glyph
                        rather than an absolutely-positioned line, so it stretches
                        with however many lines the message wraps to. */}
                    <div className="flex flex-col items-center">
                      <Icon
                        className={cn(
                          'size-4 shrink-0',
                          event.kind === 'FAULT' ? 'text-status-fault' : 'text-secondary',
                        )}
                        aria-hidden="true"
                      />
                      {!last && <div className="w-px flex-1 bg-subtle" />}
                    </div>
                    <div className={cn('flex min-w-0 flex-col', last ? 'pb-0' : 'pb-4')}>
                      <span className="text-primary">{event.message}</span>
                      <span className="text-xs text-secondary">{relativeTime(event.at)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </aside>
  );
};
