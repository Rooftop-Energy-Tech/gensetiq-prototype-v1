import {useRef, useState} from 'react';

import {cn} from '@/lib/utils';
import {useElementSize} from '@/lib/useElementSize';
import type {SiteOverview} from '../data/siteOverview';

/**
 * The Energy Overview band's chart — four series, one kilowatt axis, drawn the way
 * NetEco's `Energy Trend` panel draws them.
 *
 * ## What is copied from the reference, and why each part is there
 *
 * - **Filled areas under stroked lines.** Stacked, which is where this parts
 *   company with the reference: NetEco overlays four unclipped curves, and the
 *   three sources here are shares of one quantity — see the note on the
 *   composition in `siteOverview`. Stacked, they cannot hide each other and the
 *   height of the pile is the load itself. The load's own line is *not* in the
 *   stack; it is the level the pile reaches.
 * - **A rule on zero.** NetEco's axis runs negative because it signs the bank;
 *   this one does not — every band is a share of the load, so all of them sit
 *   above the line and zero is the floor of the stack.
 * - **A crosshair and a tooltip listing every series at that instant.** This is the
 *   part of NetEco's panel doing the real work: four curves at a glance for the
 *   shape, and one hover for the arithmetic. Without it an overlay chart is only an
 *   impression.
 * - **The legend above rather than beside.** Four labels of this length do not fit
 *   a side rail at the widths this band gets, and NetEco puts them on top.
 *
 * ## What is deliberately not copied
 *
 * The reference paints its areas at a high enough opacity that a tall series hides
 * a short one behind it — in the screenshot this was built from, the genset's block
 * swallows the battery band underneath it exactly where both matter. Stacking is
 * the answer to that rather than a lower opacity: nothing is behind anything, so
 * the fills can be strong enough to read as bands of a composition, which is what
 * they are.
 *
 * ## Colour comes from the series, not from here
 *
 * Every band takes its stroke and fill from `currentColor` through the token class
 * the model hands it — `text-solar`, `text-fuel`, `text-battery` — so the array's
 * curve is the same amber as the array's node on the diagram above, without this
 * file knowing what an array is. Same rule `SiteTrendChart` follows.
 */

const HEIGHT = 300;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const AXIS_WIDTH = 44;
const TICK_ROWS = 5;

/** How to write the axis figures, given the gap between them. */
const tickLabel = (tick: number, step: number): string =>
  step >= 1 ? String(Math.round(tick)) : tick.toFixed(step >= 0.1 ? 1 : 2);

/** A rounded step that lands on clean divisions. */
const niceStep = (rough: number): number => {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  return (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
};

/**
 * The axis, as a ceiling, a floor and the step between the rules.
 *
 * The floor is `0` for every series this chart currently publishes — they are all
 * powers into the bus. It is still computed rather than assumed: a floor rounded to
 * the same step as the ceiling is what keeps zero on a rule, and it is what lets a
 * signed series be drawn here again without the negative half auto-scaling to a
 * different height on every site.
 */
const axisFor = (values: Array<number>): {top: number; bottom: number; step: number} => {
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  // Sized off the **span** rather than off the taller half. Dividing the ceiling by
  // a row count is what `SiteTrendChart` does and it is right for an axis that
  // starts at zero; here the negative half is part of the same scale, and sizing to
  // the top alone lands a site whose genset runs at 12 kW and whose bank discharges
  // at 5 on a 10 kW step — four rules, with the data crammed into two of them.
  const step = niceStep(Math.max(high - low, 1) / TICK_ROWS);
  return {
    top: Math.max(step, Math.ceil(high / step) * step),
    bottom: Math.min(0, Math.floor(low / step) * step),
    step,
  };
};

/** About one label per 90px, always keeping the first and last. */
const labelStride = (count: number, plotWidth: number): number =>
  Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotWidth / 90))));

