import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';
import {ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon} from 'lucide-react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {SiteSummary} from '../data/sites';
import {FALLBACK_POWER_ROLE} from '../data/siteConfig';
import {SITE_POWER_ROLE_LABEL} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import type {SiteSort, SiteSortDirection} from '../types/view.type';

/**
 * The sites list — not a frame in the design, which names `Sites` in the sidebar
 * and then draws only a site's *own* page.
 *
 * It exists because the designed page cannot be reached without it: the frame's
 * own breadcrumb reads `Sites › Telco-001`, so a list is the thing that
 * breadcrumb points back at. Built in the fleet table's language — sticky 40px
 * header, 52px rows, hairline rules — rather than as a new pattern, because the
 * two lists answer the same shape of question about different objects.
 *
 * The columns are the site-level facts, in the order they get asked: *what is it
 * and how is it built*, *is anything wrong*, *does it need a tanker*. Site draw is
 * deliberately not among them — it is instantaneous and changes while you read the
 * list, which makes it a detail-page figure.
 *
 * ## Why the configuration sits under the name, and not in its own column
 *
 * The name cell's second line used to be the site *kind* — `Rural coverage site`,
 * `Switching centre` — which says what the site is for and nothing about what
 * stands in the yard. It is now the power role — `Solar hybrid`, `Diesel prime` —
 * because that is the fact the rest of the row has to be read against: a running
 * set is ordinary at a diesel-prime site and an escalation at a hybrid, and the
 * row could not say which without it. It rides under the name rather than taking
 * a column because it is a property *of the site*, the same way the name is.
 *
 * ## Why the second column is a count and not a verdict
 *
 * It was `Condition` — one chip reading `Critical`, `Attention` or `Optimum`, rolled
 * up from the yard's gensets — and it is now the **alarm pill**, the same three
 * figures this app draws on every metric strip and device card. Tristan's call,
 * 2026-09-14.
 *
 * A verdict answers *is anything wrong* and then sends the reader to the site to find
 * out what; the pill answers *how bad* and *how many* in the same width, and it is a
 * link, so the row is one click from the queue itself rather than one click from a
 * page that has the queue on another tab. It also stopped the column lying: the
 * verdict ranked the gensets only, so a site whose monitoring unit was asserting
 * eleven rows could read `Optimum` here. See `useEstateAlarmCounts`.
 *
 * **Every row draws a pill, including a quiet one.** That is the opposite of the rule
 * a badge *row* follows — the site page's device cards hide the pill at zero, because
 * an all-empty chip among `Standby` and `44.6 °C` is an alarm-shaped thing on a healthy
 * machine. A column is not a badge row: it is read down, and a hole in it reads as
 * missing data rather than as nothing standing. A quiet site draws `– – –` here, which
 * holds the column without putting three numbers in it — see `AlarmCounts`.
 *
 * ## Why fuel took the supply column
 *
 * `Supply` said who has the load right now — on mains, on generator, not served —
 * and it is a good column on a *stationary* estate, where the answer is a property
 * of the site and changes on its own. On a mobile fleet the site-level question is
 * blunter: **does a tanker need to go there**. Tristan's call, 2026-09-21.
 *
 * Fuel is also the column that survives the drive. Supply is instantaneous and a
 * reader scanning for it is reading a state that may have changed by the time they
 * arrive; litres in a tank is a fact with hours in it, which is what a dispatch
 * decision is made against. The supply badge has not gone anywhere — it leads the
 * preview panel and the site's own metric strip, where one site is the subject and
 * the reading is live in front of you.
 *
 * ## Why `Fuel on site` no longer comes and goes
 *
 * It was drawn on the list-only view and dropped beside the map, because there was
 * no room for both it and a supply that reads as a sentence. With supply gone there
 * are three columns at every width and one set of widths, so the split view shows
 * the same table as the full one rather than a narrower edit of it.
 */
