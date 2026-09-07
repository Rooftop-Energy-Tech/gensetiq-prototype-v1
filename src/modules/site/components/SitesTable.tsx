import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {Badge} from '@/components/ui/badge';
import {fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
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
  {label: 'Site', withFuel: '30%', withoutFuel: '36%', fuel: false},
  {label: 'Condition', withFuel: '18%', withoutFuel: '22%', fuel: false},
  {label: 'Supply', withFuel: '30%', withoutFuel: '42%', fuel: false},
  {label: 'Fuel on site', withFuel: '22%', withoutFuel: '0%', fuel: true},
] as const;

type SitesTableProps = {
  summaries: Array<SiteSummary>;
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
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          {showFuel
            ? 'Sites, with condition, what is supplying each right now and fuel on site'
            : 'Sites, with condition and what is supplying each right now'}
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
            const condition = CONDITION_META[summary.condition];
            const ConditionIcon = condition.icon;
            const selected = summary.site.id === selectedId;
            // `?? FALLBACK_POWER_ROLE` for the reason `siteConfig` gives: a row with
            // no seed behind it is a site we know nothing about, and grid-backed is
            // the safe reading rather than a hybrid we would then draw an array for.
            const role = roles[summary.site.id] ?? FALLBACK_POWER_ROLE;
            // The panel's own reading of who has the load, off `defaultDutyId` —
            // the set the changeover starts on — so a row and the preview it opens
            // cannot name two different sources. See `SiteDetailPanel`.
            const supply = supplyMeta(
              siteFeed(summary, summary.defaultDutyId, role),
              role,
              summary.gensets.length,
            );
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
                  <Badge variant="secondary">
                    <ConditionIcon className={condition.textClassName} aria-hidden="true" />
                    {condition.label}
                  </Badge>
                </td>
                {/* Two lines, the shape the Site cell already uses: who has the
                    load on top, and how many sets are turning under it. The count
                    stays because it is not implied by the line above it — a site
                    reading `On mains` with a set turning is a test run, and one
                    reading it with none is an ordinary day. Icon rather than the
                    strip's badge: `Condition` is already a pill in the next column
                    over, and two pills a row reads as a row of chips. */}
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
                  <span
                    className={cn(
                      'block truncate text-xs',
                      summary.runningCount === 0 ? 'text-tertiary' : 'text-secondary',
                    )}
                  >
                    {summary.runningCount} running
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
