import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {AlarmBadge} from '@/components/global/AlarmCounts';
import {fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {SiteSummary} from '../data/sites';
import {siteFeed} from '../data/sites';
import {FALLBACK_POWER_ROLE} from '../data/siteConfig';
import {SITE_POWER_ROLE_LABEL} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {supplyMeta} from './supplyMeta';

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
 * and how is it built*, *is anything wrong*, *what is carrying it right now*,
 * *does it need a tanker*. Site draw is deliberately not among them — it is
 * instantaneous and changes while you read the list, which makes it a
 * detail-page figure.
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
 * ## Why `Supply` is what is carrying, not what is installed
 *
 * The column used to be `supplyLabel` — `Mains + 2 gensets` — which is the
 * installed plant, and once the configuration moved under the name that label was
 * saying the same thing twice. It is now `supplyMeta`: **who has the load at this
 * moment** — on mains, on solar, on battery, genset carrying, not served — which
 * is the one site-level fact that changes and the reason to be scanning the list
 * at all. It is the same badge the preview panel and the site's own metric strip
 * draw, so the three cannot disagree; see `supplyMeta.ts` for why the supply is
 * phrased in exactly one place.
 *
 * ## Why `Fuel on site` comes and goes
 *
 * It is the widest column and the one least often the reason for opening this
 * screen, and beside the map there is no room for both it and a supply that reads
 * as a sentence. So it is drawn on the list-only view, where the table has the full
 * width, and dropped on the split view, where the map has half of it. The three
 * remaining columns share the width it gives up — hence two widths per column.
 */
const COLUMNS = [
  {label: 'Site', withFuel: '28%', withoutFuel: '36%', fuel: false},
  {label: 'Alarms', withFuel: '20%', withoutFuel: '22%', fuel: false},
  {label: 'Supply', withFuel: '30%', withoutFuel: '42%', fuel: false},
  {label: 'Fuel on site', withFuel: '22%', withoutFuel: '0%', fuel: true},
] as const;

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
  /**
   * Draw the fuel column. False beside the map — see the note on `COLUMNS`.
   */
  showFuel: boolean;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** The scroll container, for the split view's row watcher. See `GensetsTable`. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Called before this table scrolls itself — see `GensetsTable` for why. */
  onBeforeAutoScroll?: () => void;
};

export const SitesTable = ({
  summaries,
  counts,
  roles,
  showFuel,
  selectedId,
  onSelect,
  scrollRef,
  onBeforeAutoScroll,
}: SitesTableProps) => {
  const columns = showFuel ? COLUMNS : COLUMNS.filter((column) => !column.fuel);
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
          {showFuel
            ? 'Sites, with what is standing against each, what is supplying it right now and fuel on site'
            : 'Sites, with what is standing against each and what is supplying it right now'}
        </caption>
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.label}
              style={{width: showFuel ? column.withFuel : column.withoutFuel}}
            />
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
          {summaries.map((summary) => {
            const selected = summary.site.id === selectedId;
            // `?? FALLBACK_POWER_ROLE` for the reason `siteConfig` gives: a row with
            // no seed behind it is a site we know nothing about, and grid-backed is
            // the safe reading rather than a hybrid we would then draw an array for.
            const role = roles[summary.site.id] ?? FALLBACK_POWER_ROLE;
            // The panel's own reading of who has the load, off `defaultDutyId` —
            // the set the changeover starts on — so a row and the preview it opens
            // cannot name two different sources. See `SiteDetailPanel`.
            const supply = supplyMeta(siteFeed(summary, summary.defaultDutyId, role), role);
            const SupplyIcon = supply.icon;

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
                {/* One line: who has the load. It carried a `N running` count
                    underneath, which was a second fact in a column asked for one —
                    the reader is scanning for the source, and a set turning off-load
                    is a genset-screen detail rather than a qualifier on it. Icon
                    rather than the strip's badge: `Alarms` is already a pill in the
                    next column over, and two pills a row reads as a row of chips. */}
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  <span className="flex items-center gap-1.5 truncate">
                    <SupplyIcon
                      className={cn(
                        'size-3.5 shrink-0',
                        supply.live ? 'text-teal' : 'text-tertiary',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{supply.label}</span>
                  </span>
                </td>
                {showFuel && (
                  <td className="h-13 truncate border-b border-subtle p-2 whitespace-pre text-primary">
                    {fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
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
