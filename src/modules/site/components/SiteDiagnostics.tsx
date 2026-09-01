import {useMemo, useState} from 'react';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {useSitePowerRole} from '../data/siteConfig';
import {siteSeed} from '../data/siteSeed';
import {
  SITE_TREND_METRIC_LABEL,
  SITE_TREND_METRIC_TOKEN,
  SITE_TREND_PERIODS,
  SITE_TREND_PERIOD_LABEL,
  siteTrend,
  siteTrendMetrics,
} from '../data/siteTrend';
import type {SiteTrendMetric, SiteTrendPeriod} from '../data/siteTrend';
import type {SiteSummary} from '../data/sites';
import {SiteTrendChart} from './SiteTrendChart';

/**
 * The page's third band: *"a way for operators to get a quick preview of what is
 * going on at the site through graphs."*
 *
 * ## Why the metric is a control and not four cards
 *
 * The design draws solar generation and annotates the band *"quick diagnostics of
 * the site; load, genset, battery, and solar generation"* — four quantities, one
 * frame. Four stacked charts would push three of them below the fold and make the
 * band a report rather than a preview; four small ones would each be too short to
 * read a shape off, which is the only reason to draw a curve at all.
 *
 * So it is one full-size chart with a picker, and the picker is deliberately
 * left-aligned against the period control on the right: *what* you are looking at
 * and *when* are two different questions, and putting them in one strip would
 * invite a reader to think the eight buttons were eight views.
 *
 * A site only offers the metrics it can answer for — see `siteTrendMetrics`. A yard
 * with no array has no `Solar generation` tab rather than a tab that draws a flat
 * zero, which is the same rule the rest of the page follows about plant that isn't
 * fitted.
 *
 * ## Why the date stepper only appears on `Day`
 *
 * Because it is the only window it means anything in. `Month`, `Year` and
 * `Lifetime` are **trailing** windows — the last thirty days, the last twelve
 * months, the whole record — and a stepper beside a trailing window implies you can
 * page back through months you cannot. The design draws the stepper on the day
 * view, which is the view it belongs to.
 */
export const SiteDiagnostics = ({summary, now}: {summary: SiteSummary; now: number}) => {
  const {site, gensets} = summary;
  const role = useSitePowerRole(site.id);
  const seed = siteSeed(site.id);

  const metrics = useMemo(
    () => (seed === undefined ? [] : siteTrendMetrics(seed, role, gensets.length)),
    [seed, role, gensets.length],
  );

  /**
   * Opens on whatever the site leads with — solar at a hybrid, the load at a site
   * with nothing but a meter. `metrics[0]` rather than a hard-coded `SOLAR`, so a
   * diesel-prime yard does not open on a tab it does not have.
   */
  const [metric, setMetric] = useState<SiteTrendMetric | undefined>(undefined);
  const active: SiteTrendMetric | undefined =
    metric !== undefined && metrics.includes(metric) ? metric : metrics[0];

  const [period, setPeriod] = useState<SiteTrendPeriod>('day');

  /**
   * How many days back the stepper is parked, as a non-negative offset.
   *
   * An offset rather than a timestamp, so the forward stop is `0` — today — and
   * cannot be walked into tomorrow by clock drift or by a reader holding the key
   * down. There is nothing to clamp on the other end for the same reason the
   * period control has no bound: the model answers for any past day.
   */
  const [daysBack, setDaysBack] = useState(0);
  const dayAt = now - daysBack * 86_400_000;

  const trend = useMemo(
    () =>
      seed === undefined || active === undefined
        ? undefined
        : siteTrend(
            seed,
            role,
            gensets.map((member) => member.genset.id),
            active,
            period,
            dayAt,
            now,
          ),
    [seed, role, gensets, active, period, dayAt, now],
  );

  if (trend === undefined || active === undefined) return null;

  return (
    <section
      aria-label="Site diagnostics"
      className="flex flex-col gap-4 rounded-md border border-subtle bg-element px-4 py-4 md:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {/* Only where there is a choice. A site with one answerable metric gets its
            name as a heading rather than a one-option control, which would imply
            three more views that do not exist. */}
        {metrics.length > 1 ? (
          <nav
            aria-label="Diagnostic metric"
            className="flex h-9 items-center rounded-lg bg-inset p-[3px]"
          >
            {metrics.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === active}
                onClick={() => setMetric(option)}
                className={cn(
                  'flex h-full cursor-pointer items-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  option === active
                    ? 'border-subtle bg-highlight text-primary'
                    : 'text-secondary hover:text-primary',
                )}
              >
                {SITE_TREND_METRIC_LABEL[option]}
              </button>
            ))}
          </nav>
        ) : (
          <h2 className="text-sm font-medium text-primary">
            {SITE_TREND_METRIC_LABEL[active]}
          </h2>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {period === 'day' && (
            <div className="flex h-8 items-center gap-1 rounded-md border border-default bg-element px-1 shadow-xs">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDaysBack((back) => back + 1)}
                aria-label="Previous day"
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>

              <span className="min-w-[6.5rem] text-center text-sm text-primary tabular-nums">
                {new Date(dayAt).toLocaleDateString('en-MY', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>

              <Button
                variant="ghost"
                size="icon-xs"
                // Stopped at today rather than hidden, so the control keeps its
                // width and the strip does not jump as a reader steps back and
                // forth. A disabled forward arrow on today is also the clearest
                // statement that there is nothing after it.
                disabled={daysBack === 0}
                onClick={() => setDaysBack((back) => Math.max(0, back - 1))}
                aria-label="Next day"
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          )}

          <nav
            aria-label="Diagnostic period"
            className="flex h-9 items-center rounded-lg bg-inset p-[3px]"
          >
            {SITE_TREND_PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === period}
                onClick={() => setPeriod(option)}
                className={cn(
                  'flex h-full cursor-pointer items-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  option === period
                    ? 'border-subtle bg-highlight text-primary'
                    : 'text-secondary hover:text-primary',
                )}
              >
                {SITE_TREND_PERIOD_LABEL[option]}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <SiteTrendChart trend={trend} colorClassName={SITE_TREND_METRIC_TOKEN[active]} />
    </section>
  );
};
