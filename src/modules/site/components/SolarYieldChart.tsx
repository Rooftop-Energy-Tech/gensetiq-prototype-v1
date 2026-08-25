import {useRef, useState} from 'react';

import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {SolarMonth} from '../data/hybrid';

/**
 * Twelve months of design against measurement, as **paired bars**.
 *
 * ## Why paired bars and not two lines
 *
 * Because the benchmark is not a series. A P50 is a set of twelve simulated
 * monthly figures fixed at project conception, and drawing it as a line invites
 * the reader to interpolate between the points — to read a value for the second
 * week of May that the design never produced. A bar occupies its month and claims
 * nothing about the days inside it, which is exactly the claim the design makes.
 *
 * It is also the only arrangement in which the variance is legible. Two
 * overlapping lines make the reader measure a gap between two moving things;
 * paired bars put the gap at one edge, in one place, twelve times.
 *
 * ## Why the design bar sits behind rather than beside
 *
 * Tried both. Side by side, twelve pairs at a phone width give each bar seven
 * pixels and the chart becomes a texture. Nested — the measurement in front of a
 * wider, quieter design bar — the shortfall shows as the design bar's shoulders
 * standing proud of the actual one, which is one shape to learn rather than
 * twenty-four bars to compare. The reading is the same and it survives being
 * small.
 *
 * ## The running month
 *
 * Hatched, and excluded from every total. A month eleven days old has made eleven
 * days of energy against a whole month of design, and drawing it solid alongside
 * eleven closed months reports a plant in trouble that is fine. The hatch is the
 * chart saying "not yet comparable" in the only place a reader is doing the
 * comparison.
 */

const PAD_TOP = 16;
const PAD_BOTTOM = 22;
/** Room for four characters of tick label plus its gap. */
const AXIS_WIDTH = 44;
const TICK_ROWS = 4;
const HEIGHT = 176;

/** The design bar's half-width as a share of the column, and the actual's. */
const DESIGN_SHARE = 0.72;
const ACTUAL_SHARE = 0.44;

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

export const SolarYieldChart = ({months}: {months: Array<SolarMonth>}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const width = Math.max(320, available);
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const top = niceMax(Math.max(...months.map((m) => Math.max(m.expectedKwh, m.actualKwh)), 1));
  const y = (value: number) => PAD_TOP + plotHeight * (1 - value / top);
  const column = plotWidth / Math.max(1, months.length);
  const centre = (index: number) => AXIS_WIDTH + column * (index + 0.5);

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
        aria-label={`Monthly solar generation against the design P50, ${months.length} months to ${
          months[months.length - 1]?.label ?? ''
        }`}
      >
        <defs>
          {/* The running month's fill. Drawn rather than imported, because a
              4px hatch is four lines and an asset would be one more thing to keep
              in step with the token it is coloured from. */}
          <pattern id="solar-partial" width="5" height="5" patternUnits="userSpaceOnUse">
            <path
              d="M0,5 L5,0"
              className="stroke-current text-solar"
              strokeWidth={1.5}
              opacity={0.6}
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
          const designWidth = column * DESIGN_SHARE;
          const actualWidth = column * ACTUAL_SHARE;
          const short = !month.inProgress && month.actualKwh < month.expectedKwh * 0.9;

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

              {/* The design: wider, quieter, behind. */}
              <rect
                x={x - designWidth / 2}
                y={y(month.expectedKwh)}
                width={designWidth}
                height={Math.max(1, plotHeight - (y(month.expectedKwh) - PAD_TOP))}
                rx={2}
                className="fill-current text-tertiary"
                opacity={0.28}
              />

              {/* The measurement, in front. */}
              <rect
                x={x - actualWidth / 2}
                y={y(month.actualKwh)}
                width={actualWidth}
                height={Math.max(1, plotHeight - (y(month.actualKwh) - PAD_TOP))}
                rx={2}
                fill={month.inProgress ? 'url(#solar-partial)' : undefined}
                // A month under its P90 is the one thing on this chart worth a
                // second colour, and it is the amber the alert scale already uses
                // for "worth looking at" rather than the red it keeps for "act
                // now". An array below its number is a job, not an outage.
                className={cn(
                  month.inProgress
                    ? 'text-solar'
                    : short
                      ? 'fill-current text-severity-warning'
                      : 'fill-current text-solar',
                )}
                stroke={month.inProgress ? 'currentColor' : undefined}
                strokeWidth={month.inProgress ? 1 : undefined}
              />

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
            </g>
          );
        })}
      </svg>

      {/* The readout, in the corner the bars are shortest in. A tooltip anchored
          to the bar would sit over the neighbour a reader is comparing it with. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="h-2 w-3 rounded-[2px] bg-solar" aria-hidden="true" />
          Generated
        </span>
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="h-2 w-3 rounded-[2px] bg-tertiary/30" aria-hidden="true" />
          Design P50
        </span>
        {shown !== undefined && (
          <span className="text-primary tabular-nums">
            {shown.label} · {kwh(shown.actualKwh)} of {kwh(shown.expectedKwh)}
            {shown.inProgress
              ? ' · month still running'
              : ` · ${Math.round((shown.actualKwh / shown.expectedKwh) * 100)}% of design`}
          </span>
        )}
      </div>
    </div>
  );
};
