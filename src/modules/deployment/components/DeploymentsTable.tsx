import {Link} from '@tanstack/react-router';
import {Fragment, useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';
import {ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {DeploymentRow} from '../data/feed';
import type {DeploymentSort, DeploymentSortDirection} from '../types/view.type';
import {DEPLOYMENT_STATE_META} from './stateMeta';

/**
 * The register as a table — the registers' table, over jobs.
 *
 * ## The columns, and the two that left with the model
 *
 * `Deployment`, `State`, `Status`, `Gensets`, `Window`, `On load`, `Fuel burned`.
 *
 * `Genset` was the leading column while a row *was* one machine's posting. A job has
 * one to three sets on it, so the machine becomes a count with the plates behind it and
 * the reference takes the lead: `DEP-0042` over the yard it is at, which is the pair
 * an operations room says out loud.
 *
 * `Lorry` went with it. A plate belongs to a machine rather than to a job, and a job
 * with three sets arrived on three of them — one column cannot hold that honestly.
 * It is on the job's own page against each machine.
 *
 * Energy stays out, for the reason it was left out before: it is the same job's work
 * stated a second way, nobody dispatches against it, and the preview panel states it
 * beside the litres it belongs with.
 *
 * ## Which columns are sortable and which are not
 *
 * Six of the seven, and the odd one out is `Status`, which is the strip's three chips.
 * A header that is not a control is drawn as plain text rather than as a button with
 * nothing behind it.
 *
 * Time standing is `On load`'s neighbour rather than its own column: it is the second
 * line under the window, where it already was.
 */
const COLUMNS = [
  {label: 'Deployment', sort: 'reference', beside: true},
  // Where the yard is, beside the job — the Gensets table's `State`, read off the
  // site's position (`stateNameAt`), so it agrees with the map and the State filter.
  {label: 'State', sort: 'location', beside: true},
  {label: 'Status', sort: undefined, beside: true},
  {label: 'Gensets', sort: 'genset', beside: true},
  // `beside: false` — off in the split view (2026-09-29), kept on the full-width
  // list, as `GensetsTable` drops `Location`. Beside the map the row is read to find
  // the job; its dates and what it cost are in the preview panel a click opens.
  {label: 'Dates', sort: 'started', beside: false},
  {label: 'Run hours', sort: 'duration', beside: false},
  {label: 'Fuel burned', sort: 'fuel', beside: false},
] as const satisfies ReadonlyArray<{
  label: string;
  sort: DeploymentSort | undefined;
  /** Kept in the split view. */
  beside: boolean;
}>;

/**
 * **The gaps between columns are equal, and together they fill the table** — the
 * Gensets table's layout, and see `GensetsTable` for how: each column is held to its
 * widest entry, and an empty spacer cell between every two columns takes an equal
 * share of what is left. All seven columns stay beside the map; where they outgrow the
 * space, the gaps close to the cells' padding and the table scrolls sideways.
 *
 * The plates under the count are capped, so one long list cannot take every other
 * gap's share. The address is not in the table (2026-09-29) — it is in the preview
 * panel a row click opens; the `State` column says where at a glance.
 */
const CELL = 'w-px px-1.5 whitespace-nowrap';

/** The stretch between two columns. Layout, so hidden from assistive tech. */
const Gap = ({header = false}: {header?: boolean}) =>
  header ? (
    <th aria-hidden="true" className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas p-0" />
  ) : (
    <td aria-hidden="true" className="h-13 border-b border-subtle p-0" />
  );

/**
 * "12/08/2026 – ongoing" / "03/08/2026 – 14/08/2026" / "from 02/10/2026". The span.
 *
 * A planned job reads *from* its start rather than as a range, because the range is
 * the thing about it that has not happened: what a dispatcher needs off this row is
 * the date the lorry is wanted.
 */
const windowLabel = (row: DeploymentRow): string => {
  const {startsAt, endsAt} = row.deployment;
  if (row.state === 'planned') return `from ${stampDate(startsAt)}`;
  if (endsAt === null) return `${stampDate(startsAt)} – ongoing`;
  return `${stampDate(startsAt)} – ${stampDate(endsAt)}`;
};

/**
 * The second line under the window: how long it has stood, or how far off it is.
 *
 * `duration()` of a planned job's elapsed time would read `0m`, which says nothing.
 */
const windowDetail = (row: DeploymentRow, now: number): string => {
  if (row.state !== 'planned') return duration(row.elapsedMs);
  return `in ${duration(row.startedMs - now)}`;
};

type DeploymentsTableProps = {
  rows: Array<DeploymentRow>;
  /** The table has the screen to itself. `false` beside the map, where three columns go. */
  wide: boolean;
  /** One clock reading for the whole table — see `DeploymentPage`. */
  now: number;
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
  wide,
  now,
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

  const columns = COLUMNS.filter((column) => wide || column.beside);

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Deployments, the ones standing first, with each job's window, the machines on
          it, and what it cost
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
                  className={cn(
                    CELL,
                    'sticky top-0 z-10 h-10 border-b border-subtle bg-canvas text-left font-medium text-secondary',
                    // The hover arrow sits in the next gap; the last column has none,
                    // so it keeps room of its own — `GensetsTable`'s fix.
                    index === columns.length - 1 && 'pr-6',
                  )}
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
                {/* The row selects into the preview panel and the links navigate
                    — the registers' split. `stopPropagation` on each, or opening a
                    job would also move the panel onto a row we are leaving. */}
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2 font-medium')}>
                  <Link
                    to="/deployments/$deploymentId"
                    params={{deploymentId: row.deployment.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {row.deployment.reference}
                  </Link>
                </td>
                <Gap />
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                  {row.stateName ?? '—'}
                </td>
                <Gap />
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2')}>
                  {(() => {
                    const meta = DEPLOYMENT_STATE_META[row.state];
                    const Icon = meta.icon;
                    return (
                      <Badge variant="secondary">
                        <Icon className={meta.iconClassName} aria-hidden="true" />
                        {meta.label}
                      </Badge>
                    );
                  })()}
                </td>

                {/* The count leads and the plates sit under it, because three plates
                    do not fit one line and "three sets" is the fact the row is
                    scanned for. The full list is one hover away, and it is on the
                    job's own page for anybody who needs to click a machine. */}
                <Gap />
                <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block cursor-help truncate">
                        {row.members.length === 0
                          ? 'None yet'
                          : `${row.members.length} ${row.members.length === 1 ? 'genset' : 'gensets'}`}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64">
                      {row.members.length === 0
                        ? 'No machines on this deployment yet'
                        : row.members
                            .map(
                              (member) =>
                                `${member.plate}${member.collected ? ' (collected)' : ''}`,
                            )
                            .join(' · ')}
                    </TooltipContent>
                  </Tooltip>
                  <span className="block max-w-[8rem] truncate text-xs text-tertiary">
                    {row.members.map((member) => member.plate).join(', ')}
                  </span>
                </td>

                {wide && (
                  <>
                    <Gap />
                    <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                      <span
                        className="block truncate"
                        title={`${stampDate(row.deployment.startsAt)}${
                          row.deployment.endsAt === null
                            ? ''
                            : ` to ${stampDate(row.deployment.endsAt)}`
                        }`}
                      >
                        {windowLabel(row)}
                      </span>
                      <span className="block truncate text-xs text-tertiary">
                        {windowDetail(row, now)}
                      </span>
                    </td>

                    {/* A planned job has nothing to report: no runs, no litres. A dash
                        rather than `0 h`, which would read as a job that stood and did
                        nothing. */}
                    <Gap />
                    <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                      {row.state === 'planned' ? (
                        <span className="text-tertiary">—</span>
                      ) : (
                        // Hours alone: the start count under it was taken off on
                        // 2026-09-29 — a job is judged by how long it ran, not how often.
                        amount(row.totals.runtimeHours, 'hrs')
                      )}
                    </td>

                    <Gap />
                    <td className={cn(CELL, 'h-13 border-b border-subtle py-2 text-primary')}>
                      {row.state === 'planned' ? (
                        <span className="text-tertiary">—</span>
                      ) : (
                        amount(row.totals.fuelBurnedLitres, 'L')
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
