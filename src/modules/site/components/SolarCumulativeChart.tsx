import {useRef, useState} from 'react';

import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {SolarCumulativePoint} from '../data/hybrid';

/**
 * Generation added up as it arrives, against the design added up beside it.
 *
 * ## Why this earns a chart of its own beside the bars
 *
 * The bar chart is twelve independent answers; this is one answer that gets
 * longer. They are read for different things, and the reason to draw both is that
 * **a small persistent shortfall is invisible in bars and unmissable here.** Four
 * percent off in a month is a bar a pixel shorter than its neighbour; four
 * percent off every month for a year is two lines that visibly part company, and
 * the gap between them at the right-hand edge is the energy that never arrived.
 *
 * That gap is also the closest this app gets to drawing a return. Money is not on
 * this axis — a second unit on one plot is how a chart stops being read — but the
 * gap is a quantity of diesel that had to be burned instead, and the line under
 * the chart says what it cost. A reader watching the two lines separate is
 * watching the payback move.
 *
 * ## What is shaded, and what that shading means
 *
 * Two regions, and they are different claims. Under the `actual` line, a faint
 * tint of its own colour: energy generated is a quantity, it has an area, and
 * that area is what arrived. Between the two lines, the amber the bar chart
 * already uses for a shortfall: that band is the energy that did **not**.
 *
 * The band is the reason to draw this chart at all. Four percent off in one month
 * is a bar a pixel shorter than its neighbour; four percent off every month is a
 * wedge that opens all the way across the plot, and its width at the right-hand
 * edge is the whole year's shortfall in one mark.
 *
 * Nothing is shaded under the design line on its own. A design figure is a claim
 * about a typical year rather than a quantity that happened, and filling under it
 * would draw a projection as though it had already been generated — the same call
 * the Raeo cumulative chart makes about a distribution forecast.
 */

const HEIGHT = 176;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const AXIS_WIDTH = 48;
const TICK_ROWS = 4;

const niceMax = (max: number): number => {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max / TICK_ROWS));
  const normalised = max / TICK_ROWS / step;
  const rounded = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * step;
  return rounded * TICK_ROWS;
};

const axisTick = (value: number): string =>
  value >= 1_000_000
    ? `${Math.round(value / 100_000) / 10}G`
    : value >= 1_000
      ? `${Math.round(value / 100) / 10}k`
      : String(Math.round(value));

const kwh = (value: number): string =>
  value >= 10_000
    ? `${Math.round(value / 1_000).toLocaleString('en-MY')} MWh`
    : `${Math.round(value).toLocaleString('en-MY')} kWh`;

