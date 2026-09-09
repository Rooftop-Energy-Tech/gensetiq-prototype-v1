import {useRef, useState} from 'react';

import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {ShareSeries} from '../data/siteTrend';

/**
 * The strip chart that replaced the share tables: each source's **percentage**
 * per bucket, drawn across the same window the chart above it shows.
 *
 * The table it replaced stated one aggregate — "solar carried 30.8% of the
 * month" — and the question a reader actually brings is the one an aggregate
 * cannot answer: is that share *growing*? So the rows became lines. The axis is
 * fixed 0–100 the way state of charge's is: a share is a fraction of its own
 * bucket, and the ceiling is known before the window is read.
 *
 * Alignment is by construction rather than by plumbing: this renders in the same
 * container as the chart above, uses the same axis gutter, and maps x the same
 * way (`bars` says which of the two spines the parent used), so a bucket's share
 * sits directly under its bar. The hover is its own — pointing here answers
 * "what percent", pointing above answers "how much".
 *
 * Lines break at nulls rather than joining across them: a bank that charged on
 * Tuesday and Thursday did nothing on Wednesday, and a line drawn through the
 * gap would invent a share for a day with no denominator.
 */

const HEIGHT = 130;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const AXIS_WIDTH = 44;

export const ShareTrend = ({
  series,
  bars,
  ariaLabel,
}: {
  series: Array<ShareSeries>;
  /** Whether the chart above draws bars — its x-spine is what this aligns to. */
  bars: boolean;
  ariaLabel: string;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const count = series[0]?.values.length ?? 0;
  if (count === 0) return null;

  const width = Math.max(320, available);
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (index: number) =>
    bars
      ? AXIS_WIDTH + (plotWidth / count) * index + plotWidth / count / 2
      : AXIS_WIDTH + (plotWidth * index) / Math.max(1, count - 1);
  const y = (value: number) => PAD_TOP + plotHeight * (1 - value / 100);

  /** One series as runs of consecutive drawn samples — a null breaks the line. */
  const runs = (values: Array<number | null>): Array<string> => {
    const out: Array<string> = [];
    let run: Array<string> = [];
    values.forEach((value, index) => {
      if (value === null) {
        if (run.length > 0) out.push(run.join(' '));
        run = [];
        return;
      }
      run.push(`${x(index)},${y(value)}`);
    });
    if (run.length > 0) out.push(run.join(' '));
    return out;
  };

  const shown = hovered === null ? undefined : hovered;

  return (
    <div ref={boxRef} className="mt-2 w-full">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
        onPointerLeave={() => setHovered(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          const at = ratio * width - AXIS_WIDTH;
          const index = bars
            ? Math.floor(at / (plotWidth / count))
            : Math.round((at / plotWidth) * (count - 1));
          setHovered(index >= 0 && index < count ? index : null);
        }}
      >
        <text
          x={AXIS_WIDTH - 8}
          y={PAD_TOP - 3}
          textAnchor="end"
          className="fill-current text-[10px] text-tertiary"
        >
          %
        </text>

        {[0, 50, 100].map((tick) => (
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
              {tick}
            </text>
          </g>
        ))}

        {series.map((one) => (
          <g key={one.label} className={one.token}>
            {runs(one.values).map((points) =>
              points.includes(' ') ? (
                <polyline
                  key={points}
                  points={points}
                  fill="none"
                  className="stroke-current"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                // A run of one sample has no line to draw — a dot keeps an
                // isolated charging day from disappearing entirely.
                <circle
                  key={points}
                  cx={Number(points.split(',')[0])}
                  cy={Number(points.split(',')[1])}
                  r={2}
                  className="fill-current"
                />
              ),
            )}
          </g>
        ))}

        {shown !== undefined && (
          <line
            x1={x(shown)}
            y1={PAD_TOP}
            x2={x(shown)}
            y2={PAD_TOP + plotHeight}
            className="stroke-current text-strong"
            strokeWidth={1}
          />
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
        {series.map((one) => {
          const drawn = one.values.filter((value): value is number => value !== null);
          const mean =
            drawn.length === 0
              ? undefined
              : Math.round((drawn.reduce((total, value) => total + value, 0) / drawn.length) * 10) /
                10;
          const value = shown === undefined ? mean : (one.values[shown] ?? undefined);

          return (
            <span key={one.label} className={cn('flex items-center gap-1.5', one.token)}>
              <span className="h-0.5 w-3.5 rounded-full bg-current" aria-hidden="true" />
              <span className="text-tertiary">
                {one.label} ·{' '}
                <span className="text-primary tabular-nums">
                  {value === undefined ? '—' : `${value}%`}
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
