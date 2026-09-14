import {cn} from '@/lib/utils';

/**
 * One line of a chart's hover readout: a series, and what it read at the hovered
 * instant or bucket.
 *
 * `label` is optional because a single-series chart has nothing to name — its one
 * figure under the stamp is unambiguous, and `Fuel · 8.4 L` on a chart titled
 * `Genset Fuel Consumption` says the same word twice.
 */
export type ChartTooltipRow = {
  key: string;
  label?: string;
  value: string;
  /** A text token class — `text-solar`, `text-battery`. Colours swatch and figure. */
  token?: string;
  /** Drawn to match how the series appears on the plot. `none` for a bare row. */
  swatch?: 'line' | 'dashed' | 'square' | 'dot' | 'none';
};

/** Room for `Starter battery voltage` and its figure — the longest pair in the set. */
const DEFAULT_WIDTH = 200;

const Swatch = ({kind}: {kind: NonNullable<ChartTooltipRow['swatch']>}) => {
  if (kind === 'none') return null;
  if (kind === 'square')
    return <span className="size-2 shrink-0 rounded-[2px] bg-current opacity-70" aria-hidden="true" />;
  if (kind === 'dot')
    return <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />;
  if (kind === 'dashed')
    return <span className="w-3 shrink-0 border-t border-dotted border-current" aria-hidden="true" />;
  return <span className="h-0.5 w-3 shrink-0 rounded-full bg-current" aria-hidden="true" />;
};

/**
 * The hover readout every chart in the app shares: the bucket or instant, then
 * what each series read there, floated beside the crosshair.
 *
 * ## Why it floats rather than sitting under the frame
 *
 * Because the figure belongs to the thing the pointer is on. A readout parked in a
 * strip below the plot makes a reader's eye leave the bar, find the line, read it,
 * and come back — which at half-hour resolution means losing their place on every
 * sample. Attached to the crosshair, the number arrives where they are already
 * looking, and stepping along the series is one continuous movement.
 *
 * The strip below the frame is not gone: it keeps what is true of the **window** —
 * the caption, the legend, the totals — which is exactly the half that should not
 * move as the pointer does. The split is per-point figures here, per-window figures
 * there.
 *
 * ## Positioning
 *
 * `x` and `frameWidth` are in the container's own pixels, so a chart drawn in
 * viewBox units scales them before handing them over. The box flips to the left of
 * the crosshair once it would otherwise run off the frame, and is clamped inside it
 * either way — a tooltip that is half off the card is worse than one on the wrong
 * side. `pointer-events-none` throughout: it sits over the plot it is reporting, and
 * must never eat the move events that keep it alive.
 */
export const ChartTooltip = ({
  x,
  frameWidth,
  title,
  rows,
  note,
  width = DEFAULT_WIDTH,
  top = 12,
}: {
  /** The crosshair, in container pixels from its left edge. */
  x: number;
  /** The container's own width, in the same pixels. */
  frameWidth: number;
  /** The instant or bucket being reported — `07:30`, `Sept`. */
  title: string;
  rows: ReadonlyArray<ChartTooltipRow>;
  /** A closing line under the rows, for a caveat the figures need. */
  note?: string;
  width?: number;
  top?: number;
}) => {
  const flipped = x + width + 12 > frameWidth;
  const left = Math.max(0, Math.min(frameWidth - width, flipped ? x - width - 12 : x + 12));

  /**
   * Whether the figures form a column.
   *
   * As soon as **one** row is named, every figure is pushed right so they line up
   * under each other — a chart whose reading sits beside its swatch and whose
   * `Expected` sits at the far edge reads as two tables. A tooltip with nothing
   * named anywhere is a stamp over a figure, and that figure stays where the eye
   * lands rather than stranded across an empty box.
   */
  const named = rows.some((row) => row.label !== undefined);

  return (
    <div
      className="pointer-events-none absolute z-10 flex flex-col gap-1 rounded-md border border-default bg-overlay px-2.5 py-2 shadow-md"
      style={{width, left, top}}
    >
      <p className="text-xs font-medium text-secondary tabular-nums">{title}</p>

      {rows.map((row) => (
        <div
          key={row.key}
          className={cn(
            'flex items-baseline gap-2',
            named ? 'justify-between' : 'justify-start',
            row.token,
          )}
        >
          <span className="flex min-w-0 items-baseline gap-1.5">
            <Swatch kind={row.swatch ?? 'line'} />
            {row.label !== undefined && (
              <span className="truncate text-xs text-secondary">{row.label}</span>
            )}
          </span>
          <span
            className={cn(
              'shrink-0 text-xs font-semibold tabular-nums',
              row.token === undefined && 'text-primary',
            )}
          >
            {row.value}
          </span>
        </div>
      ))}

      {note !== undefined && <p className="text-[10px] text-secondary">{note}</p>}
    </div>
  );
};
