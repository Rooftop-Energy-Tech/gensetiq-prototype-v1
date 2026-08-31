import {Badge} from '@/components/ui/badge';
import {amount, fuelHeadline} from '@/lib/format';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import type {SitePowerRole} from '../types/site.type';
import {siteFeed} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {supplyLabel, supplyMeta} from './supplyMeta';

/**
 * The site's figures, beside its diagram.
 *
 * This is an addition to the frame, and the reason for it is that the frame's
 * diagram card is 1300px wide with a 423px diagram in it and nothing else. Every
 * figure here is a *site-level* fact that no genset row below can state:
 *
 *  - **what is feeding** — how many of the sets standing here are on the bus;
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
 * Deliberately short. The detail belongs to the genset rows underneath; if this
 * column grows to compete with them it stops being a summary.
 */
export const SiteSummaryPanel = ({
  summary,
  dutyId,
  role,
}: {
  summary: SiteSummary;
  dutyId: string | undefined;
  role: SitePowerRole;
}) => {
  const feed = siteFeed(summary, dutyId, role);

  // What is feeding the load, and how a site of this configuration says it — see
  // `supplyMeta`, which the list's preview panel reads too.
  const supply = supplyMeta(feed, role, summary.gensets.length);

  const SupplyIcon = supply.icon;

  return (
    // Stacked rather than side by side: the verdict reads down into the figures
    // that justify it, and the column then sits at the diagram's own height
    // instead of stretching the top section across two thirds of the page.
    // 260px is the design's column. On a phone it is the full width instead, so the
    // three metric rows keep their label/value split rather than crushing it into a
    // 260px block beside empty space.
    // `gap-5`, not the `gap-8` this carried. The column holds a badge and five
    // short rows, and eight units between them spread 150px of content over 230px
    // of band — which is where most of this page's air was coming from.
    <div className="flex w-full shrink-0 flex-col gap-4 md:w-[240px] md:gap-5">
      {/* Auto rather than the old fixed 113px: "1 of 2 feeding" set that width, and
          the badge now also has to hold "On generator" without clipping it. */}
      <div className="flex shrink-0 flex-col items-start gap-3">
        <Badge variant="element" className="border-subtle">
          <SupplyIcon
            className={supply.live ? 'text-teal' : 'text-tertiary'}
            aria-hidden="true"
          />
          {supply.label}
        </Badge>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2.5 md:w-[240px]">
        {/* How the yard is fed, which is the fact the badge above is a reading of.
            Stated because the diagram alone leaves a reader to infer the absence of
            a mains node, and an absence is a poor way to state a fact. */}
        <MetricRow label="Supply" value={supplyLabel(role, summary.gensets.length)} />
        <MetricRow label="Installed capacity" value={amount(summary.ratedKw, 'kW')} />
        <MetricRow
          label="Fuel on site"
          value={fuelHeadline(summary.fuelLitres, summary.fuelCapacityLitres)}
        />

      </div>
    </div>
  );
};
