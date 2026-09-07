import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {SYSTEM_STATE_META} from '../systemStateMeta';
import type {SolarRow} from '../../data/register';

/**
 * The solar register's table — a row per **solar system**.
 *
 * ## What a row is
 *
 * A system: everything PV at one site, taken together, and the only level this module
 * has. A flat register of *boxes* was never on — ten rows from one mini-grid in a
 * portfolio list — and there are no boxes to list now anyway: a telco site runs a
 * −48 V DC bus, so the array feeds the bus and there is no AC stage to invert to.
 *
 * The system is what a customer names and what survives its own plant being replaced.
 * What is one click down is the array itself, in `Devices`.
 *
 * ## Rows select, names navigate
 *
 * The fleet table's rule, and it arrived here with the map: a pin has nowhere to put
 * a link, so clicking one selects the system into the preview panel that carries the
 * way in — and a row then has to behave the same way, or the two views disagree about
 * what a click means. The name stays the door.
 *
 * The sort is `sortSolarRows`' and is not a column header: worst condition first, then
 * the biggest plant. See there for why the reader is not asked to discover it.
 */

type SolarTableProps = {
  rows: Array<SolarRow>;
  /**
   * Draw the capacity column. `false` beside the map — see the note on `COLUMNS`.
   */
  wide: boolean;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /**
   * The scroll container, handed up so the split view can watch which rows are on
   * screen — see `useVisibleRowIds`. Optional: the list-only view has no map to drive.
   */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /**
   * Called just before this table scrolls itself, so the page can tell a scroll it
   * caused from one the reader performed. Without it, selecting a pin scrolls the
   * list, which re-frames the map away from that pin.
   */
  onBeforeAutoScroll?: () => void;
};

/**
 * ## Why `Capacity` comes and goes
 *
 * `SitesTable`'s rule, applied to this register: *"it is the widest column and the one
 * least often the reason for opening this screen, and beside the map there is no room
 * for both… so it is drawn on the list-only view, where the table has the full width,
 * and dropped on the split view, where the map has half of it."*
 *
 * Capacity is the column that fits that description here. It is a **nameplate** — it
 * does not change, it is half of the system's own name one click in, and it is the row
 * of the preview panel a reader has open beside the map anyway. Every other column is
 * either the row's identity or something that moved today.
 *
 * The alternative was six columns in a ~517px list, which is 62–110px each: the state
 * badge truncated to `Generat…`, and `1 dark` under the string count wrapped. A column
 * dropped is a fact a reader can still get to; a column mangled is one they cannot
 * read at all. The five that stay share the width it gives up — hence two widths per
 * column.
 */
const COLUMNS = [
  {label: 'System', wide: '25%', dense: '27%', nameplate: false},
  {label: 'State', wide: '15%', dense: '19%', nameplate: false},
  {label: 'Output', wide: '11%', dense: '14%', nameplate: false},
  {label: 'Capacity', wide: '12%', dense: '0%', nameplate: true},
  {label: 'Strings', wide: '15%', dense: '16%', nameplate: false},
  {label: 'Health', wide: '22%', dense: '24%', nameplate: false},
] as const;

