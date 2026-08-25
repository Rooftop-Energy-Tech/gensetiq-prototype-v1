import {CalendarIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {RangeCalendar} from '@/modules/genset/components/detail/analysis/RangeCalendar';
import {dateRange} from '@/lib/format';
import {cn} from '@/lib/utils';
import {SOLAR_RANGES, SOLAR_RANGE_LABEL, parseDateParam} from '../types/range.type';
import type {SolarRange} from '../types/range.type';

/**
 * The period selector: three trailing windows and a custom range, in one strip.
 *
 * `Custom` is a tab rather than a button beside the tabs, which is the Raeo
 * dashboard's call and the right one: the options are alternatives, so they belong
 * in one control. It is also what this app's own analysis `RangePicker` already
 * does, and this is that control with a different set of presets — same segmented
 * track, same height, same active treatment, and the same `RangeCalendar` behind
 * the custom tab. A reader who has set a window on a genset's analysis tab already
 * knows how to set one here.
 *
 * The custom tab shows the range it holds once one is set, rather than the word
 * `Custom`. A strip whose other options are durations should say what the fourth
 * one's duration is.
 */
export const SolarRangeTabs = ({
  range,
  from,
  to,
  earliest,
  now,
  onRangeChange,
  onCustomChange,
}: {
  range: SolarRange;
  /** `YYYY-MM-DD`, straight off the URL. */
  from: string | undefined;
  to: string | undefined;
  earliest: number;
  now: number;
  onRangeChange: (range: SolarRange) => void;
  onCustomChange: (from: string, to: string) => void;
}) => {
  // Labelled from the URL's own dates, not from the resolved window's exclusive
  // end — a chip reading "1–8 Aug" for a range drawn as 1–7 would look like an
  // off-by-one because it would be one. Same note as `RangePicker`.
  const fromMs = parseDateParam(from);
  const toMs = parseDateParam(to);
  const customLabel =
    fromMs !== undefined && toMs !== undefined
      ? dateRange(Math.min(fromMs, toMs), Math.max(fromMs, toMs))
      : undefined;

  return (
    <div className="flex h-8 items-center rounded-lg bg-element p-[3px]">
      {SOLAR_RANGES.filter((option) => option !== 'custom').map((option) => {
        const active = range === option;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onRangeChange(option)}
            className={cn(
              'flex h-full cursor-pointer items-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              active
                ? 'border-subtle bg-highlight text-primary'
                : 'text-secondary hover:text-primary',
            )}
          >
            {SOLAR_RANGE_LABEL[option]}
          </button>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-pressed={range === 'custom'}
            className={cn(
              'flex h-full cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              range === 'custom'
                ? 'border-subtle bg-highlight text-primary'
                : 'text-secondary hover:text-primary',
            )}
          >
            <CalendarIcon className="size-3.5" aria-hidden="true" />
            {range === 'custom' && customLabel !== undefined ? customLabel : 'Custom'}
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-auto">
          <RangeCalendar
            from={from}
            to={to}
            earliest={earliest}
            latest={now}
            onSelect={onCustomChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
