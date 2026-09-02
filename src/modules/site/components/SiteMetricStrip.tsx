import {BellIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount} from '@/lib/format';
import {ALERT_SEVERITIES, countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, hybridState, todaySoFarKwh} from '../data/hybrid';
import {siteSeed} from '../data/siteSeed';
import {siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';

/**
 * The page's first band: one full-width strip of the figures that move.
 *
 * Three equal columns, which is the design's — a label over a figure, twice, then
 * the alarm counts. Equal thirds rather than content-width columns, so the strip
 * reads as a rule across the page and the eye can drop to any of the three without
 * hunting; content-width columns would bunch every site's figures at the left and
 * leave the rest of a 1,734px band empty.
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

  if (seed !== undefined && hasBattery(role) && hybridPlant(seed, role).batteryKwh > 0) {
    candidates.push({
      label: 'Battery charge',
      value: `${Math.round(hybridState(seed, role, now).soc * 100)}%`,
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

  // Site-level, which means summed across the yard's sets. A site's alarm count is
  // the count of everything standing on it — an operator triaging a fleet does not
  // care which of two machines the two criticals came from until they have decided
  // to come here at all.
  const counts = summary.gensets.reduce<Record<AlertSeverity, number>>(
    (total, member) => {
      const own = countBySeverity(member.detail.alerts);
      for (const severity of ALERT_SEVERITIES) total[severity] += own[severity];
      return total;
    },
    {CRITICAL: 0, WARNING: 0, NEUTRAL: 0},
  );

  return (
    <section
      aria-label="Site summary"
      // A column at phone width: three equal thirds of a 390px screen gives each
      // figure 120px, which is narrower than "Generation today" needs.
      className="flex flex-col gap-4 rounded-md border border-subtle bg-element px-5 py-4 sm:flex-row sm:gap-3"
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium text-secondary">{metric.label}</span>
          <span className="text-base font-semibold text-primary tabular-nums">
            {metric.value}
          </span>
        </div>
      ))}

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="truncate text-sm font-medium text-secondary">Alarm</span>
        {/* Three counts in one pill, coloured rather than labelled — the design's
            treatment, and the only way three numbers fit the column. The tooltip
            spells them out, exactly as each device row's does. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-help gap-1.5">
              <BellIcon className="text-secondary" aria-hidden="true" />
              {ALERT_SEVERITIES.map((severity) => (
                <span key={severity} className={SEVERITY_META[severity].textClassName}>
                  {counts[severity]}
                </span>
              ))}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col gap-1">
            {ALERT_SEVERITIES.map((severity) => (
              <span key={severity}>
                {SEVERITY_META[severity].label} · {counts[severity]}
              </span>
            ))}
          </TooltipContent>
        </Tooltip>
      </div>
    </section>
  );
};