export const SiteOverviewChart = ({overview}: {overview: SiteOverview}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const {width: available} = useElementSize(boxRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const {series, labels, stamps, unit} = overview;
  const count = labels.length;

  const width = Math.max(320, available);
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const readings = series.flatMap((one) =>
    one.values.filter((value): value is number => value !== null),
  );
  const {top, bottom, step} = axisFor(readings);

  const x = (index: number) => AXIS_WIDTH + (plotWidth * index) / Math.max(1, count - 1);
  const y = (value: number) =>
    PAD_TOP + plotHeight * (1 - (value - bottom) / Math.max(1e-6, top - bottom));

  const ticks: Array<number> = [];
  for (let tick = bottom; tick <= top + 1e-6; tick += step) ticks.push(Math.round(tick * 100) / 100);

  const stride = labelStride(count, plotWidth);
  // Where the record stops — the first sample with nothing in it. Every series
  // shares one spine, so the array's null and the load's null are the same instant.
  const measured = series[0]?.values.filter((value) => value !== null).length ?? count;

  /**
   * The bands, bottom to top, as `[area, line]` each.
   *
   * A stack, so each band is bounded by the cumulative total *below* it and its own
   * cumulative total — the `line` is that upper edge, which is what gets the stroke.
   * The load is not in here: it is one line over the top of the pile.
   *
   * Every source shares one spine and its nulls trail — the record simply stops —
   * so one contiguous run of drawn samples per band is the whole of it, and the
   * area closes back along the band below rather than along the floor.
   */
  const bands = (() => {
    const stacked = series.filter((one) => one.stacked);
    const lower = new Array<number>(count).fill(0);
    const out: Array<{id: string; token: string; area: string; line: string}> = [];

    for (const one of stacked) {
      const drawn: Array<number> = [];
      const upper = new Array<number>(count).fill(0);

      one.values.forEach((value, index) => {
        if (value === null) return;
        drawn.push(index);
        upper[index] = lower[index]! + value;
      });

      if (drawn.length > 0) {
        const top = drawn.map((index) => `${x(index)},${y(upper[index]!)}`).join(' ');
        const back = [...drawn]
          .reverse()
          .map((index) => `${x(index)},${y(lower[index]!)}`)
          .join(' ');
        out.push({id: one.id, token: one.token, area: `${top} ${back}`, line: top});
      }

      // The next band starts where this one finished, drawn or not: a series with
      // nothing at this sample must not shift the ones above it.
      for (const index of drawn) lower[index] = upper[index]!;
    }

    return out;
  })();

  /** The load, as one line — the height the stack is measured against. */
  const loadLine = (() => {
    const one = series.find((series) => !series.stacked);
    if (one === undefined) return undefined;

    const points = one.values
      .map((value, index) => (value === null ? null : `${x(index)},${y(value)}`))
      .filter((pair): pair is string => pair !== null)
      .join(' ');

    return points === '' ? undefined : {token: one.token, points};
  })();

  const shown = hovered === null ? undefined : hovered;

  return (
    <div ref={boxRef} className="relative w-full">
      {/* NetEco puts the legend on top of the frame; four labels of this length
          have nowhere else to go at the widths this band gets. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-2 text-xs">
        {series.map((one) => (
          <span key={one.id} className={cn('flex items-center gap-1.5', one.token)}>
            <span className="h-0.5 w-3.5 rounded-full bg-current" aria-hidden="true" />
            <span className="text-secondary">{one.label}</span>
          </span>
        ))}
      </div>

      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Power supply distribution, in ${unit}`}
        onPointerLeave={() => setHovered(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          const at = ratio * width - AXIS_WIDTH;
          const index = Math.round((at / plotWidth) * (count - 1));
          setHovered(index >= 0 && index < count ? index : null);
        }}
      >
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
              className={cn('stroke-current', tick === 0 ? 'text-default' : 'text-subtle')}
              strokeWidth={1}
            />
            <text
              x={AXIS_WIDTH - 8}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-current text-[10px] text-tertiary tabular-nums"
            >
              {tickLabel(tick, step)}
            </text>
          </g>
        ))}

        {/* Bottom band first, so a stroke shared by two bands is drawn by the
            upper one and the pile reads as a single stack of shares. */}
        {bands.map((band) => (
          <g key={band.id} className={band.token}>
            <polygon points={band.area} className="fill-current" opacity={0.55} />
            <polyline
              points={band.line}
              fill="none"
              className="stroke-current"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* The load over the top of them. Dashed, and the one series with no fill:
            it is not a share of anything — it is the level the shares add up to, so
            the line should sit exactly on the crown of the stack. Where it does
            not, the chart is wrong, which is a useful thing to be able to see. */}
        {loadLine !== undefined && (
          <polyline
            points={loadLine.points}
            fill="none"
            className={cn('stroke-current', loadLine.token)}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={hovered === null ? 1 : 0.85}
          />
        )}

        {/* Where the record ends. Without it the curves simply stop and read as a
            plant that went quiet, rather than as a day that is not over. */}
        {measured > 0 && measured < count && (
          <line
            x1={x(measured - 1)}
            y1={PAD_TOP}
            x2={x(measured - 1)}
            y2={PAD_TOP + plotHeight}
            className="stroke-current text-default"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}

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

        {labels.map((label, index) =>
          index % stride === 0 || index === count - 1 ? (
            <text
              key={`${label}-${index}`}
              x={x(index)}
              y={HEIGHT - 10}
              textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
              className="fill-current text-[10px] text-tertiary"
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>

      {/* NetEco's readout, which is the part of its panel doing the real work: the
          instant, then every series at it. Placed under the frame rather than
          floating over the curves — a box that follows the pointer covers the very
          shape a reader is pointing at, and at this band's height there is nowhere
          for it to go that isn't on top of something. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-xs">
        {shown === undefined ? (
          <>
            <span className="text-secondary">{overview.caption}</span>
            {overview.totals.map((total) => (
              <span key={total.label} className="text-tertiary tabular-nums">
                {total.label} · <span className="text-primary">{total.value}</span>
              </span>
            ))}
          </>
        ) : (
          <>
            <span className="text-primary tabular-nums">{stamps[shown]}</span>
            {series.map((one) => {
              const value = one.values[shown];
              return (
                <span key={one.id} className={cn('flex items-center gap-1.5', one.token)}>
                  <span className="h-0.5 w-3.5 rounded-full bg-current" aria-hidden="true" />
                  <span className="text-tertiary">
                    {one.label} ·{' '}
                    <span className="text-primary tabular-nums">
                      {value === null || value === undefined
                        ? 'not yet'
                        : `${value} ${unit}`}
                    </span>
                  </span>
                </span>
              );
            })}
          </>
        )}
      </div>

      {/* The stack as arithmetic: each source's energy to the load over the shown
          window, and its share of it. The rows recompute with the period control
          and the day stepper because they come off the same window the bands do.
          The load closes the table at 100% — it is what the shares are of, set off
          by the rule above it the way its dashed line caps the stack. */}
      {overview.mix !== undefined && (
        <table className="mt-3 w-full max-w-md text-xs">
          <thead>
            <tr className="border-b border-subtle text-secondary">
              <th className="py-1.5 pr-3 text-left font-medium">Power supply</th>
              <th className="px-3 py-1.5 text-right font-medium">Energy to load</th>
              <th className="py-1.5 pl-3 text-right font-medium">Share of load</th>
            </tr>
          </thead>
          <tbody>
            {overview.mix.map((row) => (
              <tr
                key={row.id}
                className={cn(row.id === 'LOAD' && 'border-t border-subtle')}
              >
                <td className="py-1.5 pr-3">
                  <span className={cn('flex items-center gap-1.5', row.token)}>
                    <span className="h-0.5 w-3.5 rounded-full bg-current" aria-hidden="true" />
                    <span className={row.id === 'LOAD' ? 'text-primary' : 'text-secondary'}>
                      {row.label}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-secondary tabular-nums">
                  {row.energy}
                </td>
                <td className="py-1.5 pl-3 text-right text-primary tabular-nums">{row.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
