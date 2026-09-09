import {useRef, useState} from 'react';

import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {SiteTrend} from '../data/siteTrend';
import {ShareBar} from './ShareBar';

/**
 * The diagnostics band's chart: one series, drawn the way that series deserves.
 *
 * ## Why one component draws two shapes
 *
 * Because the band draws two kinds of quantity and they are not interchangeable.
 * A continuous reading — power, state of charge — is a value **at an instant**, and
 * its shape is the information: an array shaded from three o'clock and an array
 * that tripped at three make the same daily total and completely different curves.
 * A bucketed one — energy over a day, engine minutes over an hour — has no shape
 * between buckets to draw a line through: joining the top of Tuesday to the top of
 * Wednesday draws a Tuesday evening that never happened.
 *
 * That is the same split the app already makes between `SolarTodayChart` and
 * `SolarYieldChart`. It is one component here rather than two because the band
 * switches between them under a single set of controls, and a reader stepping from
 * `Day` to `Month` should see the axis, the tick rows and the readout stay exactly
 * where they were — which is far easier to guarantee inside one layout than across
 * two files that have to be kept in step.
 *
 * Which of the two it is comes in on `trend.shape`, and this file does not second-
 * guess it. It was read off the period here once, which was true only while every
 * day view happened to be continuous — runtime's is not; see `gensetDayTrend`.
 *
 * ## Colour comes from the metric, not from here
 *
 * `colorClassName` is a token class — `text-solar`, `text-battery` — and every
 * stroke and fill below is `currentColor` through it. So the array's curve is the
 * same orange as the array's node on the diagram above, without this file knowing
 * what an array is.
 */

const HEIGHT = 260;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const AXIS_WIDTH = 44;
const TICK_ROWS = 4;

/**
 * How to write the axis figures, given the gap between them.
 *
 * `Math.round` was fine while every series was tens of kilowatts, and prints
 * `0 1 1 2 2` the moment one is not: an hours series over a quiet week tops out
 * around two, and its clean divisions are halves. The tick *step* is what decides
 * this rather than the values, so every figure on the axis is written to the same
 * precision — a column reading `0 0.5 1 1.5 2` and one reading `0 .5 1 1.5 2` are
 * the same numbers and only one of them scans.
 */
const tickLabel = (tick: number, step: number): string =>
  step >= 1 ? String(Math.round(tick)) : tick.toFixed(step >= 0.1 ? 1 : 2);

/** A rounded step that lands on clean divisions — same rule the overview uses. */
const niceStep = (rough: number): number => {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  return (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
};

/**
 * Which labels to print on the x axis.
 *
 * Every point would overlap at any real width — a day is 48 half-hours — so this
 * takes about one label per 90px and always keeps the first and last, which are the
 * two a reader checks to know what window they are looking at.
 */
const labelStride = (count: number, plotWidth: number): number =>
  Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotWidth / 90))));

