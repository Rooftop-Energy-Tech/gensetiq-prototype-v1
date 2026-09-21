import type {ReactNode} from 'react';

import {Badge} from '@/components/ui/badge';
import {MetricStrip} from '@/components/global/MetricStrip';
import {amount, fuelFraction} from '@/lib/format';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {SitePowerRole} from '../types/site.type';
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
 * ## The columns, in the order the design draws them
 *
 * `Supply`, the plant figures, `Site draw`, `Alarm`. **Supply** leads because what
 * is feeding the yard is the fact every other figure on the page is conditional on,
 * and it is the one column every site can fill, including a site being fed by
 * nothing. The **plant figures** follow — `Generation today` and `Fuel level`, the
 * two the design names. **Site draw** then closes the readings: it is the only
 * figure about *the tower* rather than about the plant standing beside it, and
 * where the DC bus reading hangs (see below). **Alarm** is last, and it counts what
 * the site's Alarms tab lists rather than just the gensets'. See below.
 *
 * ## Both plant figures, not one of them, and still only where fitted
 *
 * The strip carried a single contested slot until 2026-09-14 and now draws the pair
 * the design draws. What has not changed is the rule underneath: **neither figure
 * exists everywhere.** A diesel-prime yard has no array to have generated anything,
 * and a grid-backed site with no set fitted has no tank. Printing `0 kWh` under
 * `Generation today` at a site with no panel on it reads as an array that made
 * nothing rather than as a site that has none, so each figure is drawn only where
 * the plant behind it is fitted and the strip is three columns wide at a site with
 * neither.
 *
 * `Battery left` is the fallback for the site that has neither — a bank-only yard
 * would otherwise run a strip with no plant figure at all. It is hours rather than
 * percent: the slot is narrow and a figure whose denominator is off screen — this
 * estate's banks run 38 to 93 kWh, at 78 to 98% health — is the weakest thing that
 * could hold it. The diagram below still carries the percentage, where a level
 * drawn as a level belongs.
 *
 * ## Why the alarm column is last here and third elsewhere
 *
 * It was pinned third on every strip in the app so a reader moving site → solar →
 * battery would find the pill in one place. The design overrules that for the site
 * page: the readings run left to right in the order a reader asks for them, and the
 * pill closes the strip. A site strip is the widest one drawn — five columns
 * against three — and it is the one page a reader arrives at rather than moves
 * between, which is what makes the cost affordable here and nowhere else.
 *
 * The asset strips are untouched: with two readings and no plant figure, last and
 * third are the same column.
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
 * The plant figures this site can actually answer for — see the note above.
 *
 * A list rather than one entry, and it is allowed to be empty: a site with neither
 * no set standing on it drops the column instead of drawing it blank.
 */
const fittedPlantMetrics = (summary: SiteSummary): Array<StripMetric> => {
  const metrics: Array<StripMetric> = [];

  if (summary.gensets.length > 0) {
    // Litres with the percentage behind them, as the design writes it. The litres
    // are what a reader orders a tanker against and the percentage is what tells
    // them whether it is urgent — a tank is the one figure on this strip whose
    // denominator differs between sites, so stating it is what makes the litres
    // comparable across the estate. `fuelFraction` rather than the division, so
    // this and the bar on the genset page round the same way.
    const percent = Math.round(
      fuelFraction(summary.fuelLitres, summary.fuelCapacityLitres) * 100,
    );
    metrics.push({
      label: 'Fuel level',
      value:
        summary.fuelCapacityLitres > 0
          ? `${amount(summary.fuelLitres, 'L')} (${amount(percent, '%')})`
          : amount(summary.fuelLitres, 'L'),
    });
  }

  return metrics;
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
): StripMetric => {
  const draw = siteLoadKw(summary, summary.defaultDutyId, role);
  if (draw === null) return {label: 'Site draw', value: 'Not served'};

  const bus = siteDcBus(summary, summary.defaultDutyId, role);

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
 * The first column: what is feeding the yard right now.
 *
 * The same `supplyMeta` the sites list's preview panel reads, so the badge a
 * reader clicked through from and the one at the top of this page cannot say two
 * different things. `secondary` rather than the panel's `element` variant: this
 * badge sits *on* the strip's `element` surface, where an `element` badge has no
 * silhouette, and it is the treatment the alarm pill beside it already uses.
 */
const supplyColumn = (summary: SiteSummary, role: SitePowerRole): StripMetric => {
  const supply = supplyMeta(siteFeed(summary, summary.defaultDutyId, role));
  const SupplyIcon = supply.icon;

  return {
    label: 'Supply',
    value: (
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
  // Supply, the plant figures this site can answer for, then draw — see the note at
  // the top of the file. The alarm column `MetricStrip` draws for itself closes the
  // strip, and a site with no array and no set simply runs three columns.
  const metrics = [
    supplyColumn(summary, role),
    ...fittedPlantMetrics(summary),
    drawMetric(summary, role),
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
      ariaLabel="Site summary"
    />
  );
};
