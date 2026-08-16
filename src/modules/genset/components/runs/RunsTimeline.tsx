import {dayMonth, duration} from '@/lib/format';
import {cn} from '@/lib/utils';
import {runElapsedMs} from '../../types/run.type';
import type {GensetRun} from '../../types/run.type';

/**
 * The log's shape: runs as bars, gaps as space.
 *
 * The most useful thing on the page, and it carries no number at all. A fleet mixes
 * duty profiles — a set that runs continuously, one that follows a load, one that
 * has started three times since June — and those are three completely different
 * machines to look after. A table of timestamps states that difference; this draws
 * it, and the reader has it before they have read a row.
 *
 * It also answers *when did it last run* without arithmetic, which for a backup set
 * is the whole question: readiness is the gap between the last bar and the right
 * edge.
 *
 * ## One lane, or one per set
 *
 * A genset gets a single unlabelled track. A site gets one per machine, stacked,
 * and the stack is the point — two sets alternating read as interleaved lanes, and
 * a vertical slice with no bar in any lane is a stretch where the site had nothing
 * running. That gap is the site tab's reason to exist, and it is invisible on
 * either machine's own page.
 *
 * ## Why bars are clipped rather than dropped
 *
 * It draws the same runs the table lists — everything that overlaps the window —
 * so a run already turning when the window opened is a bar running off the left
 * edge rather than an absence. That clipping *is* the information: a bar with no
 * visible start says the machine was already running, which on a continuous set is
 * the normal state and on a standby one is the thing you opened the page to find.
 */

export type TimelineLane = {
  /** The asset tag on a site's strip; `undefined` on a single genset's. */
  label: string | undefined;
  runs: Array<GensetRun>;
};

export const RunsTimeline = ({
  lanes,
  from,
  to,
  now,
}: {
  lanes: Array<TimelineLane>;
  from: number;
  to: number;
  now: number;
}) => {
  const span = Math.max(1, to - from);
  const labelled = lanes.some((lane) => lane.label !== undefined);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {lanes.map((lane, index) => (
          <div key={lane.label ?? index} className="flex items-center gap-3">
            {labelled && (
              <span className="w-20 shrink-0 truncate text-xs font-medium text-secondary">
                {lane.label}
              </span>
            )}

            <div
              className={cn(
                'relative h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-element',
                // A site with one set still gets a lane rather than a special case;
                // the label column is what changes.
              )}
            >
              {lane.runs.map((run) => {
                const startedMs = new Date(run.startedAt).getTime();
                const endedMs = run.endedAt === null ? now : new Date(run.endedAt).getTime();

                // Both ends clipped to the window. A run can overhang either edge —
                // already turning when it opened, still turning after it closed —
                // and a bar may only claim time the window actually covers.
                const visibleFrom = Math.max(startedMs, from);
                const visibleTo = Math.min(endedMs, to);

                const left = ((visibleFrom - from) / span) * 100;
                const width = ((visibleTo - visibleFrom) / span) * 100;

                return (
                  <div
                    key={run.id}
                    // The title is the only affordance here. The bars are a shape,
                    // not controls — the table below is where a run is opened —
                    // but a reader who spots an unusually long one wants to know
                    // how long without counting rows.
                    title={`${dayMonth(startedMs)} · ${duration(runElapsedMs(run, now))}`}
                    className="absolute top-1 bottom-1 rounded-[2px] bg-brand"
                    style={{
                      left: `${Math.max(0, left)}%`,
                      // Floored at 2px: a 90-minute run in a 30-day window is a
                      // fifth of a percent, which rounds to nothing and would draw
                      // an empty track for a machine that ran.
                      width: `max(2px, ${Math.max(0, width)}%)`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* The span, stated. Without it the strip is a picture of an unnamed
          stretch of time, and every judgement it invites — "that is a big gap" —
          depends on knowing whether it spans a day or two months. */}
      <div className={cn('flex justify-between text-xs text-secondary', labelled && 'pl-23')}>
        <span>{dayMonth(from)}</span>
        <span>{dayMonth(to)}</span>
      </div>
    </div>
  );
};
