import {Link} from '@tanstack/react-router';
import {BatteryChargingIcon} from 'lucide-react';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {SITE_POWER_ROLE_LABEL} from '@/modules/site/types/site.type';
import {BANK_RUNTIME_META, bankRuntime} from '../runtimeMeta';
import {BANK_FLOW_LABEL, bankFlow, bankName} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';

/**
 * The bank register's table — a row per **battery bank**, worst runtime first.
 *
 * The sort is `sortBanks`' and is not a column header; see there for why it is hours
 * left rather than charge, and why health deliberately does not drive it.
 *
 * ## Why health is not next to charge
 *
 * Two percentage columns touching read as one quantity printed twice, and the
 * misreading they invite is the expensive one — 81% health taken for a worse 81%
 * charge. So health sits at the far end, next to `Autonomy`, where it is beside the
 * figure it actually erodes: the hours in that column are the specification, and
 * health is how much of the specification is still in the cabinet.
 *
 * ## Rows select, names navigate
 *
 * The fleet table's rule, and it arrived here with the map: a pin has nowhere to put a
 * link, so clicking one selects the bank into the preview panel that carries the way
 * in — and a row then has to behave the same way, or the two views disagree about what
 * a click means.
 */

/**
 * ## Why two of the six come and go
 *
 * `SitesTable`'s rule: *"beside the map there is no room for both… so it is drawn on
 * the list-only view, where the table has the full width, and dropped on the split
 * view, where the map has half of it."* This table needed it twice over — six columns
 * in a ~517px list is 67–98px each, and `Discharging | 4 kW` ran over `Autonomy` while
 * `Diesel hybrid` and `13 h from full` were both cut to three characters and an
 * ellipsis.
 *
 * The two that go are the two that **do not move**:
 *
 *  - **Autonomy** is the specification, and the `Charge` cell beside it already prints
 *    the hours actually left — which is the sort key and the figure somebody acts on.
 *    The specification is what those hours are read *against*, and the preview panel
 *    prints the pair together as `6.2 h of 13 h`.
 *  - **Configuration** is an attribute of the site rather than a reading off the bank,
 *    and it is the widest value in the table.
 *
 * Both are rows in the preview panel, which is open beside the map. Charge, flow and
 * health stay because all three changed today.
 */
const COLUMNS = [
  // Wide is measured against the 800px floor below rather than against a desktop: at
  // phone width the table is held at that floor and scrolls, so `Flow` has to clear its
  // 155px pill there.
  {label: 'Bank', wide: '22%', dense: '28%', nameplate: false},
  {label: 'Charge', wide: '12%', dense: '18%', nameplate: false},
  // Measured, like the solar register's `State`: `Discharging | 5 kW` is a 155px pill,
  // so anything under a third of a ~517px list loses the unit off the end of it.
  {label: 'Flow', wide: '22%', dense: '34%', nameplate: false},
  {label: 'Autonomy', wide: '14%', dense: '0%', nameplate: true},
  {label: 'Health', wide: '12%', dense: '20%', nameplate: false},
  {label: 'Configuration', wide: '18%', dense: '0%', nameplate: true},
] as const;

type BatteryTableProps = {
  banks: Array<BatteryBank>;
  /**
   * Draw the two nameplate columns. `false` beside the map — see the note on `COLUMNS`.
   */
  wide: boolean;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** The scroll container, handed up so the split view can watch which rows are on screen. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Called just before this table scrolls itself — see `GensetsTable`. */
  onBeforeAutoScroll?: () => void;
};

export const BatteryTable = ({
  banks,
  wide,
  selectedId,
  onSelect,
  scrollRef,
  onBeforeAutoScroll,
}: BatteryTableProps) => {
  const columns = wide ? COLUMNS : COLUMNS.filter((column) => !column.nameplate);

  /** Bring a selection made elsewhere into view — `GensetsTable`'s effect, for its reasons. */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, scrollRef]);

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
      <table className="w-full min-w-[800px] table-fixed border-separate border-spacing-0 text-sm md:min-w-0">
        <caption className="sr-only">
          Battery banks, worst runtime first, with charge and hours left, flow, autonomy,
          state of health and the configuration each was specified for
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
          {banks.map((bank) => {
            const flow = bankFlow(bank);
            const selected = bank.id === selectedId;
            const runtime = BANK_RUNTIME_META[bankRuntime(bank)];

            return (
              <tr
                key={bank.id}
                data-row-id={bank.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(bank.id)}
                onKeyDown={(event) => handleKeyDown(event, bank.id)}
                className={cn(
                  'cursor-pointer transition-colors outline-none',
                  'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-outline',
                  selected && 'bg-highlight hover:bg-highlight',
                )}
              >
                <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                  <Link
                    to="/battery/$bankId"
                    params={{bankId: bank.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {bankName(bank)}
                  </Link>
                  <span className="block truncate text-xs text-tertiary">
                    {bank.locationLabel}
                  </span>
                </td>

                <td className="h-13 border-b border-subtle p-2 tabular-nums">
                  <span className="block text-primary">{Math.round(bank.soc * 100)}%</span>
                  {/* The sort key, shown — and the dot is the map's own scale, so a
                      red pin and this row's red dot are one reading. See
                      `runtimeMeta.ts` for why the pins are hours and not percent. */}
                  <span className="flex items-center gap-1.5 text-xs text-tertiary">
                    <span
                      className={cn('size-1.5 shrink-0 rounded-full', runtime.dotClassName)}
                      aria-hidden="true"
                    />
                    {amount(bank.hoursLeft, 'h', 1)} left
                  </span>
                </td>

                {/* `overflow-hidden` on the cell and `max-w-full` on the badge, because
                    a `Badge` is `w-fit shrink-0` — it sizes to its text and refuses to
                    shrink, and a table cell does not clip its overflow. At the design's
                    full width that was invisible; in the split view this column is
                    ~98px and `Discharging | 4 kW` ran straight over `Autonomy` next
                    door. The label truncates inside the pill instead, and the preview
                    panel carries the figure in full. */}
                <td className="h-13 overflow-hidden border-b border-subtle p-2">
                  <Badge variant="secondary" className="max-w-full whitespace-pre">
                    <BatteryChargingIcon
                      className={flow === 'IDLE' ? 'text-tertiary' : 'text-battery'}
                      aria-hidden="true"
                    />
                    {/* `min-w-0` as well as `truncate`: a flex item will not shrink
                        below its content width without it, so the ellipsis never
                        happens and the text clips mid-character. */}
                    <span className="min-w-0 truncate">
                      {BANK_FLOW_LABEL[flow]}
                      {flow !== 'IDLE' && (
                        <>
                          <span className="text-secondary"> | </span>
                          {amount(Math.abs(bank.powerKw), 'kW')}
                        </>
                      )}
                    </span>
                  </Badge>
                </td>

                {wide && (
                  <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                    {amount(bank.autonomyHours, 'h')} from full
                  </td>
                )}

                <td className="h-13 border-b border-subtle p-2 text-primary tabular-nums">
                  {Math.round(bank.soh * 100)}%
                </td>

                {wide && (
                  <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                    {SITE_POWER_ROLE_LABEL[bank.role]}
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