export const SolarTable = ({
  rows,
  wide,
  selectedId,
  onSelect,
  scrollRef,
  onBeforeAutoScroll,
}: SolarTableProps) => {
  const columns = wide ? COLUMNS : COLUMNS.filter((column) => !column.nameplate);

  /**
   * Bring a selection made elsewhere into view — `GensetsTable`'s effect, for its
   * reasons. A pin clicked on the map selects a row that may be six screens down, and
   * a selection you cannot see is the same as no selection.
   */
  useEffect(() => {
    const container = scrollRef?.current;
    if (container === null || container === undefined || selectedId === undefined) return;

    const row = container.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(selectedId)}"]`);
    if (row === null) return;

    const {top, bottom} = row.getBoundingClientRect();
    const view = container.getBoundingClientRect();
    // The header is sticky and 40px tall, so a row tucked under it counts as out of
    // view even though it technically intersects the container.
    if (top >= view.top + 40 && bottom <= view.bottom) return;

    onBeforeAutoScroll?.();
    row.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    // `onBeforeAutoScroll` is deliberately not a dependency: it is a fresh closure
    // every render, and re-running this on each one would fight the reader's own
    // scrolling for as long as anything stayed selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, scrollRef]);

  // Enter and Space both select; Space additionally has to have its default
  // suppressed or the table scrolls out from under the row being chosen.
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(id);
  };

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      {/* `min-w` below `md` only. A phone keeps the horizontal scroll this table has
          always had — six columns at 375px is 62px each, which clips the state badge —
          while on a desktop the columns have to compress to fit the split view's list
          column, which is ~517px at 1280. `GensetsTable` needs no min-width because its
          phone form is a card list; these registers keep the table at every width. */}
      <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-sm md:min-w-0">
        <caption className="sr-only">
          Every solar system on the estate — where it is, what it is rated at, what it is
          doing now and what is wrong with it
        </caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.label} style={{width: wide ? column.wide : column.dense}} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const {system} = row;
            const selected = system.id === selectedId;
            const meta = CONDITION_META[row.condition];
            const state = SYSTEM_STATE_META[system.state];

            return (
              <tr
                key={system.id}
                data-row-id={system.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(system.id)}
                onKeyDown={(event) => handleKeyDown(event, system.id)}
                className={cn(
                  'cursor-pointer transition-colors outline-none',
                  'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-outline',
                  selected && 'bg-highlight hover:bg-highlight',
                )}
              >
                <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                  {/* The name is the door, as it is on the fleet list.
                      `stopPropagation` so the click does not also fire the row's
                      select on a screen we are in the middle of leaving. */}
                  <Link
                    to="/solar/$systemId"
                    params={{systemId: system.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {system.siteName}
                  </Link>
                  <span className="block truncate text-xs text-tertiary">
                    {system.locationLabel}
                  </span>
                </td>

                {/* `overflow-hidden` and `max-w-full`, for the reason `BatteryTable`'s
                    flow cell gives at length: a `Badge` is `w-fit shrink-0` and a table
                    cell does not clip, so at this column's ~78px in the split view
                    `Generating` would run over `Output` next door. */}
                <td className="h-13 overflow-hidden border-b border-subtle p-2">
                  <Badge variant="element" className="max-w-full border-subtle">
                    <state.icon className={cn('size-3', state.iconClassName)} aria-hidden="true" />
                    <span className="min-w-0 truncate">{state.label}</span>
                  </Badge>
                </td>

                <td className="h-13 truncate border-b border-subtle p-2 text-primary tabular-nums">
                  {system.state === 'GENERATING' ? amount(system.outputKw, 'kW', 1) : '—'}
                </td>

                {wide && (
                  <td className="h-13 truncate border-b border-subtle p-2 text-secondary tabular-nums">
                    {system.kwp.toLocaleString('en-MY')} kWp
                  </td>
                )}

                {/* Strings rather than boxes, which is what this column used to
                    count. A dark string is the one fault this register can state
                    without opening the row, so the count carries it. */}
                <td className="h-13 truncate border-b border-subtle p-2 text-secondary tabular-nums">
                  {system.strings.toLocaleString('en-MY')}
                  {system.downStrings > 0 && (
                    <span className="block truncate text-xs text-severity-warning">
                      {system.downStrings} dark
                    </span>
                  )}
                </td>

                <td className="h-13 truncate border-b border-subtle p-2">
                  <span className={cn('flex items-center gap-1.5', meta.textClassName)}>
                    <meta.icon className="size-4 shrink-0" aria-hidden="true" />
                    {meta.label}
                  </span>
                  {row.headline !== undefined && (
                    <span className="block truncate text-xs text-tertiary">{row.headline}</span>
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
