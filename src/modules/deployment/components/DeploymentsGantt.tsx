import {Link} from '@tanstack/react-router';
import {useMemo} from 'react';
import type {KeyboardEvent} from 'react';

import {amount, dayMonth, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {DeploymentMember, DeploymentRow} from '../data/feed';

/**
 * The register on a time axis — one lane per machine, one bar per job it is on.
 *
 * ## Why this view exists at all
 *
 * The table and the map both answer *what is out and where*. Neither can answer
 * **when**, and on a fleet whose plant is hired out by the fortnight that is the
 * question the business runs on: where the gaps are, which machine has been sitting
 * in the yard for three weeks, whether two jobs at one customer ran back to back or
 * a month apart. A table states each of those facts and makes the reader build the
 * picture; an axis *is* the picture.
 *
 * The lane is the **machine**, not the job, and that is the whole design. Rows of
 * jobs sorted by date would be the table again with a bar drawn on it. A lane per
 * genset puts each machine's chain on one line, so the white space between its bars
 * is depot time — the only way this app draws a thing that did not happen.
 *
 * A job with three sets on it therefore draws **three bars on three lanes**, sharing
 * one window, which is what one job with three machines looks like. Selecting any of
 * them selects the job.
 *
 * ## The future half
 *
 * The axis used to stop at `now`, because a posting that had not happened was not in
 * the data model. A planned job is, so the window runs to the last thing booked and
 * `now` gets a rule down every lane. Left of it is what happened; right of it is what
 * is agreed.
 *
 * It is still **not a planner**: nothing drags, nothing schedules, and no bar can be
 * moved. Dispatch is a lorry and a phone call, and this screen is the paper trail
 * those leave.
 *
 * ## The axis
 *
 * Ticks are **weeks**, labelled by the day the week starts. Weekly rather than daily
 * because sixty daily ticks is a grey smear at any width this lane gets, and rather
 * than monthly because two ticks across a sixty-day window cannot be read against.
 * Lanes are laid out in percentages of the container rather than at a fixed
 * pixels-per-day, so the axis never scrolls sideways.
 */

/** Lane height, and the left column that names each lane. */
const LANE_HEIGHT = 36;
const LANE_LABEL_WIDTH = 168;

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** One machine's bar: the job, and that machine's membership of it. */
type Bar = {row: DeploymentRow; member: DeploymentMember};

type Lane = {
  gensetId: string;
  tag: string;
  model: string;
  /** This machine's jobs inside the filtered set, oldest first. */
  bars: Array<Bar>;
  /** Whether it is standing on one right now — what ranks the lane. */
  standing: boolean;
  /** Where the machine is now, for the lane's own label. */
  latestSite: string;
};

/**
 * Group the filtered rows into lanes, machines that are out first.
 *
 * Ordered by state and then by most recent job, which is the same ranking the
 * register leads with — a reader switching from the table to the axis should find the
 * rows in the order they left them, however the table's own header sort has since
 * rearranged them. The table's ordering deliberately does **not** reach this view:
 * sorting lanes by fuel burned would put a machine's chain at a vertical position
 * that means nothing on a time axis.
 */
const toLanes = (rows: Array<DeploymentRow>): Array<Lane> => {
  const byGenset = new Map<string, Array<Bar>>();

  for (const row of rows) {
    for (const member of row.members) {
      const id = member.membership.gensetId;
      byGenset.set(id, [...(byGenset.get(id) ?? []), {row, member}]);
    }
  }

  return [...byGenset.entries()]
    .map(([gensetId, bars]) => {
      const ordered = [...bars].sort((a, b) => a.row.startedMs - b.row.startedMs);
      const newest = ordered[ordered.length - 1];
      const standingBar = ordered.find(
        (bar) => bar.row.state === 'active' && !bar.member.collected,
      );

      return {
        gensetId,
        tag: newest?.member.tag ?? gensetId,
        model: newest?.member.model ?? '',
        bars: ordered,
        standing: standingBar !== undefined,
        latestSite: standingBar?.row.siteName ?? '',
      };
    })
    .sort((a, b) => {
      if (a.standing !== b.standing) return a.standing ? -1 : 1;
      const aLatest = a.bars[a.bars.length - 1]?.row.startedMs ?? 0;
      const bLatest = b.bars[b.bars.length - 1]?.row.startedMs ?? 0;
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
  /** One clock reading for the whole view — where the `now` rule is drawn. */
  now: number;
};

export const DeploymentsGantt = ({rows, selectedId, onSelect, now}: DeploymentsGanttProps) => {
  const lanes = useMemo(() => toLanes(rows), [rows]);

  /**
   * The window: the earliest job in view, to the last thing booked.
   *
   * Padded by a day at each end so a bar at the very first or last moment is not
   * drawn flush against the lane's own edge, where it would read as clipped rather
   * than as beginning or ending.
   */
  const from = useMemo(() => {
    const earliest = rows.reduce(
      (running, row) => Math.min(running, row.startedMs),
      Number.POSITIVE_INFINITY,
    );
    return Number.isFinite(earliest) ? earliest - DAY : now - 60 * DAY;
  }, [rows, now]);

  const to = useMemo(
    () => rows.reduce((running, row) => Math.max(running, row.agreedEndMs ?? row.endedMs), now) + DAY,
    [rows, now],
  );

  const span = Math.max(to - from, DAY);
  const ticks = useMemo(() => weekTicks(from, to), [from, to]);

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
          {/* `Today`, over the rule below it. The axis has a right-hand side now, so
              where the present sits is a fact the reader needs stated. */}
          <span
            className="absolute top-1/2 text-xs font-medium whitespace-nowrap text-brand"
            style={{
              left: `${at(now)}%`,
              transform: at(now) > 94 ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)',
            }}
          >
            Today
          </span>
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
                {lane.standing ? lane.latestSite : 'In the depot'}
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

              {/* The present, down every lane. Brand rather than a grid line, because
                  it is the one vertical on this axis that is not a date. */}
              <span
                className="absolute inset-y-0 w-px bg-brand/70"
                style={{left: `${at(now)}%`}}
                aria-hidden="true"
              />

              {lane.bars.map(({row, member}) => {
                const selected = row.deployment.id === selectedId;
                const left = at(row.startedMs);

                /**
                 * The machine's own end, which is not always the job's.
                 *
                 * A set collected on day nine of a fortnight draws a nine-day bar on a
                 * job whose bar runs the full fortnight for everything else on it. A
                 * planned job draws its whole agreed window, because that is the only
                 * thing it has; an active one stops at `now`, because the rest of its
                 * quoted window has not happened and is drawn as the tail below.
                 */
                const endMs =
                  member.membership.collectedAt !== null
                    ? new Date(member.membership.collectedAt).getTime()
                    : row.state === 'planned'
                      ? (row.agreedEndMs ?? row.endedMs)
                      : row.endedMs;

                // Floored at a hair over a pixel's worth — a two-hour job is a real
                // record and a zero-width bar is an invisible one — and then clipped
                // to the lane, so a job opened minutes ago cannot push that floor past
                // the right edge and scroll the whole view sideways.
                const width = Math.min(Math.max(at(endMs) - left, 0.6), 100 - left);

                // What is agreed and has not happened: the rest of a standing job's
                // quoted window, drawn as an outline running on from the bar. It is
                // the same fact a planned bar carries, on a job that has started.
                const tailStart = at(now);
                const agreedTail =
                  row.state === 'active' &&
                  row.agreedEndMs !== undefined &&
                  row.agreedEndMs > now &&
                  member.membership.collectedAt === null
                    ? Math.min(at(row.agreedEndMs) - tailStart, 100 - tailStart)
                    : 0;

                const title = [
                  `${row.deployment.reference} · ${member.tag} at ${row.siteName}`,
                  `${stampDate(row.deployment.startsAt)} – ${
                    row.deployment.endsAt === null ? 'ongoing' : stampDate(row.deployment.endsAt)
                  }`,
                  row.state === 'planned'
                    ? 'Planned · nothing has moved yet'
                    : `${duration(row.elapsedMs)} · ${amount(row.totals.runtimeHours, 'hrs')} on load · ${amount(row.totals.fuelBurnedLitres, 'L')}`,
                  member.collected ? 'Collected early' : undefined,
                ]
                  .filter((line) => line !== undefined)
                  .join('\n');

                return (
                  <span key={member.membership.id}>
                    {agreedTail > 0 && (
                      <span
                        className="absolute top-1/2 h-5 -translate-y-1/2 rounded-sm border border-dashed border-severity-ok/60"
                        style={{left: `${tailStart}%`, width: `${agreedTail}%`}}
                        aria-hidden="true"
                      />
                    )}
                    <button
                      type="button"
                      title={title}
                      aria-pressed={selected}
                      onClick={() => onSelect(row.deployment.id)}
                      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                        // Space would otherwise scroll the container out from under
                        // the bar being chosen — the tables' rule, on a control that
                        // is already a button and so needs only the default
                        // suppressed.
                        if (event.key === ' ') event.preventDefault();
                      }}
                      className={cn(
                        'absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden',
                        'rounded-sm px-1.5 text-xs whitespace-nowrap transition-colors outline-none',
                        'focus-visible:ring-2 focus-visible:ring-outline',
                        // Three states, three weights. A standing job is filled with
                        // the live green the map and the strip use; the record is a
                        // tint; a booked job is an outline, because an outline is how
                        // you draw a thing that is not there yet.
                        row.state === 'active' &&
                          'bg-severity-ok/85 text-white hover:bg-severity-ok',
                        row.state === 'completed' && 'bg-highlight text-secondary hover:bg-hover',
                        row.state === 'planned' &&
                          'border border-dashed border-brand bg-brand/10 text-secondary hover:bg-brand/20',
                        selected && 'ring-2 ring-brand',
                      )}
                      style={{left: `${left}%`, width: `${width}%`}}
                    >
                      {/* The yard's name inside the bar where it fits, and nowhere
                          when it doesn't — `overflow-hidden` clips it rather than
                          widening the bar, because the bar's width is the job's length
                          and nothing is allowed to change that. */}
                      <span className="truncate">{row.siteName}</span>
                    </button>
                  </span>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
