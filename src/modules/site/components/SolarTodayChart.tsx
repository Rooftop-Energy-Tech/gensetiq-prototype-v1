import {useRef, useState} from 'react';

import {ChartMetrics} from '@/components/global/ChartMetrics';
import {ChartTooltip} from '@/components/global/ChartTooltip';
import {useElementSize} from '@/lib/useElementSize';
import type {SolarPoint} from '../data/hybrid';

/**
 * Today's power curve: what the arrays are putting out right now, and what they
 * do at this time on an ordinary day.
 *
 * ## Why a curve and not another bar
 *
 * The bars answer "how much", over a period. This answers "how is it going", at a
 * moment, and those are different enough that drawing them the same way would
 * make a reader look for a comparison that is not there. A day is also the one
 * window where the *shape* carries the information: an array shaded from three
 * o'clock and an array that tripped at three both make the same reduced total,
 * and only the curve tells them apart.
 *
 * ## The line stops at now
 *
 * `kw` is `null` after the current moment and the path breaks there, rather than
 * running along the bottom. A curve drawn to zero across the rest of the
 * afternoon reports an array that has failed, which at ten in the morning is
 * every array on the estate.
 *
 * ## What the second line is
 *
 * The array's **own recent normal** — this month's energy spread over this
 * month's days, in the same shape. It answers "has this thing changed", which is
 * the only comparison a half-hourly curve can carry honestly, and the legend says
 * `Typical day` rather than anything that sounds like a target.
 */

const HEIGHT = 150;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;
const AXIS_WIDTH = 40;
const TICK_ROWS = 3;

const niceMax = (max: number): number => {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max / TICK_ROWS));
  const normalised = max / TICK_ROWS / step;
  const rounded = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * step;
  return rounded * TICK_ROWS;
};

export const SolarTodayChart = ({points}: {points: Array<SolarPoint>}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const width = Math.max(240, available);
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const top = niceMax(
    Math.max(...points.map((p) => Math.max(p.kw ?? 0, p.typicalKw)), 1),
  );
  const x = (index: number) => AXIS_WIDTH + (plotWidth * index) / Math.max(1, points.length - 1);
  const y = (kw: number) => PAD_TOP + plotHeight * (1 - kw / top);

  const line = (read: (point: SolarPoint) => number | null): string =>
    points
      .map((point, index) => {
        const value = read(point);
        return value === null ? null : `${x(index)},${y(value)}`;
      })
      .filter((pair): pair is string => pair !== null)
      .join(' ');

  // The filled region under the metered half only. Output so far is a quantity —
  // it has an area — and the typical-day line is a comparison, which does not.
  const measured = points.filter((point) => point.kw !== null);
  const area =
    measured.length === 0
      ? ''
      : `${AXIS_WIDTH},${y(0)} ${line((point) => point.kw)} ${x(measured.length - 1)},${y(0)}`;

  const ticks = Array.from({length: TICK_ROWS + 1}, (_, index) => (top / TICK_ROWS) * index);
  const shown = hovered === null ? undefined : points[hovered];
  const latest = measured[measured.length - 1];

  // The plot is drawn in viewBox units and laid out in CSS pixels; below the
  // minimum width they part company, and the tooltip is positioned in the latter.
  const frameWidth = available > 0 ? available : width;
  const scale = frameWidth / width;

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="pb-3">
        <ChartMetrics
          metrics={[{key: 'now', label: 'generating now', value: `${latest?.kw ?? 0} kW`}]}
        />
      </div>

      {/* The plot's own positioning box, so the tooltip is offset from the top
          of the frame rather than from the figure above it. */}
      <div className="relative">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={`Solar output through today, now ${latest?.kw ?? 0} kW`}
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
                {Math.round(tick)}
              </text>
            </g>
          ))}

          {area !== '' && <polygon points={area} className="fill-current text-solar" opacity={0.16} />}

          <polyline
            points={line((point) => point.typicalKw)}
            fill="none"
            className="stroke-current text-tertiary"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />

          <polyline
            points={line((point) => point.kw)}
            fill="none"
            className="stroke-current text-solar"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Where the record ends. Without it the line simply stops and reads as an
              array that went quiet, rather than as a day that is not over. */}
          {measured.length > 0 && measured.length < points.length && (
            <>
              <line
                x1={x(measured.length - 1)}
                y1={PAD_TOP}
                x2={x(measured.length - 1)}
                y2={PAD_TOP + plotHeight}
                className="stroke-current text-default"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <circle
                cx={x(measured.length - 1)}
                cy={y(latest?.kw ?? 0)}
                r={3.5}
                className="fill-current text-solar"
              />
            </>
          )}

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

          {[0, Math.floor(points.length / 2), points.length - 1].map((index) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-current text-[10px] text-tertiary"
            >
              {points[index]?.label}
            </text>
          ))}
        </svg>

        {/* The half-hour under the pointer, beside the crosshair rather than in the
            strip below: at 150px tall this frame's whole point is following the
            shape, and a figure parked under it breaks that. */}
        {shown !== undefined && hovered !== null && (
          <ChartTooltip
            x={x(hovered) * scale}
            frameWidth={frameWidth}
            title={shown.label}
            width={168}
            rows={[
              {
                key: 'now',
                label: 'Now',
                value: shown.kw === null ? 'not yet' : `${shown.kw} kW`,
                token: 'text-solar',
              },
              {
                key: 'typical',
                label: 'Typical day',
                value: `${shown.typicalKw} kW`,
                swatch: 'dashed',
              },
            ]}
          />
        )}

        {/* The key, centred under the frame — the band's one layout. The window's
            own figure is above the plot with every other chart's. */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs">
          <span className="flex items-center gap-1.5 text-secondary">
            <span className="h-0.5 w-3.5 shrink-0 rounded-full bg-solar" aria-hidden="true" />
            Now
          </span>
          <span className="flex items-center gap-1.5 text-secondary">
            <span
              className="w-3.5 shrink-0 border-t border-dotted border-tertiary"
              aria-hidden="true"
            />
            Typical day
          </span>
        </div>
      </div>
    </div>
  );
};
