import {CalendarIcon, ChevronDownIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {amount, dateRange, duration, stampAt} from '@/lib/format';
import {cn} from '@/lib/utils';
import {runElapsedMs} from '../../../types/run.type';
import type {GensetRun} from '../../../types/run.type';
import {
  ANALYSIS_WINDOWS,
  WINDOW_LABELS,
  parseDateParam,
} from '../../../types/analysisView.type';
import type {AnalysisRange, AnalysisWindow} from '../../../types/analysisView.type';
import {RangeCalendar} from './RangeCalendar';

/**
 * The design's "date range or select by deployment/run": what stretch of time to
 * draw.
 *
 * Three selectors, because the annotation names three genuinely different
 * questions. A **preset** asks "how has this machine been lately" — anchored to
 * now, and the answer is a shape. A **custom range** asks about a period the
 * reader already has in mind, usually because something else — a ticket, an
 * invoice, a site visit — put it there. A **run** asks "what happened on
 * Tuesday": anchored to an event, and the only range over which every reading on
 * the machine is defined, since a run is by definition the engine turning. That
 * is why the run list is here and not merely on the Runs tab.
 *
 * The presets and the custom range share one segmented control, because they
 * are the same choice at different resolutions — a custom range is just a window
 * whose ends you named yourself.
 *
 * *Deployment* is the fourth thing the annotation names and the one selector that
 * is missing. A deployment is a period a genset was installed somewhere, and this
 * app's model has no such concept — a `Genset` carries one `siteId` with no
 * history, so there is nothing to select. Building a picker over a relationship
 * the data cannot express would produce a control that looked authoritative and
 * filtered nothing.
 */
export const RangePicker = ({
  window,
  range,
  runs,
  customFrom,
  customTo,
  earliest,
  now,
  onWindowChange,
  onRunChange,
  onCustomChange,
}: {
  window: AnalysisWindow;
  range: AnalysisRange;
  runs: Array<GensetRun>;
  /** `YYYY-MM-DD`, straight off the URL. */
  customFrom: string | undefined;
  customTo: string | undefined;
  earliest: number;
  now: number;
  onWindowChange: (window: AnalysisWindow) => void;
  onRunChange: (runId: string) => void;
  onCustomChange: (from: string, to: string) => void;
}) => {
  const selectedRun = range.kind === 'run' ? runs.find((run) => run.id === range.runId) : undefined;

  // Labelled from the URL's own dates rather than from `range.to`, which is the
  // *exclusive* end — midnight on the following morning. A chip reading
  // "1–8 Aug" for a range the reader drew as 1–7 would look like an off-by-one
  // because it would be one.
  const fromMs = parseDateParam(customFrom);
  const toMs = parseDateParam(customTo);
  const customLabel =
    range.kind === 'custom' && fromMs !== undefined && toMs !== undefined
      ? dateRange(Math.min(fromMs, toMs), Math.max(fromMs, toMs))
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-8 items-center rounded-lg bg-element p-[3px]">
        {ANALYSIS_WINDOWS.map((option) => {
          // A preset is only "on" when nothing more specific is. Leaving 24 h lit
          // while the chart shows a two-hour run in April would be the control
          // contradicting the picture.
          const active = range.kind === 'preset' && option === window;

          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onWindowChange(option)}
              className={cn(
                'flex h-full cursor-pointer items-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                active
                  ? 'border-subtle bg-highlight text-primary'
                  : 'text-secondary hover:text-primary',
              )}
            >
              {WINDOW_LABELS[option]}
            </button>
          );
        })}

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-pressed={range.kind === 'custom'}
              className={cn(
                'flex h-full cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                range.kind === 'custom'
                  ? 'border-subtle bg-highlight text-primary'
                  : 'text-secondary hover:text-primary',
              )}
            >
              <CalendarIcon className="size-3.5" aria-hidden="true" />
              {customLabel ?? 'Custom'}
            </button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-auto">
            <RangeCalendar
              from={customFrom}
              to={customTo}
              earliest={earliest}
              latest={now}
              onSelect={onCustomChange}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Badge
            asChild
            variant="element"
            size="md"
            className={cn(
              'cursor-pointer border-subtle transition-colors hover:bg-highlight',
              selectedRun !== undefined && 'bg-highlight',
            )}
          >
            <button type="button">
              <span className={selectedRun === undefined ? 'text-secondary' : 'text-primary'}>
                {selectedRun === undefined
                  ? 'By run'
                  : `Run · ${stampAt(selectedRun.startedAt)}`}
              </span>
              <ChevronDownIcon className="text-tertiary" aria-hidden="true" />
            </button>
          </Badge>
        </PopoverTrigger>

        <PopoverContent align="end" className="max-h-[340px] w-[300px] overflow-y-auto">
          {selectedRun !== undefined && (
            <button
              type="button"
              onClick={() => onWindowChange(window)}
              className="flex w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm text-secondary transition-colors hover:bg-highlight"
            >
              Back to the last {WINDOW_LABELS[window]}
            </button>
          )}

          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              aria-pressed={run.id === range.runId}
              onClick={() => onRunChange(run.id)}
              className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-highlight"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'truncate text-sm',
                    run.id === range.runId ? 'font-medium text-primary' : 'text-secondary',
                  )}
                >
                  {stampAt(run.startedAt)}
                </span>
                {run.endedAt === null && (
                  <span className="shrink-0 text-xs text-teal">Running</span>
                )}
              </span>
              {/* The run's own totals, so choosing one is an informed pick rather
                  than a date lottery — a 20-hour run at full output is a
                  different thing to investigate than a 90-minute test. */}
              <span className="text-xs text-tertiary">
                {duration(runElapsedMs(run, now))} · {amount(run.energyProducedKwh, 'kWh')} ·{' '}
                {amount(run.fuelConsumedLitres, 'L')}
              </span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};
