import {useMemo, useRef, useState} from 'react';

import {BatteryGlyph} from '@/components/global/BatteryGlyph';
import {amount} from '@/lib/format';
import {useElementSize} from '@/lib/useElementSize';
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

/**
 * A series as SVG paths: the line, and the area under it down to `baseline`.
 *
 * Consecutive readings are emitted as separate move-and-line runs, so a `null` in the
 * record is a gap in the line rather than a plunge to zero — per `TrendPoint.value`, an
 * afternoon the record has not reached is absent, not a plant that has stopped.
 */
const curvePaths = (
  values: Array<number | null>,
  x: (index: number) => number,
  y: (value: number) => number,
  baseline: number,
): {line: string; area: string} => {
  const runs: Array<Array<[number, number]>> = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (runs.at(-1)?.length !== 0) runs.push([]);
      return;
    }
    if (runs.length === 0) runs.push([]);
    runs[runs.length - 1]?.push([x(index), y(value)]);
  });

  const drawn = runs.filter((run) => run.length > 0);

  const line = drawn
    .map((run) => run.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px},${py}`).join(''))
    .join(' ');

  const area = drawn
    .filter((run) => run.length > 1)
    .map((run) => {
      const first = run[0];
      const last = run.at(-1);
      if (first === undefined || last === undefined) return '';
      const path = run.map(([px, py]) => `L${px},${py}`).join('');
      return `M${first[0]},${baseline}${path}L${last[0]},${baseline}Z`;
    })
    .join(' ');

  return {line, area};
};

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

  const {line, area} = curvePaths(values, (index) => index * step, y, SPARK.h);

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
 * The day as a small chart **with its axes** — for the views that have nothing else.
 *
 * ## Why this exists beside `Spark`
 *
 * The bank and the array put a figure beside their sparkline — a percentage, a kW
 * reading — so the line only has to say *which way*. The genset and the cabinet had
 * the sparkline alone: a row of purple bars under a heading, with no scale to read a
 * height against and no hours to place a bar in. That is a picture of a shape, and
 * the questions a reader actually brings to it — how much did that hour burn, when
 * did it start, when did it stop — were all unanswerable from it.
 *
 * So this draws the same series with a labelled axis, gridlines on clean divisions,
 * the hours along the foot, and a readout under the pointer. Still one metric, still
 * one day, still no controls — the trend band remains the place to change any of
 * that. It is only the sparkline with enough scaffolding to be read as a chart.
 *
 * Measured in pixels rather than stretched from a fixed box, because axis text must
 * not distort: `Spark` can use `preserveAspectRatio="none"` precisely because it
 * draws no text.
 */
const DAY = {h: 128, padTop: 18, padBottom: 18, axis: 34, tickRows: 3};

/** A rounded step that lands on clean divisions — the rule the trend charts use. */
const niceStep = (rough: number): number => {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  return (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
};

/** Axis figures written to the precision the step needs, so the column scans. */
const tickLabel = (tick: number, step: number): string =>
  step >= 1 ? String(Math.round(tick)) : tick.toFixed(step >= 0.1 ? 1 : 2);

const DayChart = ({trend}: {trend: SiteTrend}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const {points, unit} = trend;
  const bars = trend.shape === 'bars';

  const width = Math.max(220, available);
  const plotWidth = width - DAY.axis;
  const plotHeight = DAY.h - DAY.padTop - DAY.padBottom;
  const baseline = DAY.padTop + plotHeight;

  const values = points.map((point) => point.value);
  const readings = values.filter((value): value is number => value !== null);
  // A fixed ceiling where the quantity has one; otherwise clean divisions of the
  // day's peak, and a floor of one step so an idle day still draws a scale.
  const high = trend.axisMax ?? Math.max(0, ...readings);
  const tickStep =
    trend.axisMax !== undefined ? trend.axisMax / DAY.tickRows : niceStep(high / DAY.tickRows);
  const top = trend.axisMax ?? Math.max(tickStep, Math.ceil(high / tickStep) * tickStep);

  // Bars sit centred in their own slot; a curve's points sit on the slot edges so the
  // first and last land on the frame.
  const slot = plotWidth / Math.max(1, points.length);
  const x = (index: number) =>
    bars
      ? DAY.axis + slot * index + slot / 2
      : DAY.axis + (plotWidth * index) / Math.max(1, points.length - 1);
  const y = (value: number) => DAY.padTop + plotHeight * (1 - value / top);

  const ticks: Array<number> = [];
  for (let tick = 0; tick <= top + 1e-6; tick += tickStep) ticks.push(Math.round(tick * 100) / 100);

  // About one hour label per 56px, from the left; every label would overlap.
  const stride = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 56))));

  const {line, area} = curvePaths(values, x, y, baseline);
  const shown = hovered === null ? undefined : points[hovered];

  return (
    <div ref={boxRef} className={cn('relative w-full', SITE_TREND_METRIC_TOKEN[trend.metric])}>
      <svg
        width={width}
        height={DAY.h}
        viewBox={`0 0 ${width} ${DAY.h}`}
        className="w-full"
        role="img"
        aria-label={`${trend.caption}, in ${unit}`}
        onPointerLeave={() => setHovered(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const at = ((event.clientX - box.left) / box.width) * width - DAY.axis;
          const index = bars
            ? Math.floor(at / slot)
            : Math.round((at / plotWidth) * (points.length - 1));
          setHovered(index >= 0 && index < points.length ? index : null);
        }}
      >
        {/* The unit above the axis, where the trend charts put it. */}
        <text
          x={DAY.axis - 6}
          y={DAY.padTop - 7}
          textAnchor="end"
          className="fill-current text-[10px] text-tertiary"
        >
          {unit}
        </text>

        {/* The hovered reading, in the top corner where it covers nothing. */}
        {shown !== undefined && (
          <text
            x={width}
            y={DAY.padTop - 7}
            textAnchor="end"
            className="fill-current text-[10px] font-medium text-secondary tabular-nums"
          >
            {shown.label} ·{' '}
            {shown.value === null ? 'not yet reached' : amount(shown.value, unit, 1)}
          </text>
        )}

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={DAY.axis}
              y1={y(tick)}
              x2={width}
              y2={y(tick)}
              className={cn('stroke-current', tick === 0 ? 'text-default' : 'text-subtle')}
              strokeWidth={1}
            />
            <text
              x={DAY.axis - 6}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-current text-[10px] text-tertiary tabular-nums"
            >
              {tickLabel(tick, tickStep)}
            </text>
          </g>
        ))}

        {bars ? (
          points.map((point, index) =>
            point.value === null ? null : (
              <rect
                key={index}
                x={x(index) - slot * 0.35}
                y={y(point.value)}
                width={Math.max(1, slot * 0.7)}
                height={Math.max(0, baseline - y(point.value))}
                rx={1}
                fill="currentColor"
                opacity={hovered === null ? 0.7 : hovered === index ? 1 : 0.35}
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
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {hovered !== null && (
              <line
                x1={x(hovered)}
                x2={x(hovered)}
                y1={DAY.padTop}
                y2={baseline}
                className="stroke-current text-default"
                strokeWidth={1}
              />
            )}
          </>
        )}

        {points.map((point, index) =>
          index % stride === 0 ? (
            <text
              key={point.label}
              x={x(index)}
              y={DAY.h - 4}
              textAnchor="middle"
              className="fill-current text-[10px] text-tertiary tabular-nums"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
};

/**
 * State of charge, drawn as a battery.
 *
 * Horizontal, with the terminal on the right and the charge filling from the left, which
 * is the convention every phone and every BMS screen already uses.
 *
 * ## Why the SVG went
 *
 * This drew that battery itself, in about thirty lines of hand-placed `<rect>` — the
 * right shape, from the same mock, and separately. So the site page showed **two
 * batteries at the same percentage in the same state**, one with a charging bolt and
 * one without, because `BatteryGlyph` had arrived on the other side of a merge and
 * nobody had joined them up. The one drawn here also had no low-charge colours.
 *
 * Its measurements are not lost: they are `BatteryGlyph`'s `xl` size, which is the
 * only place in the app the battery is a frame's subject rather than a mark beside a
 * figure. Nothing a reader can see changed size.
 *
 * The fill is still the bank's own token at a healthy charge, and the fill going amber
 * under 40% is not this component contradicting its old note — "whether that is a
 * problem is the alarm rows' job" is about *raising* something, and a colour beside a
 * figure raises nothing. `BatteryGlyph` argues that boundary, and why the two
 * thresholds must never reach `plantAlarms.ts`.
 */
const SocGauge = ({soc, flow}: {soc: number; flow: 'charging' | 'discharging' | 'standby'}) => (
  <div className="flex items-center gap-3">
    {/* No `label`. The percentage and the direction are real text immediately to the
        right, so labelling the glyph too would read the level twice — the rule every
        other level in this app follows. It used to carry
        `State of charge 71 per cent, charging`, which is exactly that duplication. */}
    <BatteryGlyph fraction={soc} size="xl" charging={flow === 'charging'} />

    <div className="flex flex-col">
      <span className="text-lg leading-none font-semibold text-primary">
        {Math.round(Math.max(0, Math.min(1, soc)) * 100)}%
      </span>
      <span className="text-[11px] text-secondary">{flow}</span>
    </div>
  </div>
);

const Figure = ({label, value}: {label: string; value: string}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] leading-none text-secondary">{label}</span>
    <span className="text-sm leading-none font-semibold text-primary">{value}</span>
  </div>
);

/**
 * The block the reading sits in, as a card or as the foot of one.
 *
 * `embedded` is how the device views are drawn: inside `SiteDeviceCard`, which already has
 * the border and the ground, so a second card in there would be a box in a box. The site
 * overview is the standalone case, because there is no card above it to sit in — nothing
 * is selected, which is what it is reporting.
 */
const Frame = ({
  title,
  embedded,
  children,
}: {
  title: string;
  embedded?: boolean;
  children: React.ReactNode;
}) => (
  <section
    aria-label={title}
    className={cn(
      'flex flex-col gap-3.5',
      embedded === true ? 'w-full' : 'rounded-lg border border-default bg-element p-4',
    )}
  >
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
  embedded,
}: {
  summary: SiteSummary;
  role: SitePowerRole;
  /** The selected device, or `undefined` for the site's own overview. */
  device: SiteDeviceKey | undefined;
  now: number;
  /** Drawn at the foot of the device card rather than as a card of its own. */
  embedded?: boolean;
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
      <Frame title="State of charge" embedded={embedded}>
        <SocGauge soc={state.soc} flow={flow} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[11px] leading-none text-secondary">Charge through today</span>
            <span className="text-[11px] leading-none text-secondary">
              {plant.batteryKwh} kWh usable
            </span>
          </div>
          {trend !== undefined && <Spark trend={trend} />}
        </div>
      </Frame>
    );
  }

  if (device === 'solar' && hasSolar(role)) {
    return (
      <Frame title="Generation today" embedded={embedded}>
        <div className="flex items-start justify-between gap-6">
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
    // The genset's day series is litres burned per hour (see `gensetDayTrend`), so
    // the heading says so — it read `Engine hours today` over a chart of fuel.
    return (
      <Frame
        title={gensetId !== undefined ? 'Fuel burned today' : 'Site draw today'}
        embedded={embedded}
      >
        <DayChart trend={trend} />
        {/* The day's totals, off the same series the bars are drawn from — the
            figures the sparkline views carry beside their chart, which this one had
            nowhere to put until it had a chart worth reading them against. */}
        {(trend.total !== undefined || trend.extra !== undefined) && (
          <div className="flex items-start gap-6">
            {trend.total !== undefined && (
              <Figure label={trend.total.label} value={trend.total.value} />
            )}
            {trend.extra !== undefined && (
              <Figure label={trend.extra.label} value={trend.extra.value} />
            )}
          </div>
        )}
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
    <Frame title="Site at a glance" embedded={embedded}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] leading-none text-secondary">Draw through today</span>
          <Spark trend={trend} />
        </div>
      )}
    </Frame>
  );
};
