import {cn} from '@/lib/utils';

/**
 * The share table, straightened into a bar — a doughnut chart uncurled.
 *
 * One horizontal track spanning 0–100%, cut into segments sized by each source's
 * share of the window, in the same tokens the chart above draws them. It states
 * exactly what the table it replaced stated — one aggregate per source — but as
 * proportion the eye takes in whole: which segment dominates is visible before a
 * single number is read, and the numbers still sit in the legend underneath.
 *
 * The rows come in as the table's rows did: sources first, the 100% total last.
 * The total is not a segment — it is what the segments add up to — so it closes
 * the legend instead, the way the load row closed the table.
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
    <div className="mt-3 flex max-w-2xl flex-col gap-2.5">
      <div className="flex w-full items-center gap-3">
        <div
          className="flex h-7 min-w-0 flex-1 gap-[2px] overflow-hidden rounded-full"
          role="img"
          aria-label={segments.map((s) => `${s.label} ${s.share}`).join(', ')}
        >
          {segments.map((segment) => (
            <div
              key={segment.label}
              className={cn(
                'flex h-full items-center justify-center overflow-hidden bg-current',
                segment.token,
              )}
              style={{width: `${segment.pct}%`}}
            >
              {/* The segment says its own name where it has the room — a
                  doughnut's callout, inlined. Slivers stay mute and keep the
                  legend below as their voice. */}
              {segment.pct >= 15 && (
                <span className="truncate px-2 text-xs font-medium whitespace-nowrap text-white tabular-nums">
                  {segment.label} · {segment.share}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* What the segments add up to — the closed ring of the doughnut this
            bar uncurls. */}
        <span className="text-sm text-tertiary tabular-nums">100%</span>
      </div>

      {/* The legend mirrors the track's own geometry — same widths, same gaps —
          so each entry sits directly under the segment it prices, the way a
          doughnut's callouts sit on their own arcs. The percentages are not
          restated (the segments carry them): each entry is the energy its share
          corresponds to, and the window's total right-aligns beneath the 100%
          it is the figure for. */}
      <div className="flex w-full items-center gap-3 whitespace-nowrap text-sm">
        <div className="flex min-w-0 flex-1 gap-[2px]">
          {segments.map((segment) => (
            <div key={segment.label} style={{width: `${segment.pct}%`}}>
              <span className={cn('flex items-center gap-1.5', segment.token)}>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-current"
                  aria-hidden="true"
                />
                <span className="text-tertiary">
                  {segment.label} ·{' '}
                  <span className="text-primary tabular-nums">{segment.energy}</span>
                </span>
              </span>
            </div>
          ))}
        </div>

        {total !== undefined && (
          <span className="shrink-0 text-primary tabular-nums">{total.energy}</span>
        )}
      </div>
    </div>
  );
};
