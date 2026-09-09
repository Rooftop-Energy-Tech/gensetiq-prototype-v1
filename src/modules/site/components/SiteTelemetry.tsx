import {useMemo} from 'react';

import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {hybridPlant, hybridState} from '../data/hybrid';
import {siteOverview} from '../data/siteOverview';
import {siteSeed} from '../data/siteSeed';
import {siteFeed, siteLoadKw} from '../data/sites';
import type {SiteSummary} from '../data/sites';
import {SITE_TREND_METRIC_TOKEN, siteTrend} from '../data/siteTrend';
import type {SiteTrend, SiteTrendMetric} from '../data/siteTrend';
import {deviceGensetId} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';

/**
 * The trend under the card, so the panel says **which way** and not only how much.
 *
 * ## Why it is here and not in the card
 *
 * `SiteDevicePanel` answers *what is this thing doing now*: three figures, a run state,
 * an alarm count. That is what a reader who has just clicked a cabinet wants first, and it
 * is deliberately a still photograph.
 *
 * What it cannot answer is whether the number is on its way up. A bank at 59% is a
 * different call depending on whether it was at 40% an hour ago or at 80%, and the page's
 * own trend band is a scroll away and asks the reader to pick a metric before it says
 * anything. So the selected thing gets one small, unconfigurable chart of the quantity it
 * is actually about, immediately under its figures.
 *
 * **One metric, no controls, one day.** The band below is the place to change period,
 * compare series or step back a day. A second set of controls up here would be a worse
 * copy of it, and the point of this is that it needs no reading of its own: a glance
 * answers "rising or falling" and nothing more.
 *
 * ## The bank is a shape rather than a line
 *
 * State of charge is the one quantity here a line is bad at. It is bounded at both ends,
 * the ends are what matter, and a line through the middle of an axis says nothing about
 * how much is left. So the bank gets a battery drawn as a battery, filled to its charge,
 * with its direction on it — which is the reading every technician already knows how to
 * take — and the day's curve beside it for where it has been.
 *
 * ## Nothing selected is a state, not an empty one
 *
 * Clicking the yard rather than a thing in it is a real question: *how is this site
 * doing?* So the same slot carries the site's own figures — what is carrying it, what it
 * is drawing, what the bank holds, what is in the tank — over the day's load curve. It is
 * the panel's default for that reason: it is the answer to the question a reader arrives
 * with, before they have picked anything out.
 */

/** The chart's box, in its own user units. Small on purpose - see the header. */
const SPARK = {w: 240, h: 56};

/**
 * A day's series as one small chart, and no more than that.
 *
 * Curves are drawn as an area under a line, bars as bars, which is the same distinction
 * `SiteTrend.shape` makes for the big chart and for the same reason: a day of engine hours
 * has no instantaneous value to trace.
 *
 * `null` readings break the line rather than pulling it to zero, per `TrendPoint.value`.
 * The path is emitted as separate move-and-line runs, so an afternoon the record does not
 * reach yet is absent instead of being drawn as a plant that has stopped.
 */
