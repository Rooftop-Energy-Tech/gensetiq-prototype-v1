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
    <div className="mt-3 flex max-w-md flex-col gap-2">
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.share}`).join(', ')}
      >
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={cn('h-full bg-current', segment.token)}
            style={{width: `${segment.pct}%`}}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {segments.map((segment) => (
          <span key={segment.label} className={cn('flex items-center gap-1.5', segment.token)}>
            <span className="h-2 w-2 rounded-[2px] bg-current" aria-hidden="true" />
            <span className="text-tertiary">
              {segment.label} ·{' '}
              <span className="text-primary tabular-nums">{segment.share}</span>{' '}
              <span className="tabular-nums">({segment.energy})</span>
            </span>
          </span>
        ))}

        {total !== undefined && (
          <span className="text-tertiary tabular-nums">
            {total.label} · <span className="text-primary">{total.energy}</span>
          </span>
        )}
      </div>
    </div>
  );
};
