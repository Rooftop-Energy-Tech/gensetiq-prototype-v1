import {Link} from '@tanstack/react-router';
import type {KeyboardEvent} from 'react';

import {Badge} from '@/components/ui/badge';
import {fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import type {SiteSummary} from '../data/sites';
import {SITE_KIND_LABEL} from '../data/sites';

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
 * it*, *is anything wrong*, *what is standing there*, *does it need a tanker*.
 * Site draw is deliberately not among them — it is instantaneous and changes
 * while you read the list, which makes it a detail-page figure.
 */
const COLUMNS = [
  {label: 'Site', width: '22%'},
  {label: 'Location', width: '24%'},
  {label: 'Condition', width: '15%'},
  {label: 'Gensets', width: '18%'},
  {label: 'Fuel on site', width: '21%'},
] as const;

type SitesTableProps = {
  summaries: Array<SiteSummary>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
};

export const SitesTable = ({summaries, selectedId, onSelect}: SitesTableProps) => {
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
    <div className="h-full overflow-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Sites, with condition, the gensets installed and fuel on site
        </caption>
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.label} style={{width: column.width}} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
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

            return (
              <tr
                key={summary.site.id}
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
                <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                  {summary.gensets.length}
                  <span
                    className={cn(
                      'text-secondary',
                      summary.runningCount === 0 && 'text-tertiary',
                    )}
                  >
                    {' · '}
                    {summary.runningCount} running
                  </span>
                </td>
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