/**
 * ## Why the ordering is on the headers and not in a dropdown
 *
 * All three columns are sortable, and each one *is* the control for its own key —
 * `Site` orders by name, `Alarms` by what is standing, `Fuel on site` by how empty
 * the tank is. Tristan's call, 2026-09-21; it replaced the toolbar's `SortSelect`,
 * which said the same three words a hand's width away from the column each of them
 * named.
 *
 * A header says *this column is the order* in the place a reader is already looking
 * when they decide they want it, and it costs nothing when they do not — a dropdown
 * holds width on every screen whether or not anybody ever opens it. It also gives
 * the second direction somewhere to live: the dropdown offered one way per key
 * because six rows where three are the reverse of the other three is a bad list, and
 * a header has a second click to spend instead.
 *
 * The dropdown has not gone entirely — it is still the control on a phone and on the
 * map-only view, where there is no header row to click. See `SitesToolbar`.
 */
const COLUMNS = [
  {label: 'Site', width: '40%', sort: 'name'},
  {label: 'Alarms', width: '28%', sort: 'alarms'},
  {label: 'Fuel on site', width: '32%', sort: 'fuel'},
] as const satisfies ReadonlyArray<{label: string; width: string; sort: SiteSort}>;

/**
 * The width below which this table scrolls sideways rather than squeezing.
 *
 * The `Alarms` column holds a **fixed-size object**: the pill is a bell and three
 * 20px cells, 80px however narrow its column gets, because cells that resized as
 * counts crossed into double figures would shift everything beside them (see
 * `AlarmCounts`). A percentage column can therefore be given less width than its
 * contents, and in a `table-fixed` layout the overflow lands *on the next column* —
 * the counts printed over the supply label, which is how this first shipped.
 *
 * 600px is where 20% is comfortably past 80px and a hair of padding. Below it the
 * row's own scroll container takes over, which is the honest failure: a table you
 * can push sideways, rather than two columns wearing each other.
 *
 * It only bites in the split view between 768px — where the cards take over
 * entirely — and roughly 1220px, where the map's own `min-w-[620px]` is already
 * pushing the page wider than the viewport.
 */
const TABLE_MIN_WIDTH = 'min-w-[600px]';

/**
 * What a site with no entry in the counts map draws — a pill of dashes rather than a
 * blank cell, for the reason the column always draws a pill. The map is built over the
 * same seeds the summaries are, so this is a guard rather than a state anybody will
 * meet.
 */
const EMPTY_COUNTS: Record<AlertSeverity, number> = {CRITICAL: 0, WARNING: 0, NEUTRAL: 0};

type SitesTableProps = {
  summaries: Array<SiteSummary>;
  /**
   * Every site's standing count, from `useEstateAlarmCounts` — one pass over the
   * estate rather than a subscription per row, so every pill in the table reads the
   * same moment. See the hook for why the table cannot fetch its own.
   */
  counts: Record<string, Record<AlertSeverity, number>>;
  /**
   * Every site's effective power role, from `useSitePowerRoles`.
   *
   * The whole map rather than a lookup per row for the reason that hook gives: the
   * roles are reader-editable on a site's Settings tab, and one subscription for the
   * table keeps every row reading the same moment.
   */
  roles: Record<string, SitePowerRole>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Which column the list is ordered by, and which way it runs. */
  sort: SiteSort;
  direction: SiteSortDirection;
  /**
   * A header was clicked. The page decides what that means — pick up a new key at
   * its natural direction, or flip the one already showing — so the two lists that
   * share this state cannot answer a click differently. See `SitesPage`.
   */
  onSortChange: (next: SiteSort) => void;
  /** The scroll container, for the split view's row watcher. See `GensetsTable`. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Called before this table scrolls itself — see `GensetsTable` for why. */
  onBeforeAutoScroll?: () => void;
};

