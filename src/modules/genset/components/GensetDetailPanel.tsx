import {Link} from '@tanstack/react-router';
import {ArrowRightIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {gensetLabel} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

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
            {/* Bare: this panel is the register's own preview, opened from a row that
                is already under a `Number plate` column. See `gensetLabel`. */}
            <h2 className="truncate font-medium text-primary">{gensetLabel(genset)}</h2>
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
            <DetailRow label="Status">
              <RunStateBadge runState={genset.runState} />
            </DetailRow>
            <DetailRow label="Fuel level">
              {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
            </DetailRow>
            <DetailRow label="Location">{genset.locationLabel}</DetailRow>
            <DetailRow label="Last updated">{relativeTime(genset.lastUpdated)}</DetailRow>
          </dl>
        </>
      )}
    </aside>
  );
};
