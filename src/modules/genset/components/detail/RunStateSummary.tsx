import {PauseIcon, PlayIcon, PowerOffIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {RunState} from '../../types/genset.type';

/**
 * The hero glyph, one per run state.
 *
 * Deliberately not the same colours as `RUN_STATE_META`. That set colours a 12px
 * dot inside a neutral pill in a table of twenty-four rows, where the job is to
 * be distinguishable at a glance without turning the table into a traffic light.
 * This is the only thing on the page saying what the machine is doing, and it is
 * set beside the title rather than inside a table — so `RUNNING` takes the teal the
 * design gives it here and the other two keep their state colour. It was a 32px
 * glyph when that argument was written and is 16px now; the argument is about the
 * company it keeps, not the size.
 */
const HERO: Record<RunState, {icon: LucideIcon; className: string}> = {
  RUNNING: {icon: PlayIcon, className: 'text-teal'},
  IDLE: {icon: PauseIcon, className: 'text-status-idle'},
  OFFLINE: {icon: PowerOffIcon, className: 'text-status-offline'},
};

const LABEL: Record<RunState, string> = {
  RUNNING: 'Running',
  IDLE: 'Idle',
  OFFLINE: 'Offline',
};

/**
 * "Running · 418 kW" — beside the machine's plate at the head of the page.
 *
 * It was a 32px glyph over a label in a 113px column, the leftmost thing on the
 * home page's run band, until 2026-09-22. Two things were wrong with that. It was
 * sized as a hero on a page whose hero is the plate above it; and it was **on one
 * tab of eight**, so a reader on Runs or Alarms could not see whether the engine
 * was turning without going back. Beside the title it is on all eight, which is
 * where a fact about the machine rather than about a page belongs.
 *
 * Small enough to sit on a 16px title line: a 16px glyph and the label at the
 * title's own size, with the load following in the secondary tone rather than in a
 * badge. A pill beside a heading reads as a control.
 *
 * The load is present only while the engine is turning. A stopped genset has no
 * load, and "0 kW" would read as a genset running into an open breaker — a real
 * and quite different problem.
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
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <Icon className={cn('size-4', className)} aria-hidden="true" />
      <span className="text-base font-medium text-primary">{LABEL[runState]}</span>
      {loadKw !== null && (
        <>
          <span className="text-tertiary" aria-hidden="true">
            ·
          </span>
          <span className="text-base font-medium text-secondary tabular-nums">
            {amount(loadKw, 'kW')}
          </span>
        </>
      )}
    </span>
  );
};