export const SolarCumulativeChart = ({points}: {points: Array<SolarCumulativePoint>}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const width = Math.max(300, available);
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const benchmarked = points.some((point) => point.expectedKwh !== null);
  const top = niceMax(
    Math.max(...points.map((p) => Math.max(p.actualKwh, p.expectedKwh ?? 0)), 1),
  );
  const x = (index: number) => AXIS_WIDTH + (plotWidth * index) / Math.max(1, points.length - 1);
  const y = (value: number) => PAD_TOP + plotHeight * (1 - value / top);

  const path = (read: (point: SolarCumulativePoint) => number | null): string =>
    points
      .map((point, index) => {
        const value = read(point);
        return value === null ? null : `${x(index)},${y(value)}`;
      })
      .filter((pair): pair is string => pair !== null)
      .join(' ');

  const area = `${AXIS_WIDTH},${y(0)} ${path((point) => point.actualKwh)} ${x(points.length - 1)},${y(0)}`;

  // The wedge between design and actual, closed by walking the actual line back.
  // Only where there is a design to be short of, and only where the shortfall is
  // real — an array ahead of its number would otherwise draw the band inverted.
  const shortfallBand = benchmarked
    ? `${path((point) => point.expectedKwh)} ${points
        .map((point, index) => ({point, index}))
        .reverse()
        .filter(({point}) => point.expectedKwh !== null)
        .map(({point, index}) => `${x(index)},${y(point.actualKwh)}`)
        .join(' ')}`
    : '';

  const ticks = Array.from({length: TICK_ROWS + 1}, (_, index) => (top / TICK_ROWS) * index);
  const shown = hovered === null ? undefined : points[hovered];
  const last = points[points.length - 1];
  const gap = last?.expectedKwh === undefined || last?.expectedKwh === null
    ? undefined
    : last.expectedKwh - last.actualKwh;

  // Every other label once the points are closer together than a short month
  // name — the same rule the bar chart's axis follows.
  const labelEvery = plotWidth / Math.max(1, points.length) >= 26 ? 1 : 2;

  return (
    <div ref={boxRef} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Cumulative generation, ${kwh(last?.actualKwh ?? 0)}${
          gap === undefined ? '' : ` against ${kwh(last?.expectedKwh ?? 0)} of design`
        }`}
        onPointerLeave={() => setHovered(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          const index = Math.round(
            ((ratio * width - AXIS_WIDTH) / plotWidth) * (points.length - 1),
          );
          setHovered(index >= 0 && index < points.length ? index : null);
        }}
      >
        <defs>
          {/* The same hatch the bar chart's shortfall carries, so a reader meets
              one idea twice rather than two ideas once each. */}
          <pattern id="cumulative-shortfall" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect
              width="4"
              height="4"
              className="fill-current text-severity-warning"
              opacity={0.14}
            />
            <path
              d="M0,0 L4,4"
              className="stroke-current text-severity-warning"
              strokeWidth={1.2}
              opacity={0.8}
            />
          </pattern>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={AXIS_WIDTH}
              y1={y(tick)}
              x2={width}
              y2={y(tick)}
              className="stroke-current text-subtle"
              strokeWidth={1}
            />
            <text
              x={AXIS_WIDTH - 8}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-current text-[10px] text-tertiary tabular-nums"
            >
              {axisTick(tick)}
            </text>
          </g>
        ))}

        <polygon points={area} className="fill-current text-solar" opacity={0.14} />

        {shortfallBand !== '' && (
          <polygon points={shortfallBand} fill="url(#cumulative-shortfall)" />
        )}

        {benchmarked && (
          <polyline
            points={path((point) => point.expectedKwh)}
            fill="none"
            className="stroke-current text-tertiary"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        )}

        <polyline
          points={path((point) => point.actualKwh)}
          fill="none"
          className="stroke-current text-solar"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hovered !== null && (
          <line
            x1={x(hovered)}
            y1={PAD_TOP}
            x2={x(hovered)}
            y2={PAD_TOP + plotHeight}
            className="stroke-current text-strong"
            strokeWidth={1}
          />
        )}

        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={point.at}
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className={cn(
                'fill-current text-[10px]',
                hovered === index ? 'text-primary' : 'text-tertiary',
              )}
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="h-0.5 w-3 rounded-full bg-solar" aria-hidden="true" />
          Generated
        </span>
        {benchmarked && (
          <>
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="h-0.5 w-3 rounded-full bg-tertiary" aria-hidden="true" />
              Design P50
            </span>
            <span className="flex items-center gap-1.5 text-secondary">
              <span
                className="h-2 w-3 rounded-[2px] bg-severity-warning/25 ring-1 ring-severity-warning/60"
                aria-hidden="true"
              />
              {gap === undefined || gap <= 0 ? 'Short of design' : `${kwh(gap)} short`}
            </span>
          </>
        )}
        <span className={cn('tabular-nums', shown === undefined ? 'text-tertiary' : 'text-primary')}>
          {shown === undefined
            ? `${kwh(last?.actualKwh ?? 0)} to date`
            : `${shown.label} · ${kwh(shown.actualKwh)}${
                shown.expectedKwh === null ? '' : ` of ${kwh(shown.expectedKwh)}`
              }`}
        </span>
      </div>
    </div>
  );
};