const Spark = ({trend, className}: {trend: SiteTrend; className?: string}) => {
  const values = trend.points.map((point) => point.value);
  const ceiling = Math.max(
    // `axisMax` is the fixed ceiling a bounded quantity has - state of charge is a
    // percentage of a known bank, and letting it auto-scale would draw a day between 71%
    // and 74% as a mountain range.
    trend.axisMax ?? 0,
    ...values.map((value) => (value === null ? 0 : value)),
  );
  const top = ceiling > 0 ? ceiling : 1;
  const step = trend.points.length > 1 ? SPARK.w / (trend.points.length - 1) : SPARK.w;
  const y = (value: number) => SPARK.h - (value / top) * (SPARK.h - 2) - 1;

  // Runs of consecutive readings, so a gap in the record is a gap in the line.
  const runs: Array<Array<[number, number]>> = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (runs.at(-1)?.length !== 0) runs.push([]);
      return;
    }
    if (runs.length === 0) runs.push([]);
    runs[runs.length - 1]?.push([index * step, y(value)]);
  });

  const line = runs
    .filter((run) => run.length > 0)
    .map((run) => run.map(([x, at], index) => `${index === 0 ? 'M' : 'L'}${x},${at}`).join(''))
    .join(' ');

  const area = runs
    .filter((run) => run.length > 1)
    .map((run) => {
      const first = run[0];
      const last = run.at(-1);
      if (first === undefined || last === undefined) return '';
      const path = run.map(([x, at]) => `L${x},${at}`).join('');
      return `M${first[0]},${SPARK.h}${path}L${last[0]},${SPARK.h}Z`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${SPARK.w} ${SPARK.h}`}
      preserveAspectRatio="none"
      className={cn('h-14 w-full', SITE_TREND_METRIC_TOKEN[trend.metric], className)}
      role="img"
      aria-label={`${trend.metric.toLowerCase()}, today, in ${trend.unit}`}
    >
      {trend.shape === 'bars' ? (
        trend.points.map((point, index) =>
          point.value === null || point.value === 0 ? null : (
            <rect
              key={index}
              x={index * step + step * 0.15}
              y={y(point.value)}
              width={Math.max(1, step * 0.7)}
              height={SPARK.h - y(point.value)}
              fill="currentColor"
              opacity={0.55}
            />
          ),
        )
      ) : (
        <>
          <path d={area} fill="currentColor" opacity={0.14} />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
};

/**
 * State of charge, drawn as a battery.
 *
 * Horizontal, with the terminal on the right and the charge filling from the left, which
 * is the convention every phone and every BMS screen already uses. The fill is the bank's
 * own token rather than a traffic light: this component's job is to say how full, and
 * whether that is a problem is the alarm rows' job, which the card above already carries.
 */
const SocGauge = ({soc, flow}: {soc: number; flow: 'charging' | 'discharging' | 'standby'}) => {
  const pct = Math.max(0, Math.min(1, soc));

  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 120 52"
        className="h-11 w-[104px] text-battery"
        role="img"
        aria-label={`State of charge ${Math.round(pct * 100)} per cent, ${flow}`}
      >
        <rect
          x={1}
          y={1}
          width={106}
          height={50}
          rx={7}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          opacity={0.45}
        />
        <rect x={110} y={17} width={9} height={18} rx={2.5} fill="currentColor" opacity={0.45} />
        <rect
          x={6}
          y={6}
          width={Math.max(2, 96 * pct)}
          height={40}
          rx={4}
          fill="currentColor"
          opacity={0.85}
        />
      </svg>
      <div className="flex flex-col">
        <span className="text-lg leading-none font-semibold text-primary">
          {Math.round(pct * 100)}%
        </span>
        <span className="text-[11px] text-secondary">{flow}</span>
      </div>
    </div>
  );
};

const Figure = ({label, value}: {label: string; value: string}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] leading-none text-secondary">{label}</span>
    <span className="text-sm leading-none font-semibold text-primary">{value}</span>
  </div>
);

const Frame = ({title, children}: {title: string; children: React.ReactNode}) => (
  <section aria-label={title} className="flex flex-col gap-2 rounded-lg border border-default bg-element p-3">
    <h3 className="text-[11px] leading-none font-semibold tracking-wide text-secondary uppercase">
      {title}
    </h3>
    {children}
  </section>
);

/** The metric a device's own trend is about. */
const METRIC_OF: Record<'solar' | 'battery' | 'cabinet', SiteTrendMetric> = {
  solar: 'SOLAR',
  battery: 'BATTERY',
  // The DC plant's own quantity is what it is delivering, which is the site's draw. A
  // cabinet has no series of its own in the model, and inventing one would be a chart of
  // a number nothing measures.
  cabinet: 'LOAD',
};

export const SiteTelemetry = ({
  summary,
  role,
  device,
  now,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  /** The selected device, or `undefined` for the site's own overview. */
  device: SiteDeviceKey | undefined;
  now: number;
}) => {
  const seed = siteSeed(summary.site.id);
  const gensetIds = summary.gensets.map(({genset}) => genset.id);
  const gensetId = device === undefined ? undefined : deviceGensetId(device);

  const metric: SiteTrendMetric | undefined =
    device === undefined
      ? 'LOAD'
      : gensetId !== undefined
        ? 'GENSET'
        : device === 'solar' || device === 'battery' || device === 'cabinet'
          ? METRIC_OF[device]
          : undefined;

  const trend = useMemo(
    () =>
      seed === undefined || metric === undefined
        ? undefined
        : siteTrend(seed, role, gensetIds, summary.ratedKw ?? 0, metric, 'day', now, now),
    [seed, role, gensetIds, summary.ratedKw, metric, now],
  );

  // Solar's second figure: how much of the day's load the array actually carried. Taken
  // off the same composition the energy-overview chart draws, so the share quoted here
  // and the bands down there cannot disagree.
  const solarShare = useMemo(() => {
    if (seed === undefined || device !== 'solar') return undefined;

    const overview = siteOverview(seed, role, summary.ratedKw ?? 0, 'day', now, now);
    const total = (id: string) =>
      overview.series
        .find((series) => series.id === id)
        ?.values.reduce<number>((sum, value) => sum + (value ?? 0), 0) ?? 0;

    const load = total('LOAD');
    return load > 0 ? total('SOLAR') / load : undefined;
  }, [seed, device, role, summary.ratedKw, now]);

  if (seed === undefined) return null;

  const plant = hybridPlant(seed, role);
  const state = hybridState(seed, role);

  if (device === 'battery' && hasBattery(role)) {
    const flow =
      state.batteryKw > 0.05
        ? ('discharging' as const)
        : state.batteryKw < -0.05
          ? ('charging' as const)
          : ('standby' as const);

    return (
      <Frame title="State of charge">
        <SocGauge soc={state.soc} flow={flow} />
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-secondary">Charge through today</span>
          <span className="text-[11px] text-secondary">{plant.batteryKwh} kWh usable</span>
        </div>
        {trend !== undefined && <Spark trend={trend} />}
      </Frame>
    );
  }

  if (device === 'solar' && hasSolar(role)) {
    return (
      <Frame title="Generation today">
        <div className="flex items-start justify-between gap-4">
          <Figure label="Generating now" value={amount(state.solarKw, 'kW', 1)} />
          <Figure
            label="Load carried by solar"
            value={solarShare === undefined ? 'no draw yet' : `${Math.round(solarShare * 100)}%`}
          />
        </div>
        {trend !== undefined && <Spark trend={trend} />}
      </Frame>
    );
  }

  if (device !== undefined && trend !== undefined) {
    return (
      <Frame title={gensetId !== undefined ? 'Engine hours today' : 'Site draw today'}>
        <Spark trend={trend} />
      </Frame>
    );
  }

  if (device !== undefined) return null;

  // Nothing selected: the site itself.
  const feed = siteFeed(summary, summary.defaultDutyId, role);
  const loadKw = siteLoadKw(summary, summary.defaultDutyId, role);
  const carrying =
    feed.source === 'GENSET'
      ? 'Genset'
      : feed.source === 'SOLAR'
        ? 'Solar'
        : feed.source === 'BATTERY'
          ? 'Battery'
          : feed.source === 'MAINS'
            ? 'Mains'
            : 'Nothing';

  return (
    <Frame title="Site at a glance">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Figure label="Carrying the site" value={carrying} />
        <Figure
          label="Site draw"
          value={loadKw === null ? 'not served' : amount(loadKw, 'kW', 1)}
        />
        {hasSolar(role) && (
          <Figure label="Generating" value={amount(state.solarKw, 'kW', 1)} />
        )}
        {hasBattery(role) && (
          <Figure label="State of charge" value={`${Math.round(state.soc * 100)}%`} />
        )}
      </div>
      {trend !== undefined && (
        <>
          <span className="text-[11px] text-secondary">Draw through today</span>
          <Spark trend={trend} />
        </>
      )}
    </Frame>
  );
};
