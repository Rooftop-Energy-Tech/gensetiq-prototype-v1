import {Link} from '@tanstack/react-router';
import {ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon} from 'lucide-react';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {cn} from '@/lib/utils';
import {fuelLevel, relativeTime} from '@/lib/format';
import {RunStateBadge} from './RunStateBadge';
import {useFleetAlarmCounts} from '../data/alarmViews';
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
 * Widths are proportional rather than the design's flat 262px columns.
 *
 * The mock-up floats the detail panel over the table, so all five columns keep
 * full width and the last two simply disappear underneath it. Here the panel
 * takes its own column instead, which leaves ~900px to divide — and split
 * evenly that truncates `BRF9540 | Cummins 1000 kVa` in every row. The plate
 * gets the slack; the fixed-shape columns (a badge, a litre figure) give it up.
 */
/** A set the counts pass has not reached — `SitesTable`'s constant, for its reason. */
const EMPTY_COUNTS: Record<AlertSeverity, number> = {CRITICAL: 0, WARNING: 0, NEUTRAL: 0};

const COLUMNS = [
  {label: 'Number plate', width: '27%', dense: '38%', beside: true, sort: 'name'},
  // `Alarm` sits next to run state because the two together are the row's verdict:
  // what the machine is doing, and what is standing against it. It read `Health` —
  // the `GensetCondition` verdict — until 2026-09-14 and now draws the counts, for
  // the reasons `SitesTable` and `SolarTable` give: the verdict is this app's
  // summary over the rows, and a register is read to find work, so it shows the
  // rows. The pill is a link to the set's own Alarms tab.
  {label: 'Status', width: '13%', dense: '20%', beside: true, sort: 'state'},
  {label: 'Alarm', width: '14%', dense: '20%', beside: true, sort: 'alarms'},
  {label: 'Fuel level', width: '14%', dense: '22%', beside: true, sort: 'fuel'},
  // `beside: false` — dropped in the split view, kept on the full-width list. Both
  // truncated to nothing useful beside the map: `Bangsar S…` and `1 hour …` are the
  // halves of each that carry no meaning. `SolarTable` drops `Capacity` and
  // `SitesTable` drops `Fuel on site` the same way and for the same reason — a
  // column dropped is a fact a reader can still get to, a column mangled is one
  // they cannot read at all.
  {label: 'Location', width: '18%', dense: '0%', beside: false, sort: undefined},
  {label: 'Last updated', width: '14%', dense: '0%', beside: false, sort: undefined},
] as const satisfies ReadonlyArray<{
  label: string;
  width: string;
  dense: string;
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
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Fleet gensets, with run state, what is standing against each, fuel level, location and telemetry age
        </caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.label} style={{width: wide ? column.width : column.dense}} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = column.sort !== undefined && column.sort === sort;
              const Icon = !active
                ? ChevronsUpDownIcon
                : direction === 'asc'
                  ? ArrowUpIcon
                  : ArrowDownIcon;

              return (
                <th
                  key={column.label}
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
                  className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
                >
                  {column.sort === undefined ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.sort)}
                      className={cn(
                        'group/sort -mx-1 flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5',
                        'transition-colors outline-none hover:text-primary',
                        'focus-visible:ring-2 focus-visible:ring-outline',
                        active && 'text-primary',
                      )}
                    >
                      {column.label}
                      <Icon
                        className={cn(
                          'size-3.5 shrink-0 transition-opacity',
                          !active &&
                            'opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100',
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
                <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                  {/* The name is the way *into* a genset; the rest of the row
                      only selects it into the preview panel. `stopPropagation`
                      so the click doesn't also fire the row's select on a screen
                      we are in the middle of leaving. */}
                  <Link
                    to="/gensets/$gensetId"
                    params={{gensetId: genset.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {/* `gensetLabel`, not `gensetName`: the column above this one
                        says `Number plate` and the page says `Gensets`, so a `Genset |`
                        on every row is the header printed thirty more times. */}
                    {gensetLabel(genset)}
                  </Link>
                </td>
                <td className="h-13 border-b border-subtle p-2">
                  <RunStateBadge runState={genset.runState} />
                </td>
                <td className="h-13 overflow-hidden border-b border-subtle p-2">
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
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)}
                </td>
                {wide && (
                  <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                    {genset.locationLabel}
                  </td>
                )}
                {wide && (
                  <td className="h-13 truncate border-b border-subtle p-2 text-primary">
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