export const SitesTable = ({
  summaries,
  counts,
  roles,
  selectedId,
  onSelect,
  sort,
  direction,
  onSortChange,
  scrollRef,
  onBeforeAutoScroll,
}: SitesTableProps) => {
  const columns = COLUMNS;
  // Bring a selection made on the map into view — the fleet table's effect, over
  // sites. See `GensetsTable` for the reasoning and the sticky-header offset.
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
  // the table scrolls out from under the row being chosen. The site's own page is
  // reached through the name link in the first cell, which is in the tab order
  // right after the row.
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
          Sites, with what is standing against each and the fuel on site
        </caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.label} style={{width: column.width}} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = column.sort === sort;
              // The arrow that is showing on the active column, and the one a click
              // would move it to on the others. `ChevronsUpDown` on the inactive
              // headers is the affordance — it appears on hover and on focus, so the
              // row is not three arrows arguing about which column is the order.
              const Icon = !active
                ? ChevronsUpDownIcon
                : direction === 'asc'
                  ? ArrowUpIcon
                  : ArrowDownIcon;
              return (
                <th
                  key={column.label}
                  scope="col"
                  // `none` rather than omitted on the inactive columns: the
                  // attribute is what tells a screen reader the *other* headers are
                  // sortable at all, and without it only one of the three announces
                  // itself as a control.
                  aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="sticky top-0 z-10 h-10 border-b border-subtle bg-canvas px-2 text-left font-medium whitespace-nowrap text-secondary"
                >
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
                    {/* The header reads as a plain word; this is the part that says
                        what the click does, and what it did. */}
                    <span className="sr-only">
                      {active
                        ? `Sorted by ${column.label.toLowerCase()} — click to reverse`
                        : `Sort by ${column.label.toLowerCase()}`}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => {
            const selected = summary.site.id === selectedId;
            // `?? FALLBACK_POWER_ROLE` for the reason `siteConfig` gives: a row with
            // no seed behind it is a site we know nothing about, and grid-backed is
            // the safe reading rather than a hybrid we would then draw an array for.
            const role = roles[summary.site.id] ?? FALLBACK_POWER_ROLE;
            return (
              <tr
                key={summary.site.id}
                data-row-id={summary.site.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(summary.site.id)}
                onKeyDown={(event) => handleKeyDown(event, summary.site.id)}
                className={cn(
                  'group cursor-pointer transition-colors outline-none',
                  'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-outline',
                  selected && 'bg-highlight hover:bg-highlight',
                )}
              >
                <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                  {/* The row selects into the preview panel and the name navigates,
                      the split the fleet table already makes. It used to be one
                      link because a site row had only one thing it could do; the
                      map gave it a second, and a row that behaved differently
                      depending on which view was showing would read as broken.
                      `stopPropagation` so the click doesn't also fire the row's
                      select on a screen we are in the middle of leaving. */}
                  <Link
                    to="/sites/$siteId"
                    params={{siteId: summary.site.id}}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                  >
                    {summary.site.name}
                  </Link>
                  <span className="block truncate text-xs text-secondary">
                    {SITE_POWER_ROLE_LABEL[role]}
                  </span>
                </td>
                <td className="h-13 border-b border-subtle p-2">
                  {/* The pill navigates and the row selects, the split the name cell
                      above already makes — so `stopPropagation`, or opening the queue
                      would also move the preview panel onto a site we are leaving. */}
                  <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
                    <AlarmBadge
                      counts={counts[summary.site.id] ?? EMPTY_COUNTS}
                      to="/sites/$siteId/alarms"
                      params={{siteId: summary.site.id}}
                    />
                  </span>
                </td>
                {/* Litres and the percentage behind them. The litres are what a reader
                    orders a tanker against; the percentage is what says whether it is
                    urgent, since a tank's size differs between sites and the litres
                    alone are not comparable down the column. */}
                <td className="h-13 truncate border-b border-subtle p-2 whitespace-pre text-primary">
                  {fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
