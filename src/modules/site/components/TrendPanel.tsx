import {useMemo, useState} from 'react';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {
  SITE_TREND_METRIC_LABEL,
  SITE_TREND_METRIC_TOKEN,
  SITE_TREND_PERIODS,
  SITE_TREND_PERIOD_LABEL,
  siteTrend,
} from '../data/siteTrend';
import type {SiteTrendMetric, SiteTrendPeriod} from '../data/siteTrend';
import {siteChargeMix, siteOverview} from '../data/siteOverview';
import type {SitePowerRole} from '../types/site.type';
import type {SiteSeed} from '../data/siteSeed';
import {SiteOverviewChart} from './SiteOverviewChart';
import {SiteTrendChart} from './SiteTrendChart';

/**
 * `OVERVIEW` is not a `SiteTrendMetric` and is deliberately kept out of that union.
 *
 * A metric is one quantity in one unit, and every function in `siteTrend.ts` is
 * built on that: a switch over the union returns `Array<TrendPoint>` with a unit
 * beside it. The overview is four quantities at once, from its own model, drawn by
 * its own component. Widening `SiteTrendMetric` to hold it would have put a member
 * in the union that half of `siteTrend`'s switches cannot answer for, and the
 * compiler would have stopped helping at exactly the point it is most needed.
 *
 * So the picker's vocabulary is one wider than the model's, and this is the join.
 */
export const OVERVIEW_VIEW = 'OVERVIEW' as const;

/**
 * The bank's other view — what charged it, by source. Outside `SiteTrendMetric`
 * for the same reason `OVERVIEW` is: it is two quantities on one axis, from
 * `siteChargeMix` rather than from a switch over the metric union.
 */
export const CHARGE_VIEW = 'CHARGE' as const;

export type TrendView = SiteTrendMetric | typeof OVERVIEW_VIEW | typeof CHARGE_VIEW;

/** Which views are drawn by the stacked chart rather than by the single-series one. */
const COMPOSITIONS: ReadonlyArray<TrendView> = [OVERVIEW_VIEW, CHARGE_VIEW];

const VIEW_LABEL: Record<typeof OVERVIEW_VIEW | typeof CHARGE_VIEW, string> = {
  [OVERVIEW_VIEW]: 'Power Supply Distribution',
  [CHARGE_VIEW]: 'Charge mix',
};

const viewLabel = (view: TrendView): string =>
  view === OVERVIEW_VIEW || view === CHARGE_VIEW ? VIEW_LABEL[view] : SITE_TREND_METRIC_LABEL[view];

/**
 * One chart, a metric picker and a period control — the band the site page's
 * diagnostics section is, lifted out so the solar and battery pages can be it too.
 *
 * ## Why it is shared rather than copied
 *
 * Because all three designs draw the same control. The site frame, the solar frame
 * and the battery frame each put a `‹ 31 Aug 2026 ›` stepper beside
 * `Day / Month / Year / Lifetime` over a full-width chart, and the only thing that
 * differs between them is how many metrics the picker offers: the site page offers
 * everything the yard can answer for, a system's page offers generation, a bank's
 * offers its state of charge.
 *
 * That difference is one prop. Three copies of a date stepper is how the forward
 * stop ends up disabled on one page and not the others.
 *
 * ## Why the metrics come in rather than being derived here
 *
 * `siteTrendMetrics` answers "what can this *site* chart", which is the site page's
 * question and not a system's. A solar system's page must show generation and only
 * generation even at a hybrid site whose bank and genset are perfectly chartable —
 * a picker offering `Battery` on `/solar/<id>` would be the register's own boundary
 * dissolving. So the caller names its metrics and this draws them.
 *
 * ## Why the date stepper only appears on `Day`
 *
 * Because it is the only window it means anything in. `Month`, `Year` and
 * `Lifetime` are **trailing** windows — the last thirty days, the last twelve
 * months, the whole record — and a stepper beside a trailing window implies you can
 * page back through months you cannot. The design draws the stepper on the day
 * view, which is the view it belongs to.
 */
export const TrendPanel = ({
  seed,
  role,
  gensetIds,
  metrics,
  ratedKw,
  now,
  ariaLabel,
}: {
  seed: SiteSeed;
  role: SitePowerRole;
  /** Whose run logs the `GENSET` series reads. Empty is fine when it is not offered. */
  gensetIds: Array<string>;
  /** In the order the picker should offer them; the first is the opening view. */
  metrics: ReadonlyArray<TrendView>;
  /**
   * Nameplate across the sets here, which is what turns the two stacked views on.
   *
   * A number rather than a boolean because their genset band is sized from it —
   * see `gensetDay`. A page that wants one of these views has to be able to say how
   * big the plant is, which is the right thing to demand: a composition with a
   * genset band and no nameplate behind it would be drawing a rectangle from
   * nowhere.
   */
  ratedKw?: number;
  now: number;
  ariaLabel: string;
}) => {
  /**
   * Opens on whatever the caller leads with. Held rather than defaulted to a
   * literal, so a page whose metric list changes under it — a site flipped away
   * from solar on its settings tab — falls back to the first it still offers
   * instead of charting one it no longer has.
   */
  const [metric, setMetric] = useState<TrendView | undefined>(undefined);
  const active: TrendView | undefined =
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

  const composed = active !== undefined && COMPOSITIONS.includes(active);

  const trend = useMemo(
    () =>
      active === undefined || active === OVERVIEW_VIEW || active === CHARGE_VIEW
        ? undefined
        : siteTrend(seed, role, gensetIds, ratedKw ?? 0, active, period, dayAt, now),
    [seed, role, gensetIds, ratedKw, active, period, dayAt, now],
  );

  const composition = useMemo(
    () =>
      !composed || ratedKw === undefined
        ? undefined
        : active === CHARGE_VIEW
          ? siteChargeMix(seed, role, ratedKw, period, dayAt, now)
          : siteOverview(seed, role, ratedKw, period, dayAt, now),
    [composed, active, seed, role, ratedKw, period, dayAt, now],
  );

  if (active === undefined) return null;
  if (composed ? composition === undefined : trend === undefined) return null;

  return (
    <section
      aria-label={ariaLabel}
      className="flex flex-col gap-4 rounded-md border border-subtle bg-element px-4 py-4 md:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {/* Only where there is a choice. One answerable metric gets its name as a
            heading rather than a one-option control, which would imply three more
            views that do not exist — and on `/solar` and `/battery` there is
            deliberately only ever one. */}
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
                {viewLabel(option)}
              </button>
            ))}
          </nav>
        ) : (
          <h2 className="text-sm font-medium text-primary">{viewLabel(active)}</h2>
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

      {composition !== undefined ? (
        <SiteOverviewChart overview={composition} />
      ) : trend === undefined || active === OVERVIEW_VIEW || active === CHARGE_VIEW ? null : (
        <SiteTrendChart trend={trend} colorClassName={SITE_TREND_METRIC_TOKEN[active]} />
      )}
    </section>
  );
};
