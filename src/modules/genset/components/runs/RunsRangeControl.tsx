import {CalendarIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {dateRange} from '@/lib/format';
import {cn} from '@/lib/utils';
import {parseDateParam} from '../../types/analysisView.type';
import {RUN_WINDOWS, RUN_WINDOW_LABELS} from '../../types/runsView.type';
import type {RunRange, RunWindow} from '../../types/runsView.type';
import {RangeCalendar} from '../detail/analysis/RangeCalendar';

/**
 * Which stretch of the log to report on: four presets and a calendar.
 *
 * The same segmented control as the analysis tab's, and deliberately so — the two
 * tabs are one click apart and the reader carries an expectation between them. What
 * is missing here is that tab's third selector, *by run*: this page is the list of
 * runs, so narrowing it to one would be a filter whose result is the row you
 * clicked.
 *
 * `RangeCalendar` is the analysis tab's own component rather than a copy. A second
 * date picker would be a second set of decisions about clamping, about which
 * months open, about whether a backwards range is an error — and the two would
 * drift.
 */
export const RunsRangeControl = ({
  window,
  range,
  customFrom,
  customTo,
  earliest,
  now,
  onWindowChange,
  onCustomChange,
}: {
  window: RunWindow;
  range: RunRange;
  /** `YYYY-MM-DD`, straight off the URL. */
  customFrom: string | undefined;
  customTo: string | undefined;
  earliest: number;
  now: number;
  onWindowChange: (window: RunWindow) => void;
  onCustomChange: (from: string, to: string) => void;
}) => {
  // Labelled from the URL's own dates rather than from `range.to`, which is the
  // *exclusive* end — midnight the following morning. A chip reading "1–8 Aug" for
  // a range drawn as 1–7 would look like an off-by-one because it would be one.
  const fromMs = parseDateParam(customFrom);
  const toMs = parseDateParam(customTo);
  const customLabel =
    range.kind === 'custom' && fromMs !== undefined && toMs !== undefined
      ? dateRange(Math.min(fromMs, toMs), Math.max(fromMs, toMs))
      : undefined;

  return (
    <div className="flex h-8 items-center rounded-lg bg-element p-[3px]">
      {RUN_WINDOWS.map((option) => {
        // A preset is only lit when nothing more specific is. Leaving `30 days`
        // active while the table lists a fortnight in July would be the control
        // contradicting the list under it.
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
            {RUN_WINDOW_LABELS[option]}
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
  );
};
