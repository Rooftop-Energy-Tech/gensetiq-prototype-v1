import {cn} from '@/lib/utils';

/**
 * The share table, straightened into a bar — a doughnut chart uncurled.
 *
 * One horizontal track spanning 0–100%, cut into segments sized by each source's
 * share of the window, in the same tokens the chart draws them. It states exactly
 * what the table it replaced stated — one aggregate per source — but as proportion
 * the eye takes in whole: which segment dominates is visible before a single number
 * is read, and the numbers sit in the key underneath.
 *
 * The rows come in as the table's rows did: sources first, the 100% total last.
 * The total is not a segment — it is what the segments add up to — so it closes
 * the key instead, the way the load row closed the table.
 *
 * ## Why the track is 10px of bare colour
 *
 * It was 28px tall with each segment captioned inside it, which made the bar a
 * second chart competing with the real one for the same glance. The design
 * (Figma `Section - Site diagnostics`) puts it above the plot as a rule: a thin
 * full-width track that answers *what carried this window* in one look, with every
 * figure in one key below it. Nothing is written inside a segment any more, which
 * is also what lets a 4% sliver be drawn honestly rather than widened to hold its
 * own label.
 *
 * ## Why the key no longer sits under its own segment
 *
 * Each entry used to be positioned at its segment's own width, which paid for the
 * pairing with a ragged row that reflowed on every period change. The colour is the
 * pairing — a reader matches `Genset` to the purple length, not to the pixel it
 * starts at — so the entries are a plain left-aligned flow and the row is stable.
 *
 * No outer margin: the caller places it. It is the first thing in the band on the
 * distribution chart and the last on the trend chart, and a margin baked in here
 * would be wrong at one of them.
 */
export const ShareBar = ({
  rows,
}: {
  rows: Array<{label: string; token: string; energy: string; share: string}>;
}) => {
  const segments = rows
    .slice(0, -1)
    .map((row) => ({...row, pct: Number.parseFloat(row.share)}))
    .filter((row) => Number.isFinite(row.pct) && row.pct > 0);
  const total = rows[rows.length - 1];

  if (segments.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Each segment is its own pill rather than a slice of one clipped track:
          at this height the 2px between them is the only thing separating two
          adjacent colours, and rounded ends read as deliberate where a hard cut
          reads as a rendering seam.

          **Filled at 55% inside a full-strength 1px edge**, which is exactly how
          the plot under it draws a band: a 55% area under a solid stroke in the
          same token. The design's own pixels solve back to that — `#BBA2F7` is
          `fuel` (`#8B5CF6`) at 55% over the card's ground and its top row is the
          token itself — so this is one opacity and one border rather than six new
          colours to keep in step with the tokens.

          The edge is what keeps the lighter fill from going soft: a 10px rule at
          55% and nothing else reads as a smudge at a glance, and the stroke gives
          each segment the same definition its own curve has in the chart. The
          key's swatches stay solid, which is what makes them read as the colour's
          name rather than as more bar. */}
      <div
        className="flex h-2.5 w-full gap-[2px]"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.share}`).join(', ')}
      >
        {segments.map((segment) => (
          <div
            key={segment.label}
            // `bg-current/55` rather than `opacity-55`: the opacity utility would
            // fade the border with the fill, and the border is the one part that
            // has to stay at full strength.
            className={cn('h-full rounded-full border border-current bg-current/55', segment.token)}
            style={{width: `${segment.pct}%`}}
          />
        ))}
      </div>

      {/* The key: one entry per segment, then what they add up to. The percentage
          rides with the energy rather than in the track, because the two are one
          fact — `29 kWh (50%)` is the sentence, and splitting it across the bar
          and the key made a reader hold half of it while they found the rest. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={cn('flex items-center gap-1.5', segment.token)}
          >
            <span className="size-3.5 shrink-0 rounded bg-current" aria-hidden="true" />
            <span className="text-tertiary">
              {segment.label} ·{' '}
              <span className="text-primary tabular-nums">
                {segment.energy} ({segment.share})
              </span>
            </span>
          </span>
        ))}

        {total !== undefined && (
          // Set off from the sources by more than the gap between them: it is not
          // another one of them, it is their sum.
          <span className="pl-1 text-tertiary">
            {total.label} ·{' '}
            <span className="text-primary tabular-nums">{total.energy}</span>
          </span>
        )}
      </div>
    </div>
  );
};
