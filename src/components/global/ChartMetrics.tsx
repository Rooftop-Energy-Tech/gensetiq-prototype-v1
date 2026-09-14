import {ArrowDownIcon, ArrowRightIcon, ArrowUpIcon} from 'lucide-react';

import {cn} from '@/lib/utils';

/**
 * One figure in a chart band's metric row: what the window came to, and what it is.
 *
 * `value` carries its own unit — the row is read across, and a unit hoisted into a
 * heading stops belonging to the number under it.
 */
export type ChartMetric = {
  key: string;
  /** What the figure is, in the design's own register: lowercase, no colon. */
  label: string;
  value: string;
  /**
   * A comparison beside the figure — a change against something the reader already
   * has a number for, never a second measurement dressed as one.
   */
  badge?: {direction: 'up' | 'down' | 'flat'; value: string; note?: string};
};

const ARROW = {up: ArrowUpIcon, down: ArrowDownIcon, flat: ArrowRightIcon};

/**
 * The metric row that opens a chart band — **the figures the window came to, before
 * the plot that explains them.**
 *
 * ## Why the figure sits above its own label
 *
 * The row is scanned, not read. A column of `109.3 kWh` over `solar generation` puts
 * every number on one line at one size, so the eye runs along the figures and drops
 * to a label only where one of them is worth a second of attention. Label-first —
 * which is how the page's *cards* are set, and rightly, because a card is one fact
 * being presented — makes the reader parse four names to find four numbers.
 *
 * ## Why equal columns rather than a flowing row
 *
 * The figures used to run on as `Total · 26 L   Total genset runtime · 3 h`, which
 * is a sentence: the eye has to find each `·` to know where one fact ends and the
 * next begins, and the whole row reflows when a figure gains a digit. Equal columns
 * give every figure the same start, so the row is stable as the day changes and a
 * reader can compare the same position across two sites.
 *
 * Follows the design's metric row (Figma `Section - Site diagnostics`).
 */
export const ChartMetrics = ({metrics}: {metrics: ReadonlyArray<ChartMetric>}) => {
  if (metrics.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {metrics.map((metric) => {
        const Arrow = metric.badge === undefined ? undefined : ARROW[metric.badge.direction];

        return (
          // `basis-0` with `flex-1`: equal shares of the row rather than shares of
          // whatever each one's content happens to need. `min-w-32` is the floor at
          // which a figure and its label still fit — under it the row wraps rather
          // than breaking a figure across two lines.
          <div key={metric.key} className="flex min-w-32 flex-1 basis-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base leading-6 font-semibold text-primary tabular-nums">
                {metric.value}
              </span>

              {metric.badge !== undefined && Arrow !== undefined && (
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full border border-subtle bg-inset py-0.5 pr-2.5 pl-2 text-xs',
                    metric.badge.direction === 'down' && 'text-severity-critical',
                    metric.badge.direction === 'up' && 'text-teal',
                  )}
                >
                  <Arrow className="size-3 shrink-0" aria-hidden="true" />
                  <span className="font-medium tabular-nums">{metric.badge.value}</span>
                  {metric.badge.note !== undefined && (
                    <span className="text-tertiary">{metric.badge.note}</span>
                  )}
                </span>
              )}
            </div>

            {/* Lowercase, as the design sets it: the label is an annotation on the
                figure rather than a heading over it, and a capital would give it
                the weight of one. */}
            <span className="truncate text-sm leading-5 text-secondary lowercase">
              {metric.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
