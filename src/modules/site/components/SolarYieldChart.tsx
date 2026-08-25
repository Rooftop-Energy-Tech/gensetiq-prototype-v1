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
 * ## Why a short month is not a different colour
 *
 * It was, and the colour was doing a job the geometry already does better. The
 * shortfall is a **quantity** — this many kilowatt-hours missing — and recolouring
 * the whole bar reports it as a flag, which throws away the size of it and makes
 * a month 2% short look like a month 30% short. So the gap itself is drawn:
 * hatched, in the width of the measurement, between where the array got to and
 * where the design says it should have. The reader sees how much rather than
 * whether.
 *
 * It also freed the palette. A second amber beside `solar` was the one pair on
 * this chart a reader had to look twice at.
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

/**
 * The stripped form, for a row in a list.
 *
 * It is **not a smaller version of the chart above**, and the first attempt at it
 * was, which is why this note exists. Shrinking the paired bars to 44px produced
 * twelve pairs of near-identical stubs: at that height the gap between an array at
 * 100% of design and one at 84% is under two pixels, so a card carrying a fault
 * and a card carrying nothing looked the same. A chart that cannot show its own
 * subject is worse than no chart, because it takes up the room one would need.
 *
 * So the compact form changes what it plots. It draws each month's **deviation
 * from its own design**: a line at 100%, and a bar hanging below it or standing
 * above it by however far the array missed or beat its number. Three things fall
 * out of that, and all three are what a list needs:
 *
 *  - **an array meeting its design draws almost nothing**, which is the correct
 *    amount of ink for nothing being wrong, and it makes the cards that do have
 *    something to say the only ones with marks on them;
 *  - **seasonality disappears.** December is a low month everywhere and it stops
 *    reading as a dip, so the only thing left in the shape is the array itself;
 *  - **the step is unmissable.** An array that fell from its number in March is a
 *    clean line and then a row of teeth, which is legible at 44px in a way two
 *    absolute bars never were.
 *
 * Deviation charts earn their keep exactly where the interesting signal is small
 * against the quantity carrying it, which is this case: the difference between a
 * healthy array and a faulty one is a sixth of a bar that is otherwise the same
 * height twelve times over.
 *
 * The running month is dropped rather than hatched here. Its actual is prorated
 * to the days it has had, so its *deviation* is a fraction of the month elapsed
 * and nothing else — drawn at this size beside eleven real ones, it would read as
 * a collapse.
 */
const COMPACT_HEIGHT = 44;

/**
 * Where the 100% line sits in the compact plot, as a share of its height, and how
 * far from it the plot reaches.
 *
 * The line is above centre rather than at it, because the deviations this chart
 * exists to show are **downward**: an array 30% short is a real and common state
 * and one 30% over its P50 is not a state at all. The space is spent where the
 * marks are. ±40% still clears anything a real array does in either direction.
 */
const COMPACT_REFERENCE = 0.38;
const COMPACT_RANGE = 0.4;

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

