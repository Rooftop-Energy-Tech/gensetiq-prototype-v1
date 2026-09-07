import {Link} from '@tanstack/react-router';
import {useEffect} from 'react';
import type {KeyboardEvent, RefObject} from 'react';

import {Badge} from '@/components/ui/badge';
import {fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import type {SiteSummary} from '../data/sites';
import {SITE_KIND_LABEL} from '../data/sites';
import {FALLBACK_POWER_ROLE} from '../data/siteConfig';
import type {SitePowerRole} from '../types/site.type';
import {supplyLabel} from './supplyMeta';

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
 * The columns are the site-level facts, in the order they get asked: *where is
 * it*, *is anything wrong*, *how is it fed and what is standing there*, *does it
 * need a tanker*. Site draw is deliberately not among them — it is instantaneous
 * and changes while you read the list, which makes it a detail-page figure.
 *
 * ## Why `Supply` and not `Gensets`
 *
 * The column used to be the genset count and how many of them were turning, which
 * answered *what is standing there* and left *what kind of site is this* to be
 * discovered by clicking in. It is now `supplyLabel` — `Mains + 2 gensets`, `Solar
 * + battery + 2 gensets` — which is a superset: the count is still in it, and the
 * configuration the row is about is now legible from the list.
 *
 * That label is the same one the site's own Details tab prints, deliberately. See
 * `supplyMeta.ts` for why the supply is phrased in exactly one place.
 *
 * ## Why `Fuel on site` comes and goes
 *
 * It is the widest column and the one least often the reason for opening this
 * screen, and beside the map there is no room for both it and a supply that reads
 * as a sentence. So it is drawn on the list-only view, where the table has the full
 * width, and dropped on the split view, where the map has half of it. The four
 * remaining columns share the width it gives up — hence two widths per column.
 */
const COLUMNS = [
  {label: 'Site', withFuel: '22%', withoutFuel: '24%', fuel: false},
  {label: 'Location', withFuel: '21%', withoutFuel: '26%', fuel: false},
  {label: 'Condition', withFuel: '14%', withoutFuel: '16%', fuel: false},
  {label: 'Supply', withFuel: '23%', withoutFuel: '34%', fuel: false},
  {label: 'Fuel on site', withFuel: '20%', withoutFuel: '0%', fuel: true},
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
            ? 'Sites, with condition, how each is supplied and fuel on site'
            : 'Sites, with condition and how each is supplied'}
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
                    {SITE_KIND_LABEL[summary.site.kind]}
                  </span>
                </td>
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {summary.site.locationLabel}
                </td>
                <td className="h-13 border-b border-subtle p-2">
                  <Badge variant="secondary">
                    <ConditionIcon className={condition.textClassName} aria-hidden="true" />
                    {condition.label}
                  </Badge>
                </td>
                {/* Two lines, the shape the Site cell already uses: the
                    configuration on top, and how much of it is turning under it.
                    A running set means something different in each configuration —
                    ordinary at a prime site, the backstop called on at a hybrid —
                    so the count is worth keeping beside the words that frame it. */}
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  <span className="block truncate">
                    {supplyLabel(role, summary.gensets.length)}
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
