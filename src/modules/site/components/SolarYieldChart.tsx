import {useRef, useState} from 'react';

import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {SolarBucket} from '../data/hybrid';

/**
 * Generation per bucket, as bars.
 *
 * ## One series
 *
 * What the array made, and nothing held up beside it. This chart used to draw
 * paired bars — a quieter design bar behind the measurement, with the gap between
 * them hatched — and all of that is gone along with the model that produced it.
 * What is left is the quantity itself, which is what the page's own heading now
 * claims and no more.
 *
 * A `compact` variant went at the same time. It plotted each month's deviation
 * from its design, so with no design there is nothing for it to plot, and the
 * cards it was drawn for do not exist either.
 *
 * ## Why bars and not a line
 *
 * Because each bucket is a total over a period, not a reading at an instant. A
 * line invites the reader to interpolate — to read a value for the second week of
 * May out of the space between two months — and a bar occupies its bucket and
 * claims nothing about the days inside it.
 *
 * ## The running bucket
 *
 * Hatched, and excluded from every total. A month eleven days old has made eleven
 * days of energy and stands next to eleven whole ones; drawn solid it reports a
 * collapse that has not happened. The hatch is the chart saying "not finished" in
 * the place a reader would otherwise compare. Today gets the same treatment on a
 * daily chart, for the same reason.
 */

const PAD_TOP = 16;
const PAD_BOTTOM = 22;
/** Room for four characters of tick label plus its gap. */
const AXIS_WIDTH = 44;
const TICK_ROWS = 4;
const HEIGHT = 176;

/** The bar's width as a share of its column. */
const BAR_SHARE = 0.72;

/**
 * A top-of-scale that lands on a round number.
 *
 * The same reasoning `TimeSeriesChart.niceScale` gives: a domain taken off the
 * data's own extremes frames the bars correctly and labels them terribly, and an
 * axis reading 1,147 / 2,294 is one nobody can hold two of in their head.
 */
const niceMax = (max: number): number => {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max / TICK_ROWS));
  const normalised = max / TICK_ROWS / step;
  const rounded = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * step;
  return rounded * TICK_ROWS;
};

const kwh = (value: number): string => `${Math.round(value).toLocaleString('en-MY')} kWh`;

export const SolarYieldChart = ({months}: {months: Array<SolarBucket>}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const width = Math.max(320, available);
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const top = niceMax(Math.max(...months.map((month) => month.actualKwh), 1));
  const y = (value: number) => PAD_TOP + plotHeight * (1 - value / top);
  const column = plotWidth / Math.max(1, months.length);
  const centre = (index: number) => AXIS_WIDTH + column * (index + 0.5);

  // 26px is `Sept` at 10px plus the gap either side of it.
  const labelEvery = column >= 26 ? 1 : 2;
  const ticks = Array.from({length: TICK_ROWS + 1}, (_, index) => (top / TICK_ROWS) * index);
  const shown = hovered === null ? undefined : months[hovered];

  return (
    <div ref={boxRef} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Solar generation, ${months.length} buckets to ${
          months[months.length - 1]?.label ?? ''
        }`}
      >
        <defs>
          {/* "Not finished yet", drawn rather than imported: a 5px hatch is one
              line, and an asset would be one more thing to keep in step with the
              token colouring it. */}
          <pattern id="solar-partial" width="5" height="5" patternUnits="userSpaceOnUse">
            <path
              d="M0,5 L5,0"
              className="stroke-current text-solar"
              strokeWidth={1.5}
              opacity={0.55}
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
              {tick >= 1_000 ? `${Math.round(tick / 100) / 10}k` : Math.round(tick)}
            </text>
          </g>
        ))}

        {months.map((month, index) => {
          const x = centre(index);
          const barWidth = column * BAR_SHARE;

          return (
            <g
              key={month.at}
              onPointerEnter={() => setHovered(index)}
              onPointerLeave={() => setHovered((current) => (current === index ? null : current))}
            >
              {/* The whole column is the hit area, so a reader does not have to
                  find a 12px bar to read a month. */}
              <rect
                x={x - column / 2}
                y={PAD_TOP}
                width={column}
                height={plotHeight}
                fill="transparent"
                className={cn(hovered === index && 'fill-hover')}
              />

              <rect
                x={x - barWidth / 2}
                y={y(month.actualKwh)}
                width={barWidth}
                height={Math.max(1, plotHeight - (y(month.actualKwh) - PAD_TOP))}
                rx={2}
                fill={month.inProgress ? 'url(#solar-partial)' : undefined}
                className={cn('text-solar', !month.inProgress && 'fill-current')}
                stroke={month.inProgress ? 'currentColor' : undefined}
                strokeWidth={month.inProgress ? 1 : undefined}
              />

              {/* Every other label once the columns are narrower than a
                  three-letter month plus its gap. Twelve labels in 320px overlap
                  into a grey smear, and a smear is worse than half a scale: the
                  bars are still in month order, so a reader who can see Sept, Nov
                  and Jan can place the ones between them. */}
              {index % labelEvery === 0 && (
                <text
                  x={x}
                  y={HEIGHT - 7}
                  textAnchor="middle"
                  className={cn(
                    'fill-current text-[10px]',
                    hovered === index ? 'text-primary' : 'text-tertiary',
                  )}
                >
                  {month.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* The readout, under the plot. A tooltip anchored to the bar would sit over
          the neighbour a reader is comparing it with. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="h-2 w-3 rounded-[2px] bg-solar" aria-hidden="true" />
          Generated
        </span>
        {shown !== undefined && (
          <span className="text-primary tabular-nums">
            {shown.label} · {kwh(shown.actualKwh)}
            {shown.inProgress && ' · still running'}
          </span>
        )}
      </div>
    </div>
  );
};
