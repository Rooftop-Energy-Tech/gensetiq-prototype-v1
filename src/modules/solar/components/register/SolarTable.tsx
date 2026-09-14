import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
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
 * ## `Strings` came out
 *
 * There were six columns, and `Strings` — a count with `N dark` under it — was one of
 * them. It went on 2026-09-14 at the owner's word, with the `Dark strings` summary
 * card it fed. A string is a wiring detail of one array: the register's job is to say
 * *which system needs someone*, and `Health` already says that for a system whose
 * strings have stopped delivering. The count is still on the system's own page, box by
 * box, where a reader who has decided to look at one array can act on it.
 *
 * The five that remain share the width it gave up. `System` takes most of it — it is
 * the column that truncates, carrying a name over a place name — and `Health` takes
 * the rest, which it needs now that it draws a pill rather than two lines of text.
 */
const COLUMNS = [
  {label: 'System', wide: '32%', dense: '32%', nameplate: false},
  // The dense share is the one measured rather than apportioned: `Generating` plus
  // its glyph is a 95px pill, and anything under 23% of a ~517px list truncates the
  // longest state to `Genera…` — which is the one word in it that carries meaning.
  {label: 'State', wide: '20%', dense: '23%', nameplate: false},
  {label: 'Output', wide: '13%', dense: '15%', nameplate: false},
  {label: 'Capacity', wide: '15%', dense: '0%', nameplate: true},
  // The pill is a fixed ~90px object rather than text, so this share is a floor to
  // clear it rather than a measure of its content: 20% of the 780px floor is 156px.
  {label: 'Alarm', wide: '20%', dense: '30%', nameplate: false},
  // Wide adds up to 100 and is measured against the 780px floor below, not against a
  // desktop: at phone width the table is held at that floor and scrolls, so `State`
  // has to clear its 95px pill there — 15% of 780 did not, and `Generating` arrived as
  // `Generati…` on every solar row on the estate.
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
          always had — five columns at 375px is 75px each, which clips the state badge —
          while on a desktop the columns have to compress to fit the split view's list
          column, which is ~517px at 1280. `GensetsTable` needs no min-width because its
          phone form is a card list; these registers keep the table at every width. */}
      <table className="w-full min-w-[780px] table-fixed border-separate border-spacing-0 text-sm md:min-w-0">
        <caption className="sr-only">
          Every solar system on the estate — where it is, what it is rated at, what it is
          doing now and what is standing against it
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

                <td className="h-13 overflow-hidden border-b border-subtle p-2">
                  {/* The pill every strip and device card in the app draws, and a
                      link to this system's Alarms tab — see `AlarmBadge` for why a
                      count is a door rather than a figure. No `keepFrom`: this
                      register *is* where the trail starts, so there is nothing to
                      crumb back to.

                      ⚠️ `stopPropagation` goes on **this span and not the cell**,
                      which is `SitesTable`'s wiring and was worth copying exactly.
                      On the cell it makes the whole column dead to the row's select
                      — 177px of every row where clicking does nothing at all —
                      because a cell is mostly padding and the pill is only the part
                      of it that navigates. Here the padding still selects the row
                      and only the pill is exempt, which is the split the name cell
                      above already makes. */}
                  <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
                    <AlarmBadge
                      counts={row.counts}
                      to="/solar/$systemId/alarms"
                      params={{systemId: system.id}}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
