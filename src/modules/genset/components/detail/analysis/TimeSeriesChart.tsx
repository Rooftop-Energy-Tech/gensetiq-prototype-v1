import {useMemo, useRef, useState} from 'react';

import {amount, clockTime, dayMonth} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {GensetRun} from '../../../types/run.type';
import {sampleAt} from '../../../types/series.type';
import type {ReadingSeries} from '../../../types/series.type';
import {SEVERITY_META} from '../severityMeta';
import {SERIES_SLOTS} from './seriesMeta';

const HOUR = 3_600_000;

/** Room for an axis: five characters of tick label plus its gap. */
const AXIS_WIDTH = 56;
const PAD_TOP = 24;
const PAD_BOTTOM = 30;
const TICK_ROWS = 5;

/** Wide enough for `Starter battery voltage` — the longest label in the set. */
const READOUT_WIDTH = 228;

type Scale = {
  min: number;
  max: number;
  ticks: Array<number>;
  /** Decimals the tick step actually resolves — not the reading's precision. */
  decimals: number;
};

/**
 * A scale whose ticks land on round numbers.
 *
 * The series hands over a domain padded off its extremes, which is right for
 * framing the trace and wrong for labelling it — nobody wants an axis reading
 * 78.2 / 84.9 / 91.6. This widens that domain to the next round step in each
 * direction, so the labels are 80 / 85 / 90 and the gridlines mean something.
 */
const niceScale = (min: number, max: number): Scale => {
  const rawStep = (max - min) / (TICK_ROWS - 1);
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return {min, max: min + 1, ticks: [min], decimals: 0};
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));

  const ticks: Array<number> = [];
  // Counted rather than accumulated: `value += step` compounds its own floating
  // point error, and by the top of a 0.1-step axis the labels are visibly off.
  for (let index = 0; niceMin + index * step <= niceMax + step / 1_000; index += 1) {
    ticks.push(Number((niceMin + index * step).toFixed(decimals + 2)));
  }

  return {min: niceMin, max: niceMax, ticks, decimals};
};

/** The `d` of a line, broken wherever the reading did not exist. */
const linePath = (
  series: ReadingSeries,
  x: (t: number) => number,
  y: (value: number) => number,
): string => {
  let path = '';
  let open = false;

  for (const sample of series.samples) {
    if (sample.value === null) {
      open = false;
      continue;
    }
    path += `${open ? 'L' : 'M'}${x(sample.t).toFixed(1)} ${y(sample.value).toFixed(1)}`;
    open = true;
  }

  return path;
};

/**
 * The analysis tab's chart: up to two readings over one window.
 *
 * Hand-drawn SVG rather than a charting library, for the same reason the gauges
 * and the phase bars are. The three things this chart has to get right are all
 * things a general-purpose library has to be argued out of doing: it must break
 * the line where the engine was off instead of interpolating across the gap,
 * it must put the alarm threshold on the same scale as its own series and not a
 * shared one, and it must never resample or smooth — every point drawn is a
 * bucket that exists. Two axes and a crosshair is the entire feature surface,
 * and it is smaller than the configuration required to suppress the defaults.
 */