export const SolarYieldChart = ({
  months,
  /** `compact` drops the axis, the labels and the legend. See `COMPACT_HEIGHT`. */
  variant = 'full',
}: {
  months: Array<SolarMonth>;
  variant?: 'full' | 'compact';
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const compact = variant === 'compact';
  // The running month is drawn in the full chart and dropped from the compact
  // one — see `COMPACT_HEIGHT`. Done here so every measurement below sees the
  // same series the bars do.
  const plotted = compact ? months.filter((month) => !month.inProgress) : months;
  const height = compact ? COMPACT_HEIGHT : HEIGHT;
  const axisWidth = compact ? 0 : AXIS_WIDTH;
  const padTop = compact ? 3 : PAD_TOP;
  const padBottom = compact ? 3 : PAD_BOTTOM;

  const width = Math.max(compact ? 120 : 320, available);
  const plotWidth = width - axisWidth;
  const plotHeight = height - padTop - padBottom;

  const top = niceMax(Math.max(...plotted.map((m) => Math.max(m.expectedKwh, m.actualKwh)), 1));
  const y = (value: number) => padTop + plotHeight * (1 - value / top);
  const column = plotWidth / Math.max(1, plotted.length);
  const centre = (index: number) => axisWidth + column * (index + 0.5);

  // 26px is `Sept` at 10px plus the gap either side of it.
  const labelEvery = column >= 26 ? 1 : 2;
  const ticks = Array.from({length: TICK_ROWS + 1}, (_, index) => (top / TICK_ROWS) * index);
  const shown = hovered === null ? undefined : plotted[hovered];

  /**
   * The compact form's own scale: **deviation** from the design, not the ratio.
   *
   * `0` is the 100% line and the plot runs `±COMPACT_RANGE` around it, clamped so
   * an outlier flattens against an edge rather than escaping the box.
   */
  const referenceY = padTop + plotHeight * COMPACT_REFERENCE;
  const deviationY = (deviation: number) => {
    const clamped = Math.max(-COMPACT_RANGE, Math.min(COMPACT_RANGE, deviation));
    const span = clamped > 0 ? plotHeight * COMPACT_REFERENCE : plotHeight * (1 - COMPACT_REFERENCE);
    return referenceY - (clamped / COMPACT_RANGE) * span;
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={
          compact
            ? `Each month against its own design P50, ${plotted.length} months to ${
                plotted[plotted.length - 1]?.label ?? ''
              }`
            : `Monthly solar generation against the design P50, ${plotted.length} months to ${
                plotted[plotted.length - 1]?.label ?? ''
              }`
        }
      >
        <defs>
          {/* Two hatches, and they lean opposite ways on purpose: one means "not
              finished yet" and the other means "did not happen", and a reader
              should not have to check the colour to tell them apart. Drawn rather
              than imported, because a 5px hatch is one line and an asset would be
              one more thing to keep in step with the token colouring it. */}
          <pattern id="solar-partial" width="5" height="5" patternUnits="userSpaceOnUse">
            <path
              d="M0,5 L5,0"
              className="stroke-current text-solar"
              strokeWidth={1.5}
              opacity={0.55}
            />
          </pattern>
          <pattern id="solar-shortfall" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" className="fill-current text-severity-warning" opacity={0.16} />
            <path
              d="M0,0 L4,4"
              className="stroke-current text-severity-warning"
              strokeWidth={1.6}
            />
          </pattern>
        </defs>

        {!compact &&
          ticks.map((tick) => (
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

        {/* The compact form's only furniture: the line the bars are read against,
            and the P90 band under it. Two marks rather than an axis, because at
            44px an axis is the chart. */}
        {compact && (
          <>
            {/* The P90 band, so "inside ordinary weather" is a place on the chart
                rather than a threshold the reader has to remember. */}
            <rect
              x={0}
              y={referenceY}
              width={width}
              height={Math.max(1, deviationY(-0.1) - referenceY)}
              className="fill-current text-severity-warning"
              opacity={0.09}
            />
            <line
              x1={0}
              y1={referenceY}
              x2={width}
              y2={referenceY}
              className="stroke-current text-default"
              strokeWidth={1}
            />
          </>
        )}

        {plotted.map((month, index) => {
          const x = centre(index);
          const designWidth = column * DESIGN_SHARE;
          const actualWidth = column * ACTUAL_SHARE;
          const short = !month.inProgress && month.actualKwh < month.expectedKwh * 0.9;
          const ratio = month.expectedKwh > 0 ? month.actualKwh / month.expectedKwh : 0;

          if (compact) {
            const end = deviationY(ratio - 1);
            const barTop = Math.min(referenceY, end);
            const barHeight = Math.max(1.5, Math.abs(end - referenceY));
            return (
              <g
                key={month.at}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() =>
                  setHovered((current) => (current === index ? null : current))
                }
              >
                <rect
                  x={x - column / 2}
                  y={padTop}
                  width={column}
                  height={plotHeight}
                  fill="transparent"
                  className={cn(hovered === index && 'fill-hover')}
                />
                <rect
                  x={x - column * 0.32}
                  y={barTop}
                  width={column * 0.64}
                  height={barHeight}
                  rx={1.5}
                  className={cn(
                    'fill-current',
                    short ? 'text-severity-warning' : 'text-solar',
                  )}
                />
              </g>
            );
          }

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
                y={padTop}
                width={column}
                height={plotHeight}
                fill="transparent"
                className={cn(hovered === index && 'fill-hover')}
              />

              {/* The design: wider, quieter, behind. Outlined as well as filled,
                  because a flat tint at this lightness is indistinguishable from
                  the gridline it sits on at the months where the array met its
                  number and the two bars are the same height. */}
              <rect
                x={x - designWidth / 2}
                y={y(month.expectedKwh)}
                width={designWidth}
                height={Math.max(1, plotHeight - (y(month.expectedKwh) - padTop))}
                rx={2}
                className="fill-inset stroke-current text-default"
                strokeWidth={1}
              />

              {/* The shortfall, drawn: from where the design says the array should
                  have got to, down to where it did. Only where the gap is worth a
                  reader's attention — every month is a percent or two off its
                  simulation, and hatching all twelve would be hatching the weather. */}
              {short && (
                <rect
                  x={x - actualWidth / 2}
                  y={y(month.expectedKwh)}
                  width={actualWidth}
                  height={Math.max(1, y(month.actualKwh) - y(month.expectedKwh))}
                  rx={2}
                  fill="url(#solar-shortfall)"
                />
              )}

              {/* The measurement, in front. */}
              <rect
                x={x - actualWidth / 2}
                y={y(month.actualKwh)}
                width={actualWidth}
                height={Math.max(1, plotHeight - (y(month.actualKwh) - padTop))}
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
              {!compact && (index % labelEvery === 0) && (
                <text
                  x={x}
                  y={height - 7}
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
        {compact ? (
          shown === undefined ? (
            // Nothing while idle. The encoding is explained once in the section
            // that holds these charts; repeating it under every card is the same
            // sentence three, twelve or four hundred times.
            <span className="text-tertiary">&nbsp;</span>
          ) : (
            <span className="text-secondary tabular-nums">
              {shown.label} · {Math.round((shown.actualKwh / shown.expectedKwh) * 100)}% of design
            </span>
          )
        ) : (
          <>
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="h-2 w-3 rounded-[2px] bg-solar" aria-hidden="true" />
          Generated
        </span>
        <span className="flex items-center gap-1.5 text-secondary">
          <span
            className="h-2 w-3 rounded-[2px] border border-default bg-inset"
            aria-hidden="true"
          />
          Design P50
        </span>
        <span className="flex items-center gap-1.5 text-secondary">
          <span
            className="h-2 w-3 rounded-[2px] bg-severity-warning/25 ring-1 ring-severity-warning/60"
            aria-hidden="true"
          />
          Short of design
        </span>
        {shown !== undefined && (
          <span className="text-primary tabular-nums">
            {shown.label} · {kwh(shown.actualKwh)} of {kwh(shown.expectedKwh)}
            {shown.inProgress
              ? ' · month still running'
              : ` · ${Math.round((shown.actualKwh / shown.expectedKwh) * 100)}% of design`}
          </span>
        )}
          </>
        )}
      </div>
    </div>
  );
};
