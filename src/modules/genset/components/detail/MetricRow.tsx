/**
 * `Max capacity ─────────── 400 L`
 *
 * The label/value pair the tank card and the details band are built from. Label
 * left at `text-secondary`, value hard right at `text-primary`.
 *
 * The value is `shrink-0` and the label takes the slack, which is the opposite of
 * the design's fixed 160px label column. The design is 1440px wide and gives the
 * band's cards more room than any window below it does; once the column stops
 * fitting, a truncated *number* ("2,460 …") is useless in a way a truncated label
 * is not — "Time to empt…" still reads.
 *
 * A plain flex row rather than a `<dl>`: these rows sit beside a tank graphic in
 * the same flex parent, and a definition list would have to either swallow that
 * graphic or be split across two lists that no longer share a grid.
 */
export const MetricRow = ({label, value}: {label: string; value: string}) => (
  <div className="flex w-full items-center justify-between gap-4 text-sm font-medium">
    <span className="min-w-0 flex-1 truncate text-secondary">{label}</span>
    <span className="shrink-0 whitespace-nowrap text-primary">{value}</span>
  </div>
);
