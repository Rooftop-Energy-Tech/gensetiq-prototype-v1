import {Link} from '@tanstack/react-router';
import {useMemo} from 'react';
import type {KeyboardEvent} from 'react';

import {amount, dayMonth, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {DeploymentRow} from '../data/feed';

/**
 * The feed on a time axis — one lane per machine, one bar per posting.
 *
 * ## Why this view exists at all
 *
 * The table and the map both answer *what is out and where*. Neither can answer
 * **when**, and on a fleet whose plant is hired out by the fortnight that is the
 * question the business runs on: where the gaps are, which machine has been sitting
 * in the yard for three weeks, whether two postings at one customer ran back to back
 * or a month apart. A table states each of those facts and makes the reader build the
 * picture; an axis *is* the picture.
 *
 * The lane is the **machine**, not the posting, and that is the whole design. Rows of
 * postings sorted by date would be the table again with a bar drawn on it. A lane per
 * genset puts each machine's chain on one line, so the white space between its bars is
 * depot time — the only way this app draws a thing that did not happen.
 *
 * ## What it does not do
 *
 * It is not a planner. Nothing here drags, nothing schedules, and there is no future
 * half to the axis: the window ends at *now* because a posting that has not happened
 * is not in this prototype's data model. When dispatch becomes a write path, this is
 * the screen that grows a right-hand side; until then a Gantt that showed empty
 * future weeks would be promising a control that does not exist.
 *
 * ## The axis
 *
 * Ticks are **weeks**, labelled by the day the week starts, and the window runs from
 * the earliest posting in the filtered set to now. Weekly rather than daily because
 * sixty daily ticks is a grey smear at any width this lane gets, and rather than
 * monthly because two ticks across a sixty-day window cannot be read against.
 *
 * There is no separate "now" marker, because the window's right edge *is* now: the
 * lanes are laid out in percentages of the container rather than at a fixed
 * pixels-per-day, so the axis never scrolls sideways and an ongoing bar ends flush
 * against the edge it is drawn to. A line there would be a line on the border.
 */

/** Lane height, and the left column that names each lane. */
const LANE_HEIGHT = 36;
const LANE_LABEL_WIDTH = 168;

const DAY = 86_400_000;
const WEEK = 7 * DAY;

type Lane = {
  gensetId: string;
  tag: string;
  model: string;
  /** This machine's postings inside the filtered set, oldest first. */
  rows: Array<DeploymentRow>;
  /** Whether any of them is still open — what ranks the lane. */
  ongoing: boolean;
  /** Where the machine is now, for the lane's own label. */
  latestSite: string;
};

/**
 * Group the filtered rows into lanes, open machines first.
 *
 * Ordered by state and then by most recent posting, which is the same ranking the
 * feed leads with — a reader switching from the table to the axis should find the
 * rows in the order they left them, however the table's own header sort has since
 * rearranged them. The table's ordering deliberately does **not** reach this view:
 * sorting lanes by fuel burned would put a machine's chain at a vertical position
 * that means nothing on a time axis.
 */
const toLanes = (rows: Array<DeploymentRow>): Array<Lane> => {
  const byGenset = new Map<string, Array<DeploymentRow>>();
  for (const row of rows) {
    const existing = byGenset.get(row.deployment.gensetId);
    if (existing === undefined) byGenset.set(row.deployment.gensetId, [row]);
    else existing.push(row);
  }

  return [...byGenset.entries()]
    .map(([gensetId, lane]) => {
      const ordered = [...lane].sort((a, b) => a.startedMs - b.startedMs);
      const newest = ordered[ordered.length - 1];

      return {
        gensetId,
        tag: newest?.tag ?? gensetId,
        model: newest?.model ?? '',
        rows: ordered,
        ongoing: ordered.some((row) => row.ongoing),
        latestSite: newest?.siteName ?? '',
      };
    })
    .sort((a, b) => {
      if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
      const aLatest = a.rows[a.rows.length - 1]?.startedMs ?? 0;
      const bLatest = b.rows[b.rows.length - 1]?.startedMs ?? 0;
      return bLatest - aLatest;
    });
};

/** Monday-aligned week starts across the window, for the axis ticks. */
const weekTicks = (from: number, to: number): Array<number> => {
  const first = new Date(from);
  first.setHours(0, 0, 0, 0);
  // `getDay()` is 0 on a Sunday; the fleet's week starts Monday, which is how the
  // depot's own schedules read.
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));

  const ticks: Array<number> = [];
  for (let at = first.getTime(); at <= to; at += WEEK) ticks.push(at);
  return ticks;
};

type DeploymentsGanttProps = {
  rows: Array<DeploymentRow>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** One clock reading for the whole view — the right-hand edge of the window. */
  now: number;
};

