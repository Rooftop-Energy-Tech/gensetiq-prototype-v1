import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';
import {ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, dayMonth, duration, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {DeploymentRow} from '../data/feed';
import type {DeploymentSort, DeploymentSortDirection} from '../types/view.type';
import {DEPLOYMENT_STATE_META} from './stateMeta';

/**
 * The register as a table — the registers' table, over jobs.
 *
 * ## The columns, and the two that left with the model
 *
 * `Deployment`, `Status`, `Gensets`, `Window`, `On load`, `Fuel burned`.
 *
 * `Genset` was the leading column while a row *was* one machine's posting. A job has
 * one to three sets on it, so the machine becomes a count with the tags behind it and
 * the reference takes the lead: `DEP-0042` over the yard it is at, which is the pair
 * an operations room says out loud.
 *
 * `Lorry` went with it. A plate belongs to a machine rather than to a job, and a job
 * with three sets arrived on three of them — one column cannot hold that honestly.
 * It stays searchable, and it is on the job's own page against each machine.
 *
 * Energy stays out, for the reason it was left out before: it is the same job's work
 * stated a second way, nobody dispatches against it, and the preview panel states it
 * beside the litres it belongs with.
 *
 * ## Which columns are sortable and which are not
 *
 * Five of the six, and the odd one out is `Status`, which is the strip's three chips.
 * A header that is not a control is drawn as plain text rather than as a button with
 * nothing behind it.
 *
 * Time standing is `On load`'s neighbour rather than its own column: it is the second
 * line under the window, where it already was.
 */
const COLUMNS = [
  {label: 'Deployment', width: '24%', sort: 'reference'},
  {label: 'Status', width: '12%', sort: undefined},
  {label: 'Gensets', width: '20%', sort: 'genset'},
  {label: 'Window', width: '20%', sort: 'started'},
  {label: 'On load', width: '12%', sort: 'duration'},
  {label: 'Fuel burned', width: '12%', sort: 'fuel'},
] as const satisfies ReadonlyArray<{
  label: string;
  width: string;
  sort: DeploymentSort | undefined;
}>;

/**
 * The width below which this table scrolls sideways rather than squeezing.
 *
 * Six columns rather than the sites list's three, and two of them hold figures with
 * units — so the floor is higher than that table's 600px. Below it the row's own
 * scroll container takes over, which is the honest failure: a table you can push
 * sideways, rather than `1,240 L` printed over a date.
 */
const TABLE_MIN_WIDTH = 'min-w-[820px]';

/**
 * "12 Aug – ongoing" / "3 Aug – 14 Aug" / "from 2 Oct". The job's span, tersely.
 *
 * A planned job reads *from* its start rather than as a range, because the range is
 * the thing about it that has not happened: what a dispatcher needs off this row is
 * the date the lorry is wanted.
 */
const windowLabel = (row: DeploymentRow): string => {
  const {startsAt, endsAt} = row.deployment;
  if (row.state === 'planned') return `from ${dayMonth(startsAt)}`;
  if (endsAt === null) return `${dayMonth(startsAt)} – ongoing`;
  return `${dayMonth(startsAt)} – ${dayMonth(endsAt)}`;
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

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <table
        className={cn(
          'w-full table-fixed border-separate border-spacing-0 text-sm',
          TABLE_MIN_WIDTH,
        )}
      >
        <caption className="sr-only">
          Deployments, the ones standing first, with each job's window, the machines on
          it, and what it cost
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
                {/* The row selects into the preview panel and the links navigate
                    — the registers' split. `stopPropagation` on each, or opening a
                    job would also move the panel onto a row we are leaving. */}
                <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                  <Link
                    to="/deployments/$deploymentId"
                    params={{deploymentId: row.deployment.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {row.deployment.reference}
                  </Link>
                  {/* The yard, as a caption under the reference. Not a link since
                      the site pages went — see `DeploymentDetailPanel`. */}
                  <span className="block truncate text-xs text-tertiary">{row.siteName}</span>
                </td>

                <td className="h-13 border-b border-subtle p-2">
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

                {/* The count leads and the tags sit under it, because three tags do
                    not fit a 20% column and "three sets" is the fact the row is
                    scanned for. The full list is one hover away, and it is on the
                    job's own page for anybody who needs to click a machine. */}
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
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
                        ? 'No machines on this job yet'
                        : row.members
                            .map(
                              (member) =>
                                `${member.tag}${member.collected ? ' (collected)' : ''}`,
                            )
                            .join(' · ')}
                    </TooltipContent>
                  </Tooltip>
                  <span className="block truncate text-xs text-tertiary">
                    {row.members.map((member) => member.tag).join(', ')}
                  </span>
                </td>

                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
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
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {row.state === 'planned' ? (
                    <span className="text-tertiary">—</span>
                  ) : (
                    <>
                      <span
                        className="block truncate"
                        title={`${row.totals.starts} start${row.totals.starts === 1 ? '' : 's'} inside this deployment`}
                      >
                        {amount(row.totals.runtimeHours, 'hrs')}
                      </span>
                      <span className="block truncate text-xs text-tertiary">
                        {row.totals.starts} start{row.totals.starts === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </td>

                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {row.state === 'planned' ? (
                    <span className="text-tertiary">—</span>
                  ) : (
                    amount(row.totals.fuelBurnedLitres, 'L')
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
