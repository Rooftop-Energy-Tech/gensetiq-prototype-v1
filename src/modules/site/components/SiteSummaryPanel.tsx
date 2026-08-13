import {PlugZapIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount, fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {coverageOf, siteDrawKw} from '../data/sites';
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
 *  - **installed capacity** — nameplate across the yard, which is the site's number
 *    and not any single set's. Read against the draw on the diagram's `LOAD` node,
 *    it is the headroom: a site pulling 205 kW of 1,600 kW installed can lose a set
 *    and not notice; one pulling 1,400 kW cannot;
 *  - **fuel on site** — the tanker question, which is asked per yard rather than
 *    per machine, because one lorry visits a site and fills what's there.
 *
 * The draw itself is *not* here. It belongs on the diagram's `LOAD` node, where the
 * power actually arrives, rather than as a row in a list beside it.
 *
 * Deliberately two lines and one glyph. The detail belongs to the genset rows
 * underneath; if this column grows to compete with them it stops being a summary.
 */
export const SiteSummaryPanel = ({
  summary,
  dutyId,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
}) => {
  const coverage = coverageOf(summary);
  const meta = COVERAGE_META[coverage];
  const Icon = meta.icon;

  /**
   * "1 of 2 feeding", not "1 of 2 running".
   *
   * At most one set feeds the load, because there is one changeover — so a second
   * turning set is off-load and does not count here. That distinction is the point
   * of the wording: on a site with two running sets, "2 feeding" would claim a
   * parallel installation this yard does not have.
   */
  const feedingCount = siteDrawKw(summary, dutyId) === null ? 0 : 1;
  const feeding = `${feedingCount} of ${summary.gensets.length} feeding`;

  return (
    // Stacked rather than side by side: the verdict reads down into the figures
    // that justify it, and the column then sits at the diagram's own height
    // instead of stretching the top section across two thirds of the page.
    <div className="flex w-[260px] shrink-0 flex-col justify-center gap-8">
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
            className={feedingCount > 0 ? 'text-teal' : 'text-tertiary'}
            aria-hidden="true"
          />
          {feeding}
        </Badge>
      </div>

      <div className="flex w-[260px] shrink-0 flex-col gap-3">
        <MetricRow label="Installed capacity" value={amount(summary.ratedKw, 'kW')} />
        <MetricRow
          label="Fuel on site"
          value={fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
        />
      </div>
    </div>
  );
};
