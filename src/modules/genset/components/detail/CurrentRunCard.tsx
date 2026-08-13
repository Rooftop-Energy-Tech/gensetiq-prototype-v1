import {Link} from '@tanstack/react-router';
import {ArrowDownIcon, ArrowRightIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, duration, stampAt} from '@/lib/format';
import {isOpen, runElapsedMs} from '../../types/run.type';
import type {GensetRun} from '../../types/run.type';
import {MetricRow} from './MetricRow';

/**
 * The run card — the three numbers an operator asks for first.
 *
 * Fuel consumed, energy produced and time running are the run's *totals*, not
 * instantaneous readings, and that is why they belong on the run rather than in
 * the gauge row: they are what the run gets judged on afterwards (litres per kWh
 * delivered, hours against the service interval), and they keep accumulating
 * whether or not anybody is watching the dials.
 *
 * Both stamps are shown because a run is an interval. For an open run the second
 * stamp is the latest telemetry rather than a stop time — the run has no end yet,
 * and blanking the field would leave the arrow pointing at nothing.
 */
export const CurrentRunCard = ({
  run,
  gensetId,
  now,
}: {
  run: GensetRun;
  gensetId: string;
  now: number;
}) => {
  const open = isOpen(run);
  const endStamp = run.endedAt ?? new Date(now).toISOString();

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 rounded-md border border-default bg-element px-3 pt-3 pb-4">
      <div className="flex items-center justify-between">
        <Badge variant="element">{open ? 'Current run' : 'Last run'}</Badge>

        {/* The design's arrow. It goes to the run log rather than nowhere: a
            reader looking at one run's totals is one click from asking how it
            compares with the last twenty. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7" asChild>
              <Link to="/gensets/$gensetId/runs" params={{gensetId}} aria-label="All runs">
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">All runs</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex w-full items-center gap-10">
        {/* The interval, drawn as one. The arrow is the design's, and it is
            doing real work — without it the two stamps read as a pair of
            unrelated timestamps rather than a start and an end. */}
        <div className="flex w-[117px] shrink-0 flex-col items-center gap-3 text-sm font-medium text-primary">
          <span className="whitespace-nowrap">{stampAt(run.startedAt)}</span>
          <ArrowDownIcon className="size-4 text-tertiary" aria-hidden="true" />
          <span className="whitespace-nowrap">{stampAt(endStamp)}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <MetricRow
            label={open ? 'Time running' : 'Time ran'}
            value={duration(runElapsedMs(run, now))}
          />
          <MetricRow label="Energy produced" value={amount(run.energyProducedKwh, 'kWh')} />
          <MetricRow label="Fuel consumed" value={amount(run.fuelConsumedLitres, 'L')} />
        </div>
      </div>
    </div>
  );
};
