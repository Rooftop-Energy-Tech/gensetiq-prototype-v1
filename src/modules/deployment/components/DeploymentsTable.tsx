import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';
import {ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, CircleIcon, TruckIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, dayMonth, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {DeploymentRow} from '../data/feed';
import type {DeploymentSort, DeploymentSortDirection} from '../types/view.type';

/**
 * The dispatch feed as a table — the registers' table, over postings.
 *
 * It was this screen's only view, and most of what it drew survives: sticky 40px
 * header, 52px rows, hairline rules, the same cell shapes. What changed is that it
 * is now *one* of four and has to behave like the registers' tables do — its headers
 * are the ordering control, its rows select into a preview panel rather than only
 * linking out, and the columns it drops below 600px are declared rather than
 * improvised.
 *
 * ## The columns, and the two that went
 *
 * `Genset`, `Status`, `Site`, `Window`, `On load`, `Fuel burned`, `Lorry`. Energy
 * came out: it is the same posting's work stated a second way, it is the figure
 * nobody dispatches against, and the preview panel states it beside the litres it
 * belongs with. `Status` stayed even though the feed's own ordering leads with the
 * open postings, because a reader who has sorted by fuel is looking at a list where
 * that ordering no longer says it.
 *
 * ## Which columns are sortable and which are not
 *
 * Four of the seven, and they are the four the toolbar's dropdown also offers —
 * `Genset`, `Window`, `On load`, `Fuel burned`. The other three are not orderings
 * anybody wants: `Status` is the strip's chips, `Site` is what the search box
 * matches, and a fleet sorted by lorry plate is a list nobody asked for. A header
 * that is not a control is drawn as plain text rather than as a button with nothing
 * behind it.
 *
 * Time standing is `On load`'s neighbour rather than its own column: it is the
 * second line under the window, where it already was.
 */
const COLUMNS = [
  {label: 'Genset', width: '17%', sort: 'genset'},
  {label: 'Status', width: '11%', sort: undefined},
  {label: 'Site', width: '18%', sort: undefined},
  {label: 'Window', width: '18%', sort: 'started'},
  {label: 'On load', width: '12%', sort: 'duration'},
  {label: 'Fuel burned', width: '12%', sort: 'fuel'},
  {label: 'Lorry', width: '12%', sort: undefined},
] as const satisfies ReadonlyArray<{
  label: string;
  width: string;
  sort: DeploymentSort | undefined;
}>;

/**
 * The width below which this table scrolls sideways rather than squeezing.
 *
 * Seven columns rather than the sites list's three, and two of them hold figures
 * with units — so the floor is higher than that table's 600px. Below it the row's
 * own scroll container takes over, which is the honest failure: a table you can push
 * sideways, rather than `1,240 L` printed over a lorry plate.
 */
const TABLE_MIN_WIDTH = 'min-w-[860px]';

/** "12 Aug – ongoing" / "3 Aug – 14 Aug". The posting's span, tersely. */
const windowLabel = (row: DeploymentRow): string =>
  row.deployment.endedAt === null
    ? `${dayMonth(row.deployment.startedAt)} – ongoing`
    : `${dayMonth(row.deployment.startedAt)} – ${dayMonth(row.deployment.endedAt)}`;

type DeploymentsTableProps = {
  rows: Array<DeploymentRow>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  sort: DeploymentSort;
  direction: DeploymentSortDirection;
  /**
   * A header was clicked. The page decides what that means — pick up a new key at
   * its natural direction, or flip the one already showing — so the views that share
   * this state cannot answer a click differently. See `DeploymentPage`.
   */
  onSortChange: (next: DeploymentSort) => void;
  /** The scroll container, for the split view's row watcher. See `SitesTable`. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Called before this table scrolls itself — see `SitesTable` for why. */
  onBeforeAutoScroll?: () => void;
};

export const DeploymentsTable = ({
  rows,
  selectedId,
  onSelect,
  sort,
  direction,
  onSortChange,
  scrollRef,
  onBeforeAutoScroll,
}: DeploymentsTableProps) => {
  // Bring a selection made on the map or the Gantt into view — the registers'
  // effect, over postings. See `SitesTable` for the sticky-header offset.
  useEffect(() => {
    const container = scrollRef?.current;
    if (container === null || container === undefined || selectedId === undefined) return;

    const row = container.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(selectedId)}"]`);
    if (row === null) return;

    const {top, bottom} = row.getBoundingClientRect();
    const view = container.getBoundingClientRect();
    if (top >= view.top + 40 && bottom <= view.bottom) return;

    onBeforeAutoScroll?.();
    row.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, scrollRef]);

  // Enter and Space both select; Space additionally has its default suppressed or
  // the table scrolls out from under the row being chosen.
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(id);
  };

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <table
        className={cn(
          'w-full table-fixed border-separate border-spacing-0 text-sm',
          TABLE_MIN_WIDTH,
        )}
      >
        <caption className="sr-only">
          Genset deployments, ongoing first, with each posting's window and what it cost
        </caption>
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.label} style={{width: column.width}} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
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
                  // `none` on the sortable-but-inactive headers, and *absent* on the
                  // three that are not controls — the attribute is what tells a
                  // screen reader a header is sortable at all, so putting it on a
                  // plain one would announce a control that isn't there.
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
          {rows.map((row) => {
            const selected = row.deployment.id === selectedId;

            return (
              <tr
                key={row.deployment.id}
                data-row-id={row.deployment.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(row.deployment.id)}
                onKeyDown={(event) => handleKeyDown(event, row.deployment.id)}
                className={cn(
                  'group cursor-pointer transition-colors outline-none',
                  'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-outline',
                  selected && 'bg-highlight hover:bg-highlight',
                )}
              >
                {/* The row selects into the preview panel and the two links navigate
                    — the registers' split. `stopPropagation` on each, or opening a
                    machine would also move the panel onto a posting we are leaving. */}
                <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                  <Link
                    to="/gensets/$gensetId"
                    params={{gensetId: row.deployment.gensetId}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {row.tag}
                  </Link>
                  <span className="block truncate text-xs text-tertiary">{row.model}</span>
                </td>

                <td className="h-13 border-b border-subtle p-2">
                  {row.ongoing ? (
                    <Badge variant="secondary">
                      <CircleIcon className="text-severity-ok" aria-hidden="true" />
                      Deployed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <TruckIcon className="text-tertiary" aria-hidden="true" />
                      Completed
                    </Badge>
                  )}
                </td>

                <td className="h-13 truncate border-b border-subtle p-2">
                  <Link
                    to="/sites/$siteId"
                    params={{siteId: row.deployment.siteId}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {row.siteName}
                  </Link>
                  <span className="block truncate text-xs text-tertiary">
                    {row.locationLabel}
                  </span>
                </td>

                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  <span
                    className="block truncate"
                    title={`${stampDate(row.deployment.startedAt)}${
                      row.deployment.endedAt === null
                        ? ''
                        : ` to ${stampDate(row.deployment.endedAt)}`
                    }`}
                  >
                    {windowLabel(row)}
                  </span>
                  <span className="block truncate text-xs text-tertiary">
                    {duration(row.elapsedMs)}
                  </span>
                </td>

                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  <span
                    className="block truncate"
                    title={`${row.totals.starts} start${row.totals.starts === 1 ? '' : 's'} inside this deployment`}
                  >
                    {amount(row.totals.runtimeHours, 'h')}
                  </span>
                  <span className="block truncate text-xs text-tertiary">
                    {row.totals.starts} start{row.totals.starts === 1 ? '' : 's'}
                  </span>
                </td>

                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {amount(row.totals.fuelBurnedLitres, 'L')}
                </td>

                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {row.deployment.lorryPlate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
