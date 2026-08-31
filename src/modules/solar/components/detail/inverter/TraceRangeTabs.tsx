import {cn} from '@/lib/utils';
import {TRACE_WINDOWS, TRACE_WINDOW_LABEL} from '../../../types/analysisView.type';
import type {TraceWindow} from '../../../types/analysisView.type';

/**
 * `24H · 7D · 30D` — the window over one inverter's own readings.
 *
 * The same segmented track as `SolarRangeTabs` and the genset's `RangePicker`,
 * down to the height and the active treatment, so a reader who has set a window
 * anywhere else in this app already knows how to set one here. Only the options
 * differ, and they differ because the quantity does — see
 * `analysisView.type.ts` for why this is a second control rather than the same
 * one.
 *
 * No `Custom`. The other two strips carry one because a reported period is
 * something people are asked for by date; a trace is something somebody is
 * looking at right now, and the three presets are the three distances at which a
 * half-hourly reading says anything.
 */
export const TraceRangeTabs = ({
  window,
  onWindowChange,
}: {
  window: TraceWindow;
  onWindowChange: (window: TraceWindow) => void;
}) => (
  <div className="flex h-8 items-center rounded-lg bg-element p-[3px]">
    {TRACE_WINDOWS.map((option) => {
      const active = window === option;

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
          {TRACE_WINDOW_LABEL[option]}
        </button>
      );
    })}
  </div>
);