export const SiteTrendChart = ({
  trend,
  colorClassName,
}: {
  trend: SiteTrend;
  /** A text token class — the series takes its stroke and fill from it. */
  colorClassName: string;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const {points, unit} = trend;
  // Bars for a bucketed quantity, a curve for a continuous reading — the series'
  // own call. See the note above.
  const bars = trend.shape === 'bars';

  const width = Math.max(320, available);
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const readings = points.map((point) => point.value).filter((v): v is number => v !== null);
  // The reference is in the ceiling too: an expectation the bars all missed must
  // sit inside the frame, not on its edge — the shortfall is the picture.
  // A paired series mirrors below the axis, so the scale spans both halves —
  // charge above the zero rule, discharge under it. A fixed ceiling (state of
  // charge) keeps its zero floor, and everything else lands on clean divisions
  // of the whole span.
  const referenced = (trend.reference?.values ?? []).filter(
    (value): value is number => value !== null,
  );
  const mirrored = (trend.paired?.values ?? []).filter((value): value is number => value !== null);
  const high = trend.axisMax ?? Math.max(...readings, ...referenced, 1);
  const low = mirrored.length === 0 ? 0 : -Math.max(...mirrored);
  const tickStep =
    trend.axisMax !== undefined
      ? trend.axisMax / TICK_ROWS
      : niceStep(Math.max(high - low, 1) / TICK_ROWS);
  const top = trend.axisMax ?? Math.max(tickStep, Math.ceil(high / tickStep) * tickStep);
  const bottom = Math.min(0, Math.floor(low / tickStep) * tickStep);

  // Bars are centred in their own slot; a curve's points sit on the edges, so the
  // first and last land on the axis rather than half a slot inside it.
  const slot = plotWidth / Math.max(1, points.length);
  const x = (index: number) =>
    bars
      ? AXIS_WIDTH + slot * index + slot / 2
      : AXIS_WIDTH + (plotWidth * index) / Math.max(1, points.length - 1);
  const y = (value: number) =>
    PAD_TOP + plotHeight * (1 - (value - bottom) / Math.max(1e-6, top - bottom));

  const measured = points.filter((point) => point.value !== null);

  /**
   * The curve, cut into runs of one colour.
   *
   * A single polyline could not do this. The bank's level is drawn in whatever is
   * charging it — see `SiteTrend.tints` — so the line changes colour partway
   * through the morning, and SVG has no per-vertex stroke. So the run of drawn
   * points is broken wherever the tint changes and each piece is stroked in its
   * own token.
   *
   * **Consecutive pieces share their boundary point**, which is the whole trick: a
   * segment ends on the same vertex the next one starts from, so the joint is a
   * colour change rather than a gap. That is also why a tint belongs to the point
   * at the *end* of a step — the stretch from 07:00 to 07:30 is the half-hour that
   * charged, and it is 07:30's reading that says so.
   *
   * One piece for an untinted series, which is every metric but the bank's.
   */
  const pieces = ((): Array<{tint: string | undefined; points: Array<number>}> => {
    if (bars) return [];

    const drawn = points.flatMap((point, index) => (point.value === null ? [] : [index]));
    if (drawn.length === 0) return [];
    if (drawn.length === 1) return [{tint: undefined, points: drawn}];

    const out: Array<{tint: string | undefined; points: Array<number>}> = [];
    for (let step = 1; step < drawn.length; step += 1) {
      const index = drawn[step]!;
      const tint = points[index]!.tint;
      const last = out[out.length - 1];

      if (last !== undefined && last.tint === tint) last.points.push(index);
      else out.push({tint, points: [drawn[step - 1]!, index]});
    }
    return out;
  })();

  /**
   * One piece as `[area, line]` — the area closed to the floor under its own run.
   *
   * Where a band is being drawn (the array's charging slice), the series' own
   * fill stops at the band's lower boundary instead of the curve: the slice above
   * it belongs to the bank and is filled in the bank's colour on the bare ground,
   * so it reads in exactly the shade the SoC chart taught, not blue over orange.
   */
  const shapeOf = (piece: {points: Array<number>}): {area: string; line: string} => {
    const line = piece.points.map((index) => `${x(index)},${y(points[index]!.value!)}`).join(' ');
    const lower = trend.bands?.[0]?.from;
    const areaTop =
      lower === undefined
        ? line
        : piece.points
            .map((index) => `${x(index)},${y(lower[index] ?? points[index]!.value!)}`)
            .join(' ');
    const first = piece.points[0]!;
    const last = piece.points[piece.points.length - 1]!;
    return {area: `${x(first)},${y(0)} ${areaTop} ${x(last)},${y(0)}`, line};
  };

  /** Which tints this series actually used, in the order the model declares them. */
  const legend = Object.entries(trend.tints ?? {}).filter(([id]) =>
    points.some((point) => point.tint === id),
  );

  const ticks: Array<number> = [];
  for (let tick = bottom; tick <= top + 1e-6; tick += tickStep)
    ticks.push(Math.round(tick * 100) / 100);
  const stride = labelStride(points.length, plotWidth);
  const shown = hovered === null ? undefined : points[hovered];
  /**
   * What the hovered segment is doing, in words.
   *
   * The colour says it already, and it says it to a reader who has read the legend
   * — this is the same claim for one whose attention is on the crosshair. Lowered
   * to sentence case because it lands mid-phrase: `07:30 · 62 % · solar-charging`.
   */
  const hoveredTint =
    shown?.tint === undefined
      ? undefined
      : trend.tints?.[shown.tint]?.label.toLowerCase();

  return (
    <div ref={boxRef} className={cn('relative w-full', colorClassName)}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`${trend.caption}, in ${unit}`}
        onPointerLeave={() => setHovered(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          const at = ratio * width - AXIS_WIDTH;
          const index = bars
            ? Math.floor(at / slot)
            : Math.round((at / plotWidth) * (points.length - 1));
          setHovered(index >= 0 && index < points.length ? index : null);
        }}
      >
        {/* The unit, where the design puts it: above the axis rather than rotated
            down its side, which at 260px tall would be unreadable. */}
        <text
          x={AXIS_WIDTH - 8}
          y={PAD_TOP - 5}
          textAnchor="end"
          className="fill-current text-[10px] text-tertiary"
        >
          {unit}
        </text>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={AXIS_WIDTH}
              y1={y(tick)}
              x2={width}
              y2={y(tick)}
              className={cn('stroke-current', tick === 0 && bottom < 0 ? 'text-default' : 'text-subtle')}
              strokeWidth={1}
            />
            <text
              x={AXIS_WIDTH - 8}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-current text-[10px] text-tertiary tabular-nums"
            >
              {tickLabel(tick, tickStep)}
            </text>
          </g>
        ))}

        {/* Bars, split where the bands say so: the series' own colour runs up to
            the first slice's boundary, and each slice stacks above in its own
            token — the same quantities the table under the chart divides. A bar
            with no slices at its index stays one rectangle. */}
        {bars
          ? points.map((point, index) => {
              if (point.value === null) return null;
              // A paired series mirrors: the bucket's own bar above the zero rule,
              // its counterpart below it in one column — in over out, the way a
              // signed bank chart has always read.
              const barWidth = Math.max(4, slot * 0.64);
              const left = x(index) - barWidth / 2;
              // The same 55% every fill in the band uses; hover dims the rest.
              const dim = hovered === null || hovered === index ? 0.55 : 0.3;
              const base = trend.bands?.[0]?.from[index] ?? point.value;
              const paired = trend.paired?.values[index];

              return (
                <g key={point.label}>
                  {base > 0 && (
                    <rect
                      x={left}
                      y={y(base)}
                      width={barWidth}
                      height={Math.max(0, y(0) - y(base))}
                      rx={2}
                      className="fill-current"
                      opacity={dim}
                    />
                  )}
                  {(trend.bands ?? []).map((band) => {
                    const from = band.from[index];
                    const to = band.to[index];
                    return from === null || from === undefined || to === null || to === undefined || to <= from ? null : (
                      <rect
                        key={band.label}
                        x={left}
                        y={y(to)}
                        width={barWidth}
                        height={Math.max(0, y(from) - y(to))}
                        rx={2}
                        className={cn('fill-current', band.token)}
                        opacity={dim}
                      />
                    );
                  })}
                  {paired !== null && paired !== undefined && paired > 0 && (
                    <rect
                      x={left}
                      y={y(0)}
                      width={barWidth}
                      height={Math.max(0, y(-paired) - y(0))}
                      rx={2}
                      className={cn('fill-current', trend.paired?.token)}
                      opacity={dim}
                    />
                  )}
                </g>
              );
            })
          : null}

        {/* The slices over the curve: each the area between its own boundaries,
            in its own token at the band strength every fill here shares. Under
            the reference and the strokes, so neither is dimmed. */}
        {!bars &&
          (trend.bands ?? []).map((band) => (
            <polygon
              key={band.label}
              points={[
                ...band.to.flatMap((value, index) =>
                  value === null ? [] : [`${x(index)},${y(value)}`],
                ),
                ...band.from
                  .flatMap((value, index) => (value === null ? [] : [{index, value}]))
                  .reverse()
                  .map(({index, value}) => `${x(index)},${y(value)}`),
              ].join(' ')}
              className={cn('fill-current', band.token)}
              opacity={0.55}
            />
          ))}

        {/* The expected reference over the actuals: on bars, a staircase — one
            step per bucket, spanning its slot at what the physics promised it —
            and on the day curve, the promised bell through the same samples. Not
            labelled on the plot; its figure lives in the strip below, which
            follows the hover. Muted ink rather than the series' own colour: a
            dashed solar-orange line over solar-orange bars would vanish exactly
            where it crosses them. */}
        {trend.reference !== undefined && (
          <polyline
            points={trend.reference.values
              .flatMap((value, index) =>
                value === null
                  ? []
                  : bars
                    ? [
                        `${AXIS_WIDTH + slot * index},${y(value)}`,
                        `${AXIS_WIDTH + slot * (index + 1)},${y(value)}`,
                      ]
                    : [`${x(index)},${y(value)}`],
              )
              .join(' ')}
            fill="none"
            className="stroke-current text-secondary"
            strokeWidth={1.5}
            strokeDasharray="2 3"
          />
        )}

        {pieces.map((piece, index) => {
          const {area, line} = shapeOf(piece);
          const tint = piece.tint === undefined ? undefined : trend.tints?.[piece.tint];

          return (
            // Keyed on where it starts: the pieces partition one run of samples, so
            // no two of them can begin at the same index.
            <g key={`${piece.points[0]}-${index}`} className={tint?.token}>
              {/* One fill strength across every chart in the band — the 55% the
                  distribution chart's bands set. */}
              <polygon points={area} className="fill-current" opacity={0.55} />
              <polyline
                points={line}
                fill="none"
                className="stroke-current"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* Where the record ends. Without it the series simply stops and reads as
            plant that went quiet, rather than as a day that is not over — which
            bars need as much as a curve does: the hour in progress is a part-hour
            bar, and beside a full one it looks like a machine that shut down.

            Past the last bucket rather than through its middle, so it marks the
            boundary the record reaches and does not strike through a bar. */}
        {measured.length > 0 && measured.length < points.length && (
          <line
            x1={x(measured.length - 1) + (bars ? slot / 2 : 0)}
            y1={PAD_TOP}
            x2={x(measured.length - 1) + (bars ? slot / 2 : 0)}
            y2={PAD_TOP + plotHeight}
            className="stroke-current text-default"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}

        {hovered !== null && shown?.value !== null && shown !== undefined && (
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
          index % stride === 0 || index === points.length - 1 ? (
            <text
              key={point.label}
              x={x(index)}
              y={HEIGHT - 10}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-current text-[10px] text-tertiary"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      {/* The design's legend, plus the hovered reading in the same strip. Two rows
          would put the readout below the fold of a 472px card. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
        {/* The caption is a sentence about the window, not a series — it gets no
            swatch. The chips belong to things actually drawn. */}
        <span className="text-secondary">{trend.caption}</span>

        {/* Only the tints the day actually used. A legend entry for
            `Solar-charging` on a bank that spent the whole night on diesel would
            have a reader hunting the plot for a colour that is not on it — and on
            a diesel hybrid with no array it would name plant the site has not
            got. */}
        {legend.map(([id, tint]) => (
          <span key={id} className={cn('flex items-center gap-1.5', tint.token)}>
            <span className="h-0.5 w-3 rounded-full bg-current" aria-hidden="true" />
            <span className="text-secondary">{tint.label}</span>
          </span>
        ))}

        {(trend.bands ?? []).map((band) => (
          <span key={band.label} className={cn('flex items-center gap-1.5', band.token)}>
            <span className="h-2 w-2 rounded-[2px] bg-current opacity-60" aria-hidden="true" />
            <span className="text-tertiary">
              {band.label} · <span className="text-primary tabular-nums">{band.value}</span>
            </span>
          </span>
        ))}

        {trend.paired !== undefined && (
          <span className={cn('flex items-center gap-1.5', trend.paired.token)}>
            <span className="h-2 w-2 rounded-[2px] bg-current opacity-60" aria-hidden="true" />
            <span className="text-tertiary">
              {trend.paired.label} ·{' '}
              <span className="text-primary tabular-nums">
                {hovered !== null &&
                trend.paired.values[hovered] !== null &&
                trend.paired.values[hovered] !== undefined
                  ? `${trend.paired.values[hovered]} ${unit}`
                  : trend.paired.value}
              </span>
            </span>
          </span>
        )}

        {/* The reference's figure, following the hover: pointing at a bar
            restates the promise for that bar's own bucket, and pointing at
            nothing shows the window's mean. The bucket in progress has no step,
            so it falls back to the mean rather than to a blank. */}
        {trend.reference !== undefined && (
          <span className="flex items-center gap-1.5 text-secondary">
            <span className="w-3 border-t border-dotted border-current" aria-hidden="true" />
            <span className="text-tertiary">
              {trend.reference.label} ·{' '}
              <span className="text-primary tabular-nums">
                {hovered !== null && trend.reference.values[hovered] !== null
                  ? trend.reference.values[hovered]
                  : trend.reference.value}{' '}
                {unit}
              </span>
            </span>
          </span>
        )}

        <span
          className={cn(
            'tabular-nums',
            shown === undefined ? 'text-tertiary' : 'text-primary',
          )}
        >
          {shown === undefined
            ? trend.total === undefined
              ? ''
              : `${trend.total.label} · ${trend.total.value}`
            : `${shown.label} · ${
                shown.value === null ? 'not yet' : `${shown.value} ${unit}`
              }${hoveredTint === undefined ? '' : ` · ${hoveredTint}`}`}
        </span>

        {trend.extra !== undefined && (
          <span className="text-tertiary tabular-nums">
            {trend.extra.label} · <span className="text-primary">{trend.extra.value}</span>
          </span>
        )}
      </div>

      {/* The split as arithmetic — where the window's generation went, in the
          same rows the chart shades: the tower's share, the bank's, and the
          total they divide. Same table the distribution chart draws. */}
      {trend.mix !== undefined && <ShareBar rows={trend.mix} />}
    </div>
  );
};
