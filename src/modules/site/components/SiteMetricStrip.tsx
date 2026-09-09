import type {ReactNode} from 'react';

import {Badge} from '@/components/ui/badge';
import {MetricStrip} from '@/components/global/MetricStrip';
import {amount} from '@/lib/format';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, hybridState, todaySoFarKwh} from '../data/hybrid';
import {siteSeed} from '../data/siteSeed';
import {useSiteAlarmQueue} from '../data/siteAlarmQueue';
import {siteDcBus, siteFeed, siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {supplyMeta} from './supplyMeta';

/**
 * The page's first band: one full-width strip of the figures that move.
 *
 * The markup is `MetricStrip`, shared with the solar and battery pages — all three
 * designs draw the same rule. What is left here is the part that is about a *site*:
 * which figures it can answer for, what is feeding it, and how its alarms are
 * counted.
 *
 * ## The four columns, and which of them is contested
 *
 * Three are fixed. **Site draw** is the site-level essential — it is the only
 * column that carries a figure about *the tower* rather than about the plant
 * standing beside it, and it is where the DC bus reading hangs (see below).
 * **Alarm** holds the third column at every site, because every site can have one —
 * and it counts what the site's Alarms tab lists, not just the gensets'. See below.
 * **Supply** holds the fourth for the same reason: every site is being fed by
 * something, including by nothing.
 *
 * That leaves one slot, and it is contested. The design draws `Generation today`
 * and `Fuel level`, which are the right two **for the site it draws** — a solar
 * hybrid with a genset. Neither exists everywhere: a diesel-prime yard has no array
 * to have generated anything, and a grid-backed site with no set fitted has no
 * tank. Fixing either would mean printing `0 kWh` under `Generation today` at every
 * site without a panel on it, which reads as an array that made nothing rather than
 * as a site that has none. So the slot is filled from what is actually fitted, in
 * the design's own order of preference, and a site with nothing fitted simply runs
 * three columns.
 *
 * The strip is held there. A column that moves between pages costs a reader the
 * one thing a strip is for — knowing where to look before reading the labels.
 *
 * ## Why the draw carries a bracket
 *
 * `4 kW (53.4 V · 75 A)`. A tower's DC plant has one bus and the three figures are
 * one measurement written three ways, so they belong in one column rather than
 * spread across three that would then have to be read together. The bracket is set
 * smaller and in the secondary colour: the kilowatts are the figure a reader scans
 * the strip for, and the volts and amps are what they came back for once they had
 * decided to look. It wraps to its own line rather than truncating when the column
 * is narrow — the whole point of it is that it is legible.
 */

type StripMetric = {label: string; value: ReactNode};

/**
 * The contested slot, filled from what is actually fitted — see the note above.
 *
 * One entry, not two: the second of the old pair is now `Site draw`, which is
 * pinned. Returned as an array rather than a possibly-`undefined` metric so a site
 * with nothing fitted drops the column instead of drawing an empty one.
 */
const fittedPlantMetric = (
  summary: SiteSummary,
  role: SitePowerRole,
  now: number,
): Array<StripMetric> => {
  const seed = siteSeed(summary.site.id);

  // The design's own order. Generation leads at a site that generates, because it
  // is the number the whole hybrid was bought for.
  if (seed !== undefined && hasSolar(role) && hybridPlant(seed, role).solarKwp > 0) {
    return [
      {
        label: 'Generation today',
        value: amount(Math.round(todaySoFarKwh(seed, role, now)), 'kWh'),
      },
    ];
  }

  if (summary.gensets.length > 0) {
    return [{label: 'Fuel level', value: amount(summary.fuelLitres, 'L')}];
  }

  // Hours, not percent. The slot is contested; a figure whose denominator is off
  // screen — this estate's banks run 38 to 93 kWh, at 78 to 98% health — is the
  // weakest thing that could hold it. The diagram below still carries the
  // percentage, where a level drawn as a level belongs.
  if (seed !== undefined && hasBattery(role) && hybridPlant(seed, role).batteryKwh > 0) {
    return [
      {
        label: 'Battery left',
        value: amount(hybridState(seed, role, now).hoursLeft, 'h', 1),
      },
    ];
  }

  return [];
};

/**
 * The pinned column: what the tower is drawing, and the bus it is drawing it off.
 *
 * `siteLoadKw` returns `null` when nothing is feeding, which is an outage and says
 * so rather than printing `0 kW` — and `siteDcBus` is `null` in exactly that case,
 * so there is no bracket to hang off a figure that isn't there.
 */
const drawMetric = (
  summary: SiteSummary,
  role: SitePowerRole,
  now: number,
): StripMetric => {
  const draw = siteLoadKw(summary, summary.defaultDutyId, role);
  if (draw === null) return {label: 'Site draw', value: 'Not served'};

  const bus = siteDcBus(summary, summary.defaultDutyId, role, now);

  return {
    label: 'Site draw',
    value: (
      <>
        {amount(draw, 'kW')}
        {bus !== null && (
          // A normal space before it, not a non-breaking one: the bracket is
          // allowed — meant — to drop to its own line rather than push the column
          // wider than its share of the strip. `nowrap` *inside* it, so when it
          // does drop it goes as one piece: a break landing between the volts and
          // the amps reads as two unrelated figures.
          <span className="text-sm font-medium whitespace-nowrap text-secondary">
            {' '}
            ({amount(bus.volts, 'V', 1)} · {amount(bus.amps, 'A')})
          </span>
        )}
      </>
    ),
  };
};

/**
 * The fourth column: what is feeding the yard right now.
 *
 * The same `supplyMeta` the sites list's preview panel reads, so the badge a
 * reader clicked through from and the one at the top of this page cannot say two
 * different things. `secondary` rather than the panel's `element` variant: this
 * badge sits *on* the strip's `element` surface, where an `element` badge has no
 * silhouette, and it is the treatment the alarm pill beside it already uses.
 */
const supplyColumn = (summary: SiteSummary, role: SitePowerRole) => {
  const supply = supplyMeta(
    siteFeed(summary, summary.defaultDutyId, role),
    role,
    summary.gensets.length,
  );
  const SupplyIcon = supply.icon;

  return {
    label: 'Supply',
    content: (
      <Badge variant="secondary" className="max-w-full">
        <SupplyIcon
          className={supply.live ? 'text-teal' : 'text-tertiary'}
          aria-hidden="true"
        />
        <span className="truncate">{supply.label}</span>
      </Badge>
    ),
  };
};

export const SiteMetricStrip = ({
  summary,
  role,
  now,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  now: number;
}) => {
  const metrics = [
    ...fittedPlantMetric(summary, role, now),
    drawMetric(summary, role, now),
  ];

  /**
   * Everything standing on the yard — **the same list the Alarms tab shows**.
   *
   * This used to sum the yard's gensets' controller bits and nothing else, which was
   * right when the controller was the only thing on a site that raised an alarm. It
   * is not any more: the monitoring unit watches the plant, the cabinet, the bank and
   * the array, and this app derives its own rules over the generation series. At
   * SBH-1336 the old sum read two while the Alarms tab listed eleven, and a strip that
   * undercounts the page it summarises is worse than no strip — a reader who trusts it
   * never opens the tab.
   *
   * One call for both, so they cannot drift, and clearing a row on the tab drops this
   * count on the way back. See `siteAlarmQueue.ts` for what the union is of.
   */
  const {standing} = useSiteAlarmQueue(summary.site.id, now);
  const counts = countBySeverity(standing);

  return (
    <MetricStrip
      metrics={metrics}
      counts={counts}
      /* No `search` here, unlike the four asset strips: `from` exists to let an asset
         crumb back to the site that opened it, and this *is* that site — its own pages
         are the end of that trail rather than a step along it. */
      alarmLink={{to: '/sites/$siteId/alarms', params: {siteId: summary.site.id}}}
      trailing={supplyColumn(summary, role)}
      ariaLabel="Site summary"
    />
  );
};
