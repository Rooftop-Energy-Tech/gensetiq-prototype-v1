import {BellIcon} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount} from '@/lib/format';
import {ALERT_SEVERITIES, countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {SEVERITY_META} from '@/modules/genset/components/detail/severityMeta';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, hybridState, todaySoFarKwh} from '../data/hybrid';
import {siteSeed} from '../data/siteSeed';
import {siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {supplyLabel} from './supplyMeta';

/**
 * The card the design puts top-left, annotated *"things they say they want to see
 * on a summary site level"*.
 *
 * Two halves, and the split is the design's: the **figures that move** across the
 * top, and the **facts that do not** underneath. That ordering is the right way
 * round for the way the page gets read — a reader arrives asking "is anything
 * wrong here today", and the supply configuration and the nameplate are what they
 * fall back to once they know the answer, not what they came for.
 *
 * ## Why the three top metrics are chosen rather than fixed
 *
 * The design draws `Generation today`, `Fuel level` and `Alarm`, which are the
 * right three **for the site it draws** — a solar hybrid with a genset. Two of
 * them do not exist everywhere: a diesel-prime yard has no array to have generated
 * anything, and a grid-backed site with no set fitted has no tank.
 *
 * Fixing the three would mean printing `0 kWh` under `Generation today` at every
 * site without a panel on it, which reads as an array that made nothing rather than
 * as a site that has none — the single most misleading thing this card could do.
 * So the two value columns are drawn from what is actually fitted, in the design's
 * own order of preference, and `Alarm` holds the third column at every site because
 * every site can have one.
 */

/** One of the two value columns: a label over a figure. */
type OverviewMetric = {label: string; value: string};

const metricsFor = (
  summary: SiteSummary,
  role: SitePowerRole,
  now: number,
): Array<OverviewMetric> => {
  const seed = siteSeed(summary.site.id);
  const candidates: Array<OverviewMetric> = [];

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

export const SiteOverviewCard = ({
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
    // 467px is the design's width. `shrink-0` at `md` and up so the diagram beside
    // it takes the slack; full width below, where the two are stacked.
    <div className="flex w-full flex-col gap-3 rounded-md border border-subtle bg-element px-5 py-4 md:w-[467px] md:shrink-0">
      {/* The three columns. `flex-1` each rather than a grid, so a two-metric site
          spreads over the same card instead of leaving a third of it empty. */}
      <div className="flex items-start gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-medium text-secondary">{metric.label}</span>
            <span className="text-base font-semibold text-primary tabular-nums">
              {metric.value}
            </span>
          </div>
        ))}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium text-secondary">Alarm</span>
          {/* Three counts in one pill, coloured rather than labelled — the design's
              treatment, and the only way three numbers fit the column. The tooltip
              spells them out, exactly as the genset row's does. */}
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
      </div>

      {/* The site details, at the bottom. Two rows, and deliberately only two: this
          is the half a reader consults rather than scans, and everything else the
          header's info tooltip already carries. */}
      <div className="mt-auto flex flex-col gap-2.5 pt-1">
        <MetricRow label="Supply" value={supplyLabel(role, summary.gensets.length)} />
        <MetricRow label="Installed capacity" value={amount(summary.ratedKw, 'kW')} />
      </div>
    </div>
  );
};
