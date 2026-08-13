import {Link} from '@tanstack/react-router';

import {Badge} from '@/components/ui/badge';
import {fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {coverageOf} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {SITE_KIND_LABEL} from '../data/sites';
import {COVERAGE_META} from './coverageMeta';

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
 * it*, *is it covered*, *is anything wrong*, *what is standing there*, *does it
 * need a tanker*. Site draw is deliberately not among them — it is instantaneous
 * and changes while you read the list, which makes it a detail-page figure.
 */
const COLUMNS = [
  {label: 'Site', width: '20%'},
  {label: 'Location', width: '20%'},
  {label: 'Coverage', width: '13%'},
  {label: 'Condition', width: '13%'},
  {label: 'Gensets', width: '16%'},
  {label: 'Fuel on site', width: '18%'},
] as const;

export const SitesTable = ({summaries}: {summaries: Array<SiteSummary>}) => (
  <div className="h-full overflow-auto">
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <caption className="sr-only">
        Sites, with coverage, condition, the gensets installed and fuel on site
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
          const coverage = COVERAGE_META[coverageOf(summary)];
          const CoverageIcon = coverage.icon;
          const condition = CONDITION_META[summary.condition];
          const ConditionIcon = condition.icon;

          return (
            <tr key={summary.site.id} className="group">
              <td className="h-13 truncate border-b border-subtle p-2 font-medium">
                {/* The whole row is not clickable, unlike the fleet table's. There
                    the row *selects* into a preview panel and the name navigates,
                    so the two needed separating; here there is only one thing a
                    site row can do, and one link says so plainly. */}
                <Link
                  to="/sites/$siteId"
                  params={{siteId: summary.site.id}}
                  className="block truncate rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-outline"
                >
                  {summary.site.name}
                </Link>
                <span className="block truncate text-xs text-tertiary">
                  {SITE_KIND_LABEL[summary.site.kind]}
                </span>
              </td>
              <td className="h-13 truncate border-b border-subtle p-2 text-primary">
                {summary.site.locationLabel}
              </td>
              <td className="h-13 border-b border-subtle p-2">
                <Badge variant="secondary">
                  <CoverageIcon className={coverage.textClassName} aria-hidden="true" />
                  {coverage.label}
                </Badge>
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
