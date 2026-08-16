import {GaugeIcon, PauseIcon, PlayIcon, PowerOffIcon, TriangleAlertIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {RunState} from '../../types/genset.type';

/**
 * The hero glyph, one per run state.
 *
 * Deliberately not the same colours as `RUN_STATE_META`. That set colours a 12px
 * dot inside a neutral pill in a table of twenty-four rows, where the job is to
 * be distinguishable at a glance without turning the table into a traffic light.
 * This is a 32px glyph, alone, and the only thing on the page saying what the
 * machine is doing — so `RUNNING` takes the teal the design gives it here and
 * the rest keep their state colour.
 */
const HERO: Record<RunState, {icon: LucideIcon; className: string}> = {
  RUNNING: {icon: PlayIcon, className: 'text-teal'},
  IDLE: {icon: PauseIcon, className: 'text-status-idle'},
  FAULT: {icon: TriangleAlertIcon, className: 'text-status-fault'},
  OFFLINE: {icon: PowerOffIcon, className: 'text-status-offline'},
};

const LABEL: Record<RunState, string> = {
  RUNNING: 'Running',
  IDLE: 'Idle',
  FAULT: 'Fault',
  OFFLINE: 'Offline',
};

/**
 * "Running / 10 kW" — the leftmost column of the genset home page.
 *
 * The load badge is present only while the engine is turning. A stopped genset
 * has no load, and "0 kW" would read as a genset running into an open breaker —
 * a real and quite different fault.
 */
export const RunStateSummary = ({
  runState,
  loadKw,
}: {
  runState: RunState;
  loadKw: number | null;
}) => {
  const {icon: Icon, className} = HERO[runState];

  return (
    // A row at phone width, a column from `md` up. Stacked into a 113px column on a
    // 390px screen it would be a tall sliver against the full-width run card beneath
    // it; laid out across, the state and its load read as one line — which is what
    // the pair says anyway.
    <div className="flex shrink-0 items-center gap-3 md:w-[113px] md:flex-col">
      <div className="flex flex-1 items-center gap-2 md:flex-none md:flex-col">
        <Icon className={cn('size-8', className)} aria-hidden="true" />
        <p className="text-base font-medium whitespace-nowrap text-primary">
          {LABEL[runState]}
        </p>
      </div>

      {loadKw !== null && (
        <Badge variant="element" className="border-subtle md:w-full">
          <GaugeIcon className="text-teal" aria-hidden="true" />
          {amount(loadKw, 'kW')}
        </Badge>
      )}
    </div>
  );
};
