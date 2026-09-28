import {Link} from '@tanstack/react-router';
import {ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon} from 'lucide-react';
import {Fragment, useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {cn} from '@/lib/utils';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {fuelLevelTextClass} from './fuelLevelTone';
import {useFleetAlarmCounts} from '../data/alarmViews';
import {gensetStateName} from '../data/gensetState';
import type {AlertSeverity} from '../types/alert.type';
import {gensetLabel} from '../types/genset.type';
import type {GensetSort, GensetSortDirection} from '../types/view.type';
import type {Genset} from '../types/genset.type';

type GensetsTableProps = {
  gensets: Array<Genset>;
  /**
   * The table has the screen to itself — `SolarTable`'s `wide`, for its reasons.
   * `false` beside the map, where `Location` and `Last updated` come out.
   */
  wide: boolean;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /**
   * The scroll container, handed up so the split view can watch which rows are on
   * screen — see `useVisibleRowIds`. Optional, because the list-only view has no
   * map to drive and nothing to observe with.
   */
  sort: GensetSort;
  direction: GensetSortDirection;
  /**
   * A header was clicked. The page decides what that means — a new key takes its own
   * natural direction, the key already showing flips — so the two registers cannot
   * answer the same click differently. See `changeSort` in the sites page.
   */
  onSortChange: (next: GensetSort) => void;
  scrollRef?: RefObject<HTMLDivElement | null>;
  /**
   * Called just before this table scrolls itself, so the page can tell a scroll it
   * caused from one the reader performed. Without it, selecting a pin on the map
   * scrolls the list, which re-frames the map away from that pin.
   */
  onBeforeAutoScroll?: () => void;
};

/**
 * **The gaps between columns are equal, and together they fill the table.** Each
 * column is as wide as its widest entry, and the width left over is shared out
 * evenly between the gaps — so the first column sits at the left edge, the last at
 * the right, and every column is the same distance from the next.
 *
 * The share is done by the table itself. Between every two columns is an empty
 * spacer cell with no width of its own, and the real columns are held to their
 * content (`w-px` under `whitespace-nowrap` is the table idiom for "no wider than
 * what is in it"). A table hands its spare width to the columns that did not claim
 * any, and with nothing in them the spacers split it equally. Being cells, they
 * also carry the row rule and the selection tint across the gap.
 *
 * Three arrangements came first. Percentages weighted towards the plate, from when a
 * plate cell carried `BRF9540 | Cummins 1000 kVa`, left uneven gaps. Equal
 * percentages broke the text: at a fifth of the split view `Negeri Sembilan`
 * truncated, and at a seventh of the full list more than half the `Location` cells
 * did. Content-width columns with all the slack in one last column made the gaps
 * even but pushed every column to the left. Where the content outgrows the space,
 * the gaps close to the cells' own padding and the scroll container scrolls sideways
 * rather than clip a cell.
 */
/** Every real cell: held to its content, with a floor under the gap on each side. */
const CELL = 'w-px px-2.5 whitespace-nowrap';

/** The stretch between two columns — see above. Layout, so hidden from assistive tech. */
const Gap = ({header = false}: {header?: boolean}) =>
  header ? (
    <th aria-hidden="true" className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas p-0" />
  ) : (
    <td aria-hidden="true" className="h-13 border-b border-subtle p-0" />
  );

/** A set the counts pass has not reached — `SitesTable`'s constant, for its reason. */
const EMPTY_COUNTS: Record<AlertSeverity, number> = {CRITICAL: 0, WARNING: 0, NEUTRAL: 0};

const COLUMNS = [
  {label: 'Number plate', beside: true, sort: 'name'},
  // Which Malaysian state the set stands in, beside the plate because the two are the
  // row's identity: which machine, and where. Kept beside the map as well, where
  // `Location` is dropped — a state name is short enough to survive the narrow column,
  // and it is the one geographic fact the map's hover asks about. Read off the set's
  // position, not its placename; see `gensetStateName`.
  {label: 'State', beside: true, sort: 'location'},
  // `Alarm` sits next to run state because the two together are the row's verdict:
  // what the machine is doing, and what is standing against it. It read `Health` —
  // the `GensetCondition` verdict — until 2026-09-14 and now draws the counts, for
  // the reasons `SitesTable` and `SolarTable` give: the verdict is this app's
  // summary over the rows, and a register is read to find work, so it shows the
  // rows. The pill is a link to the set's own Alarms tab.
  {label: 'Status', beside: true, sort: 'state'},
  {label: 'Alarm', beside: true, sort: 'alarms'},
  {label: 'Fuel level', beside: true, sort: 'fuel'},
  // `beside: false` — dropped in the split view, kept on the full-width list. Both
  // truncated to nothing useful beside the map: `Bangsar S…` and `1 hour …` are the
  // halves of each that carry no meaning. `SolarTable` drops `Capacity` and
  // `SitesTable` drops `Fuel on site` the same way and for the same reason — a
  // column dropped is a fact a reader can still get to, a column mangled is one
  // they cannot read at all.
  {label: 'Location', beside: false, sort: undefined},
  {label: 'Last updated', beside: false, sort: undefined},
] as const satisfies ReadonlyArray<{
  label: string;
  beside: boolean;
  /** The key this header sorts by, or `undefined` where the column is not sortable. */
  sort: GensetSort | undefined;
}>;

export const GensetsTable = ({
  gensets,
  wide,
  sort,
  direction,
  onSortChange,
  selectedId,
  onSelect,
  scrollRef,
  onBeforeAutoScroll,
}: GensetsTableProps) => {
  const columns = COLUMNS.filter((column) => wide || column.beside);

  /**
   * Every set's standing count, one pass for the list — see `useFleetAlarmCounts`.
   * The map's own pins read the same fleet, so a row and a pin cannot disagree.
   */
  const counts = useFleetAlarmCounts(gensets);

  /**
   * Bring a selection made elsewhere into view.
   *
   * A pin clicked on the map selects a row that may be six screens down the list,
   * and a selection you cannot see is the same as no selection. `nearest` rather
   * than `center`: a row already on screen should not move at all, which is the
   * common case when the click came from the list itself.
   */
  useEffect(() => {
    const container = scrollRef?.current;
    if (container === null || container === undefined || selectedId === undefined) return;

    const row = container.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(selectedId)}"]`);
    if (row === null) return;

    const {top, bottom} = row.getBoundingClientRect();
    const view = container.getBoundingClientRect();
    // The header is sticky and 40px tall, so a row tucked under it counts as out
    // of view even though it technically intersects the container.
    if (top >= view.top + 40 && bottom <= view.bottom) return;

    onBeforeAutoScroll?.();
    row.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    // `onBeforeAutoScroll` is deliberately not a dependency: it is a fresh closure
    // every render, and re-running this on each one would fight the reader's own
    // scrolling for as long as anything stayed selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, scrollRef]);

  // Enter and Space both select; Space additionally has to have its default
  // suppressed or the table scrolls out from under the row being chosen. The
  // genset's own page is reached through the name link in the first cell, which
  // is in the tab order right after the row.
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(id);
  };

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Fleet gensets, with the state each stands in, run state, what is standing against each, fuel level, location and telemetry age
        </caption>
        <thead>
          <tr>
            {columns.map((column, index) => {
              const active = column.sort !== undefined && column.sort === sort;
              const Icon = !active
                ? ChevronsUpDownIcon
                : direction === 'asc'
                  ? ArrowUpIcon
                  : ArrowDownIcon;

              return (
                <Fragment key={column.label}>
                {index > 0 && <Gap header />}
                <th
                  scope="col"
                  // `none` on the sortable-but-inactive ones and omitted entirely on
                  // the three that cannot sort. That distinction is the point: `none`
                  // announces "this is a control you have not used", and putting it on
                  // `Location` would offer a screen-reader user a header that does
                  // nothing when clicked.
                  aria-sort={
                    column.sort === undefined
                      ? undefined
                      : active
                        ? direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                  }
                  className={cn(CELL, 'sticky top-0 z-10 h-10 border-b border-subtle bg-canvas text-left font-medium text-secondary')}
                >
                  {column.sort === undefined ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.sort)}
                      className={cn(
                        'group/sort relative -mx-1 flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5',
                        'transition-colors outline-none hover:text-primary',
                        'focus-visible:ring-2 focus-visible:ring-outline',
                        active && 'text-primary',
                      )}
                    >
                      {column.label}
                      {/* The sorted column's arrow is part of its header. The others'
                          appear on hover **in the gap** rather than holding a slot: a
                          hidden 18px slot counts towards a content-sized column, and
                          it made the gap after `Number plate` — the one column whose
                          header is its widest entry — nearly twice the rest. */}
                      <Icon
                        className={cn(
                          'size-3.5 shrink-0 transition-opacity',
                          !active &&
                            'absolute top-1/2 left-full -translate-y-1/2 opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100',
                        )}
                        aria-hidden="true"
                      />
                      <span className="sr-only">
                        {active
                          ? `Sorted by ${column.label.toLowerCase()} — click to reverse`
                          : `Sort by ${column.label.toLowerCase()}`}
                      </span>
                    </button>
                  )}
                </th>
                </Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {gensets.map((genset) => {
            const selected = genset.id === selectedId;
            // A set with no detail entry has no alerts to judge, so it gets no
            // verdict rather than a green one it hasn't earned.
            //
            // `gensetCondition` rather than `detail.condition`: the latter is the
            // register map's verdict alone, and a set losing fuel carries an alarm
            // no register map has a bit for.
            return (
              <tr
                key={genset.id}
                data-row-id={genset.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(genset.id)}
                onKeyDown={(event) => handleKeyDown(event, genset.id)}
                className={cn(
                  'cursor-pointer transition-colors outline-none',
                  'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-outline',
                  selected && 'bg-highlight hover:bg-highlight',
                )}
              >
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2 font-medium')}>
                  {/* The name is the way *into* a genset; the rest of the row
                      only selects it into the preview panel. `stopPropagation`
                      so the click doesn't also fire the row's select on a screen
                      we are in the middle of leaving. */}
                  <Link
                    to="/gensets/$gensetId"
                    params={{gensetId: genset.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {/* `gensetLabel`, not `gensetName`: the column above this one
                        says `Number plate` and the page says `Gensets`, so a `Genset |`
                        on every row is the header printed thirty more times. */}
                    {gensetLabel(genset)}
                  </Link>
                </td>
                <Gap />
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                  {gensetStateName(genset) ?? '—'}
                </td>
                <Gap />
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2')}>
                  <RunStateBadge runState={genset.runState} />
                </td>
                <Gap />
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2')}>
                  {/* ⚠️ `stopPropagation` on this span and **not** the cell: on the
                      cell it makes the whole column dead to the row's select, since
                      a cell is mostly padding and only the pill navigates. Same
                      wiring as `SitesTable` and `SolarTable`. */}
                  <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
                    <AlarmBadge
                      counts={counts[genset.id] ?? EMPTY_COUNTS}
                      to="/gensets/$gensetId/alarms"
                      params={{gensetId: genset.id}}
                    />
                  </span>
                </td>
                <Gap />
                <td
                  className={cn(
                    CELL,
                    'h-13 border-b border-subtle py-2',
                    fuelLevelTextClass(genset.fuelLitres, genset.fuelCapacityLitres),
                  )}
                >
                  {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
                </td>
                {wide && <Gap />}
                {wide && (
                  <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                    {genset.locationLabel}
                  </td>
                )}
                {wide && <Gap />}
                {wide && (
                  <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                    {relativeTime(genset.lastUpdated)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
