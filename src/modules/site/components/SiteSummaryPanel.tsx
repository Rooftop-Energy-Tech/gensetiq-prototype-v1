import {PlugZapIcon, UtilityPoleIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {amount, fuelHeadline} from '@/lib/format';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import type {SitePowerRole} from '../types/site.type';
import {siteFeed} from '../data/sites';
import type {SiteSummary} from '../data/sites';

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
/**
 * How the yard is fed, in one line — `Mains + 2 gensets`, `1 genset, no mains`.
 *
 * The zero cases are spelled out rather than falling out of the arithmetic, because
 * "Mains + 0 gensets" reads as a defect and "0 gensets, no mains" reads as a bug
 * rather than what it is: a site with nothing supplying it, which is a real thing to
 * be looking at and deserves saying plainly.
 */
const supplyLabel = (role: SitePowerRole, count: number): string => {
  const sets = `${count} genset${count === 1 ? '' : 's'}`;
  if (role === 'STANDBY') return count === 0 ? 'Mains only' : `Mains + ${sets}`;
  return count === 0 ? 'No supply' : `${sets}, no mains`;
};

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

  /**
   * What is feeding the load — and the wording changes with the role, because the
   * question does.
   *
   * At a `PRIME` site the gensets *are* the supply, so **"1 of 2 feeding"** is the
   * useful fact and it is deliberately not "1 of 2 running": at most one set feeds
   * the load, because there is one changeover, so a second turning set is off-load
   * and does not count. On a site with two running sets, "2 feeding" would claim a
   * parallel installation this yard does not have.
   *
   * At a `STANDBY` site that count answers the wrong question. A healthy standby
   * yard has **zero** sets feeding, and a badge reading "0 of 2 feeding" over a site
   * that is running perfectly well on the grid is alarm-shaped where no alarm
   * exists. What matters there is which *supply* has it: mains or diesel.
   */
  const supply =
    feed.source === 'MAINS'
      ? {label: 'On mains', icon: UtilityPoleIcon, live: true}
      : feed.source === 'GENSET'
        ? {
            label: role === 'PRIME' ? `1 of ${summary.gensets.length} feeding` : 'On generator',
            icon: PlugZapIcon,
            live: true,
          }
        : // Both roles reach this, and it is an outage in both — the grid is down and
          // no set picked the load up, or there is no grid and nothing is generating.
          {label: 'Not served', icon: PlugZapIcon, live: false};

  const SupplyIcon = supply.icon;

  return (
    // Stacked rather than side by side: the verdict reads down into the figures
    // that justify it, and the column then sits at the diagram's own height
    // instead of stretching the top section across two thirds of the page.
    // 260px is the design's column. On a phone it is the full width instead, so the
    // three metric rows keep their label/value split rather than crushing it into a
    // 260px block beside empty space.
    <div className="flex w-full shrink-0 flex-col justify-center gap-6 md:w-[260px] md:gap-8">
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

      <div className="flex w-full shrink-0 flex-col gap-3 md:w-[260px]">
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
