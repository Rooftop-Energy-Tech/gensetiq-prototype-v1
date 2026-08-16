import {amount} from '@/lib/format';
import type {GaugeReading} from '../../types/telemetry.type';

/**
 * Geometry lifted off the design's gauge asset.
 *
 * Figma ships the dial as two PNGs — a full circle of 76 radial ticks in
 * `text-subtle`, and the same circle in teal clipped by a box whose width *is*
 * the value. Reproducing that literally would mean shipping a bitmap per value,
 * so it is drawn as SVG instead: same 76-per-circle pitch, which over the visible
 * 180° works out to 39 ticks, and the same 36.5 → 47.5 radial band inside a 97px
 * square.
 */
const TICKS = 39;
const CENTRE = 48.5;
const RADIUS_INNER = 36.5;
const RADIUS_OUTER = 47.5;
/** Height of the cropped viewBox: the top half, plus a pixel for the label. */
const VISIBLE_HEIGHT = 49.5;

type Tick = {x1: number; y1: number; x2: number; y2: number};

/**
 * The 39 tick segments, left (0) to right (full scale) over the top half.
 *
 * Computed once at module load rather than per render: four gauges × 39 ticks is
 * 156 trigonometric pairs on a page that redraws whenever a chip is clicked, and
 * the geometry never depends on the value — only which ticks are lit does.
 */
const TICK_GEOMETRY: Array<Tick> = Array.from({length: TICKS}, (_, index) => {
  // 180° (pointing left) sweeping to 0° (pointing right). SVG's y axis runs
  // down, hence the subtraction.
  const radians = (Math.PI * (TICKS - 1 - index)) / (TICKS - 1);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x1: CENTRE + RADIUS_INNER * cos,
    y1: CENTRE - RADIUS_INNER * sin,
    x2: CENTRE + RADIUS_OUTER * cos,
    y2: CENTRE - RADIUS_OUTER * sin,
  };
});

/**
 * One of the four dials in the genset home page's gauge row.
 *
 * A tick ring rather than a needle or a filled arc, which is what the design
 * draws and the right call for the readings it carries: an operator watching
 * engine speed cares that it is *at* 1500 and steady, and a ring of discrete
 * ticks makes a small drift visible in a way a smooth sweep does not.
 *
 * The scale ends are labelled outside the dial, so the only thing inside the arc
 * is the number itself.
 */
export const TickGauge = ({reading}: {reading: GaugeReading}) => {
  const span = reading.max - reading.min;
  const fraction =
    span > 0 ? Math.min(1, Math.max(0, (reading.value - reading.min) / span)) : 0;
  // `round`, not `floor`: at exactly half scale the dial should read half lit,
  // and flooring would leave it one tick short of it.
  const lit = Math.round(fraction * TICKS);

  return (
    // Caption below the whole [min · dial · max] row rather than inside the dial's
    // column. In the design every caption is one line, so the two arrangements look
    // identical — but "Coolant temperature" does not fit 97px, and with the caption
    // nested the wrap pushed the scale labels down out of line with their dial.
    <div className="flex w-[153px] flex-col items-center gap-[3px]">
      <div className="flex w-full items-end justify-center gap-[5px]">
        <span className="w-7 shrink-0 pb-3 text-right text-[10px] font-medium text-secondary">
          {reading.min.toLocaleString('en-MY')}
        </span>

        <div className="relative w-[97px] shrink-0">
          <svg
            viewBox={`0 0 97 ${VISIBLE_HEIGHT}`}
            className="block w-full"
            role="img"
            // "of 55 Hz" would be a lie on the two dials whose scale starts above
            // zero: it reads as a fraction of full scale, and frequency's face
            // begins at 45. Both ends, so the sighted reader's `45 ─── 55` and the
            // screen reader's sentence carry the same information.
            aria-label={`${reading.label}: ${amount(reading.value, reading.unit, reading.precision)}, on a scale of ${amount(reading.min, reading.unit)} to ${amount(reading.max, reading.unit)}`}
          >
            {TICK_GEOMETRY.map((tick, index) => (
              <line
                key={index}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke="currentColor"
                strokeWidth={1.6}
                className={index < lit ? 'text-teal' : 'text-tertiary'}
              />
            ))}
          </svg>

          {/* Inside the arc's mouth, on the diameter line — where the design
              puts it. Absolute rather than a flex row under the SVG, because it
              has to overlap the bottom of the dial rather than sit below it. */}
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap">
            <span className="text-xs font-semibold text-primary">
              {amount(reading.value, '', reading.precision)}
            </span>
            {reading.unit !== '' && (
              <span className="text-[10px] font-medium text-primary">{reading.unit}</span>
            )}
          </div>
        </div>

        <span className="w-7 shrink-0 pb-3 text-[10px] font-medium text-secondary">
          {reading.max.toLocaleString('en-MY')}
        </span>
      </div>

      <span className="w-full text-center text-xs font-medium text-primary">{reading.label}</span>
    </div>
  );
};