export const DeploymentsGantt = ({rows, selectedId, onSelect, now}: DeploymentsGanttProps) => {
  const lanes = useMemo(() => toLanes(rows), [rows]);

  /**
   * The window: the earliest posting in view, to now.
   *
   * Padded by a day on the left so a bar starting at the very first moment is not
   * drawn flush against the lane's own edge, where it would read as clipped rather
   * than as beginning.
   */
  const from = useMemo(() => {
    const earliest = rows.reduce(
      (running, row) => Math.min(running, row.startedMs),
      Number.POSITIVE_INFINITY,
    );
    return Number.isFinite(earliest) ? earliest - DAY : now - 60 * DAY;
  }, [rows, now]);

  const span = Math.max(now - from, DAY);
  const ticks = useMemo(() => weekTicks(from, now), [from, now]);

  /** Where a moment sits across the lane, as a percentage. */
  const at = (moment: number) => ((moment - from) / span) * 100;

  if (lanes.length === 0) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto rounded-md border border-subtle bg-element">
      {/* The axis. Sticky, so scrolling forty lanes keeps the dates in view — a bar
          whose week you have to scroll back up to read is a bar you cannot place. */}
      <div className="sticky top-0 z-20 flex h-9 border-b border-subtle bg-element">
        <div
          className="flex shrink-0 items-center border-r border-subtle px-3 text-xs font-medium text-secondary"
          style={{width: LANE_LABEL_WIDTH}}
        >
          Genset
        </div>
        {/* Fixed height rather than padded content: every label in here is absolutely
            positioned against its own tick, so the row has nothing in flow to give it
            one. */}
        <div className="relative min-w-0 flex-1">
          {ticks.map((tick) => (
            <span
              key={tick}
              // Centred on its own tick, except at the two ends: the first label is
              // left-aligned and the last right-aligned, or each hangs half its width
              // off the container and puts a scrollbar under the whole timeline.
              className="absolute top-1/2 text-xs whitespace-nowrap text-tertiary"
              style={{
                left: `${at(tick)}%`,
                transform:
                  at(tick) < 4
                    ? 'translateY(-50%)'
                    : at(tick) > 94
                      ? 'translate(-100%, -50%)'
                      : 'translate(-50%, -50%)',
              }}
            >
              {dayMonth(tick)}
            </span>
          ))}
        </div>
      </div>

      <ul aria-label="Deployment timeline" className="min-w-0 flex-1">
        {lanes.map((lane) => (
          <li key={lane.gensetId} className="flex border-b border-subtle last:border-b-0">
            {/* The lane's name, and where its machine is now. A link, because the
                whole point of finding a machine on this axis is to go and look at
                it. */}
            <div
              className="flex shrink-0 flex-col justify-center border-r border-subtle px-3"
              style={{width: LANE_LABEL_WIDTH, height: LANE_HEIGHT}}
            >
              <Link
                to="/gensets/$gensetId"
                params={{gensetId: lane.gensetId}}
                className="truncate rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
              >
                {lane.tag}
              </Link>
              <span className="truncate text-xs text-tertiary">
                {lane.ongoing ? lane.latestSite : 'In the depot'}
              </span>
            </div>

            <div className="relative min-w-0 flex-1" style={{height: LANE_HEIGHT}}>
              {/* The week grid, drawn per lane rather than once behind them all, so it
                  cannot drift out of register with the rows as the list scrolls. */}
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute inset-y-0 w-px bg-subtle"
                  style={{left: `${at(tick)}%`}}
                  aria-hidden="true"
                />
              ))}

              {lane.rows.map((row) => {
                const selected = row.deployment.id === selectedId;
                const left = at(row.startedMs);
                // Floored at a hair over a pixel's worth — a two-hour posting is a
                // real record and a zero-width bar is an invisible one — and then
                // clipped to the lane, so a posting opened minutes ago cannot push
                // that floor past the right edge and scroll the whole view sideways.
                const width = Math.min(Math.max(at(row.endedMs) - left, 0.6), 100 - left);

                const title = [
                  `${row.tag} at ${row.siteName}`,
                  `${stampDate(row.deployment.startedAt)} – ${
                    row.deployment.endedAt === null
                      ? 'ongoing'
                      : stampDate(row.deployment.endedAt)
                  }`,
                  `${duration(row.elapsedMs)} · ${amount(row.totals.runtimeHours, 'h')} on load · ${amount(row.totals.fuelBurnedLitres, 'L')}`,
                ].join('\n');

                return (
                  <button
                    key={row.deployment.id}
                    type="button"
                    title={title}
                    aria-pressed={selected}
                    onClick={() => onSelect(row.deployment.id)}
                    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                      // Space would otherwise scroll the container out from under the
                      // bar being chosen — the tables' rule, on a control that is
                      // already a button and so needs only the default suppressed.
                      if (event.key === ' ') event.preventDefault();
                    }}
                    className={cn(
                      'absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden',
                      'rounded-sm px-1.5 text-xs whitespace-nowrap transition-colors outline-none',
                      'focus-visible:ring-2 focus-visible:ring-outline',
                      // Open postings carry the live green the map and the strip use;
                      // closed ones are the record, and are drawn as one — a filled
                      // bar for what is happening, a tinted one for what happened.
                      row.ongoing
                        ? 'bg-severity-ok/85 text-white hover:bg-severity-ok'
                        : 'bg-highlight text-secondary hover:bg-hover',
                      selected && 'ring-2 ring-brand',
                    )}
                    style={{left: `${left}%`, width: `${width}%`}}
                  >
                    {/* The yard's name inside the bar where it fits, and nowhere when
                        it doesn't — `overflow-hidden` clips it rather than widening
                        the bar, because the bar's width is the posting's length and
                        nothing is allowed to change that. */}
                    <span className="truncate">{row.siteName}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
