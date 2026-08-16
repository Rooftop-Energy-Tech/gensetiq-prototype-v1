import {Link} from '@tanstack/react-router';
import {BoomBoxIcon, ChevronRightIcon, DropletIcon, MapPinIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {fuelHeadline} from '@/lib/format';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import type {SiteSummary} from '../data/sites';
import {SITE_KIND_LABEL} from '../data/sites';

/**
 * The estate at phone width: one card per yard.
 *
 * The same call as the fleet's cards, and the same reason — the columns that would
 * survive a narrow screen are not the ones the list is read for. Here the kept
 * facts are condition, what is standing there and whether it needs a tanker, which
 * is the order the list's own columns ask them in.
 *
 * The whole card navigates into the site. At this width there is no preview panel
 * to select into, so the split the table makes between selecting and navigating has
 * nothing to be a split *between*.
 */
const SiteCard = ({summary}: {summary: SiteSummary}) => {
  const condition = CONDITION_META[summary.condition];
  const ConditionIcon = condition.icon;

  return (
    <Link
      to="/sites/$siteId"
      params={{siteId: summary.site.id}}
      className="flex items-center gap-3 rounded-md border border-subtle bg-element px-3 py-3 outline-none transition-colors active:bg-highlight focus-visible:ring-2 focus-visible:ring-outline"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-primary">{summary.site.name}</p>
          <p className="truncate text-xs text-secondary">
            {SITE_KIND_LABEL[summary.site.kind]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            <ConditionIcon className={condition.textClassName} aria-hidden="true" />
            {condition.label}
          </Badge>
          <Badge variant="secondary">
            <BoomBoxIcon className="text-secondary" aria-hidden="true" />
            {summary.gensets.length} · {summary.runningCount} running
          </Badge>
          <Badge variant="secondary" className="whitespace-pre">
            <DropletIcon className="text-fuel" aria-hidden="true" />
            {fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
          </Badge>
        </div>

        <p className="flex min-w-0 items-center gap-1.5 text-xs text-secondary">
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{summary.site.locationLabel}</span>
        </p>
      </div>

      <ChevronRightIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
    </Link>
  );
};

export const SitesCards = ({summaries}: {summaries: Array<SiteSummary>}) => (
  <div className="h-full overflow-y-auto">
    {/* `pb-20` clears the floating nav — the last card has to be scrollable out
        from under it, not merely reachable. */}
    <ul aria-label="Sites" className="flex flex-col gap-2 pb-20">
      {summaries.map((summary) => (
        <li key={summary.site.id}>
          <SiteCard summary={summary} />
        </li>
      ))}
    </ul>
  </div>
);
