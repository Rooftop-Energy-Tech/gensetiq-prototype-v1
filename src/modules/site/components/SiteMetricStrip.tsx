import {MetricStrip} from '@/components/global/MetricStrip';
import {amount} from '@/lib/format';
import {ALERT_SEVERITIES, countBySeverity} from '@/modules/genset/types/alert.type';
import {standingAlarms, useAlarmHandling} from '@/modules/genset/data/alarms';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, hybridState, todaySoFarKwh} from '../data/hybrid';
import {siteSeed} from '../data/siteSeed';
import {siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';

/**
 * The page's first band: one full-width strip of the figures that move.
 *
 * The markup is `MetricStrip`, shared with the solar and battery pages — all three
 * designs draw the same rule. What is left here is the part that is about a *site*:
 * which two figures it can answer for, and how its alarms are counted.
 *
 * ## Why the two figures are chosen rather than fixed
 *
 * The design draws `Generation today` and `Fuel level`, which are the right two
 * **for the site it draws** — a solar hybrid with a genset. Neither exists
 * everywhere: a diesel-prime yard has no array to have generated anything, and a
 * grid-backed site with no set fitted has no tank.
 *
 * Fixing them would mean printing `0 kWh` under `Generation today` at every site
 * without a panel on it, which reads as an array that made nothing rather than as a
 * site that has none. So the two are drawn from what is actually fitted, in the
 * design's own order of preference. `Alarm` holds the third column at every site,
 * because every site can have one.
 *
 * The strip has room for more than three at this width. It is held to the design's
 * three deliberately — a strip that grows a column at hybrid sites and loses one at
 * grid-backed sites stops being a fixed reference line across the estate, which is
 * most of what a strip is for.
 */

type StripMetric = {label: string; value: string};

const metricsFor = (
  summary: SiteSummary,
  role: SitePowerRole,
  now: number,
): Array<StripMetric> => {
  const seed = siteSeed(summary.site.id);
  const candidates: Array<StripMetric> = [];

  // The design's own order. Generation leads at a site that generates, because it
  // is the number the whole hybrid was bought for.
  if (seed !== undefined && hasSolar(role) && hybridPlant(seed, role).solarKwp > 0) {
    candidates.push({
      label: 'Generation today',
      value: amount(Math.round(todaySoFarKwh(seed, role, now)), 'kWh'),
    });
  }

  if (summary.gensets.length > 0) {
    candidates.push({label: 'Fuel level', value: amount(summary.fuelLitres, 'L')});
  }

  // Hours, not percent. The strip has two slots and they are contested; a figure
  // whose denominator is off screen — this estate's banks run 38 to 93 kWh, at 78
  // to 98% health — is the weakest thing that could hold one. The diagram below
  // still carries the percentage, where a level drawn as a level belongs.
  if (seed !== undefined && hasBattery(role) && hybridPlant(seed, role).batteryKwh > 0) {
    candidates.push({
      label: 'Battery left',
      value: amount(hybridState(seed, role, now).hoursLeft, 'h', 1),
    });
  }

  // The backstop, and it is never empty: every site draws something, and a site
  // with nothing fitted is exactly the one where the draw is the only figure there
  // is. `siteLoadKw` returns `null` when nothing is feeding, which is an outage and
  // says so rather than printing `0 kW`.
  const draw = siteLoadKw(summary, summary.defaultDutyId, role);
  candidates.push({
    label: 'Site draw',
    value: draw === null ? 'Not served' : amount(draw, 'kW'),
  });

  return candidates.slice(0, 2);
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
  const metrics = metricsFor(summary, role, now);

  // One subscription for the yard, read per set below. The strip is a sum, and a
  // sum that did not follow a clear would sit above cards that already had.
  const handling = useAlarmHandling();

  // Site-level, which means summed across the yard's sets. A site's alarm count is
  // the count of everything standing on it — an operator triaging a fleet does not
  // care which of two machines the two criticals came from until they have decided
  // to come here at all.
  const counts = summary.gensets.reduce<Record<AlertSeverity, number>>(
    (total, member) => {
      const own = countBySeverity(standingAlarms(member.genset.id, handling));
      for (const severity of ALERT_SEVERITIES) total[severity] += own[severity];
      return total;
    },
    {CRITICAL: 0, WARNING: 0, NEUTRAL: 0},
  );

  return <MetricStrip metrics={metrics} counts={counts} ariaLabel="Site summary" />;
};
