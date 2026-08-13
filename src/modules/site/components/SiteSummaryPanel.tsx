import {PlugZapIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {coverageOf} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {COVERAGE_META} from './coverageMeta';

/**
 * The site's verdict, beside its diagram.
 *
 * This is an addition to the frame, and the reason for it is that the frame's
 * diagram card is 1300px wide with a 423px diagram in it and nothing else — while
 * the one question a site page exists to answer is not on the page at all. Every
 * figure here is a *site-level* fact that no genset row below can state:
 *
 *  - **coverage** — whether the load is being served, could be served, or can't be;
 *  - **draw against installed capacity** — the headroom, which is the site's
 *    number and not any single set's. A site drawing 205 kW of 1,600 kW installed
 *    can lose a set and not notice; one drawing 1,400 kW cannot;
 *  - **fuel on site** — the tanker question, which is asked per yard rather than
 *    per machine, because one lorry visits a site and fills what's there.
 *
 * Deliberately three lines and one glyph. The detail belongs to the genset rows
 * underneath; if this column grows to compete with them it stops being a summary.
 */
export const SiteSummaryPanel = ({summary}: {summary: SiteSummary}) => {
  const coverage = coverageOf(summary);
  const meta = COVERAGE_META[coverage];
  const Icon = meta.icon;

  const feeding = `${summary.runningCount} of ${summary.gensets.length} feeding`;

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-8">
      <div className="flex w-[113px] shrink-0 flex-col items-center gap-3">
        <Tooltip>
          <TooltipTrigger className="flex cursor-help flex-col items-center gap-2">
            <Icon className={cn('size-8', meta.textClassName)} aria-hidden="true" />
            <p className="text-base font-medium whitespace-nowrap text-primary">{meta.label}</p>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-56">
            {meta.hint}
          </TooltipContent>
        </Tooltip>

        <Badge variant="element" className="w-full border-subtle">
          <PlugZapIcon
            className={summary.runningCount > 0 ? 'text-teal' : 'text-tertiary'}
            aria-hidden="true"
          />
          {feeding}
        </Badge>
      </div>

      <div className="flex w-[260px] shrink-0 flex-col gap-4">
        <MetricRow
          label="Site draw"
          // A site with nothing running is not drawing 0 kW from its gensets — it
          // is drawing nothing *from them*, which is a different sentence, and the
          // dash is how the rest of the app writes "not applicable" rather than
          // "measured as zero".
          value={summary.runningCount > 0 ? amount(summary.loadKw, 'kW') : '—'}
        />
        <MetricRow label="Installed capacity" value={amount(summary.ratedKw, 'kW')} />
        <MetricRow
          label="Fuel on site"
          value={fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
        />
      </div>
    </div>
  );
};