export const TimeSeriesChart = ({
  series,
  runs,
  from,
  to,
}: {
  series: Array<ReadingSeries>;
  runs: Array<GensetRun>;
  from: number;
  to: number;
}) => {
  const frame = useRef<HTMLDivElement>(null);
  const {width, height} = useElementSize(frame);
  const [hoverT, setHoverT] = useState<number | undefined>(undefined);

  const rightAxis = series.length > 1;
  const padLeft = AXIS_WIDTH;
  const padRight = rightAxis ? AXIS_WIDTH : 24;
  const plotWidth = Math.max(0, width - padLeft - padRight);
  const plotHeight = Math.max(0, height - PAD_TOP - PAD_BOTTOM);

  const scales = useMemo(
    () => series.map((one) => niceScale(one.domain.min, one.domain.max)),
    [series],
  );

  const span = to - from;
  const x = (t: number) => padLeft + ((t - from) / span) * plotWidth;
  const yFor = (index: number) => (value: number) => {
    const scale = scales[index];
    return PAD_TOP + (1 - (value - scale.min) / (scale.max - scale.min)) * plotHeight;
  };

  /**
   * Six ticks, on the hour or the day depending on how wide the window is.
   *
   * Evenly spaced across the window rather than snapped to midnight: the window
   * is anchored to *now*, so a snapped grid would leave a ragged gap at the right
   * edge — the end of the axis is the part the reader is looking at.
   */
  const timeTicks = Array.from({length: 6}, (_, index) => from + (span * index) / 5);
  const byHour = span <= 36 * HOUR;

  const hovered = hoverT === undefined ? undefined : sampleAt(series[0], hoverT);
  const hoverX = hovered === undefined ? 0 : x(hovered.t);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - box.left;
    if (offset < padLeft || offset > padLeft + plotWidth) {
      setHoverT(undefined);
      return;
    }
    setHoverT(from + ((offset - padLeft) / plotWidth) * span);
  };

  return (
    <div
      ref={frame}
      className="relative min-h-[320px] flex-1"
      onPointerMove={handleMove}
      onPointerLeave={() => setHoverT(undefined)}
    >
      {width > 160 && height > 120 && (
        <svg width={width} height={height} className="block">
          {/* Engine-on bands, first so everything else sits over them. These are
              what explain the gaps: a broken trace with no shading behind it
              looks like missing data rather than a stopped machine. */}
          {runs.map((run) => {
            const startedMs = new Date(run.startedAt).getTime();
            const endedMs = run.endedAt === null ? to : new Date(run.endedAt).getTime();
            const left = Math.max(padLeft, x(startedMs));
            const right = Math.min(padLeft + plotWidth, x(endedMs));
            if (right <= left) return null;

            return (
              <rect
                key={run.id}
                x={left}
                y={PAD_TOP}
                width={right - left}
                height={plotHeight}
                className="fill-highlight"
              />
            );
          })}

          {/* Gridlines follow the left-hand scale only. Two sets of horizontals
              at different heights would read as a lattice and belong to neither
              series. */}
          {scales[0]?.ticks.map((tick) => {
            const atY = yFor(0)(tick);
            if (atY < PAD_TOP - 1 || atY > PAD_TOP + plotHeight + 1) return null;

            return (
              <line
                key={tick}
                x1={padLeft}
                y1={atY}
                x2={padLeft + plotWidth}
                y2={atY}
                className="stroke-subtle"
                strokeWidth={1}
              />
            );
          })}

          {series.map((one, index) => {
            const slot = SERIES_SLOTS[index];
            const y = yFor(index);
            const axisX = slot.axis === 'left' ? padLeft - 8 : padLeft + plotWidth + 8;

            return (
              <g key={one.key}>
                {/* The unit, once, at the head of its own scale. On the ticks it
                    would repeat five times; in the legend chip it would be a
                    property of the *name* rather than of the numbers, and the
                    numbers are what needs it. */}
                {one.unit !== '' && (
                  <text
                    x={axisX}
                    y={PAD_TOP - 10}
                    textAnchor={slot.axis === 'left' ? 'end' : 'start'}
                    className={cn('text-[10px] font-semibold', slot.text)}
                    fill="currentColor"
                  >
                    {one.unit}
                  </text>
                )}

                {scales[index].ticks.map((tick) => {
                  const atY = y(tick);
                  if (atY < PAD_TOP - 1 || atY > PAD_TOP + plotHeight + 1) return null;

                  return (
                    <text
                      key={tick}
                      x={axisX}
                      y={atY + 3}
                      textAnchor={slot.axis === 'left' ? 'end' : 'start'}
                      className={cn('text-[10px] font-medium', slot.text)}
                      fill="currentColor"
                    >
                      {tick.toLocaleString('en-MY', {
                        minimumFractionDigits: scales[index].decimals,
                        maximumFractionDigits: scales[index].decimals,
                      })}
                    </text>
                  );
                })}

                {/* The alarm line, on this series' own scale — which is the whole
                    reason a threshold can be drawn on a dual-axis chart at all. */}
                {one.threshold !== undefined && (
                  <>
                    <line
                      x1={padLeft}
                      y1={y(one.threshold.limit)}
                      x2={padLeft + plotWidth}
                      y2={y(one.threshold.limit)}
                      className={cn(
                        'opacity-70',
                        SEVERITY_META[one.threshold.severity].strokeClassName,
                      )}
                      strokeWidth={1}
                      strokeDasharray="5 4"
                    />
                    {/* The rule's name and nothing else — which series it belongs
                        to is already said by the colour of the scale it is drawn
                        against. Sitting just under the line and hard against the
                        axis, where a trace is least likely to be. */}
                    <text
                      x={padLeft + 6}
                      y={y(one.threshold.limit) + 12}
                      className={cn(
                        'text-[10px] font-medium',
                        SEVERITY_META[one.threshold.severity].textClassName,
                      )}
                      fill="currentColor"
                    >
                      {one.threshold.name}
                    </text>
                    {/* Where it was crossed. The alert card says "raised 3 hours
                        ago"; this is the same claim, placed on the trace.

                        Only when the crossing is inside the window. The rule was
                        in force across every window — so the dashed line always
                        belongs — but the moment it tripped happened once, and
                        pinning that marker to the frame of a range it did not
                        happen in would date it wrongly. */}
                    {one.threshold.raisedAt >= from && one.threshold.raisedAt <= to && (
                      <circle
                        cx={x(one.threshold.raisedAt)}
                        cy={y(one.threshold.limit)}
                        r={3}
                        className={SEVERITY_META[one.threshold.severity].fillClassName}
                      />
                    )}
                  </>
                )}

                <path
                  d={linePath(one, x, y)}
                  fill="none"
                  className={slot.stroke}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Time axis. */}
          {timeTicks.map((tick, index) => (
            <text
              key={tick}
              x={x(tick)}
              y={height - 10}
              textAnchor={index === 0 ? 'start' : index === timeTicks.length - 1 ? 'end' : 'middle'}
              className="text-[10px] font-medium text-secondary"
              fill="currentColor"
            >
              {byHour ? clockTime(tick) : dayMonth(tick)}
            </text>
          ))}

          {hovered !== undefined && (
            <g>
              <line
                x1={hoverX}
                y1={PAD_TOP}
                x2={hoverX}
                y2={PAD_TOP + plotHeight}
                className="stroke-strong"
                strokeWidth={1}
              />
              {series.map((one, index) => {
                const sample = sampleAt(one, hovered.t);
                if (sample?.value === undefined || sample.value === null) return null;

                return (
                  <circle
                    key={one.key}
                    cx={x(sample.t)}
                    cy={yFor(index)(sample.value)}
                    r={3.5}
                    className={cn(SERIES_SLOTS[index].fill, 'stroke-canvas')}
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>
      )}

      {hovered !== undefined && (
        <div
          // Flipped to the left of the cursor once it would otherwise run off the
          // plot. Following the cursor is what makes the readout feel attached to
          // the crosshair rather than parked in a corner of the panel.
          className="pointer-events-none absolute top-6 flex flex-col gap-1.5 rounded-md border border-default bg-overlay px-2.5 py-2 shadow-md"
          style={{
            width: READOUT_WIDTH,
            left:
              hoverX + READOUT_WIDTH + 12 > width
                ? hoverX - READOUT_WIDTH - 12
                : hoverX + 12,
          }}
        >
          <p className="text-xs font-medium text-secondary">
            {clockTime(hovered.t)} · {dayMonth(hovered.t)}
          </p>

          {series.map((one, index) => {
            const sample = sampleAt(one, hovered.t);
            const slot = SERIES_SLOTS[index];

            return (
              <div key={one.key} className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className={cn('size-1.5 shrink-0 rounded-full', slot.background)} />
                  <span className="truncate text-xs text-secondary">{one.label}</span>
                </span>
                <span className={cn('shrink-0 text-xs font-semibold', slot.text)}>
                  {sample?.value === undefined || sample.value === null
                    ? '—'
                    : amount(sample.value, one.unit, one.precision)}
                </span>
              </div>
            );
          })}

          {series.some((one) => sampleAt(one, hovered.t)?.value === null) && (
            <p className="text-[10px] text-secondary">— engine not turning</p>
          )}
        </div>
      )}
    </div>
  );
};
