/**
 * `Time running ─────────── 12 hours`
 *
 * The label/value pair used by both cards in the top row. Label left at
 * `text-secondary`, value hard right at `text-primary`.
 *
 * The value is `shrink-0` and the label takes the slack, which is the opposite of
 * the design's fixed 160px label column. The design is 1440px wide with 626px for
 * the run card; below that the two cards share the row and the label column stops
 * fitting, and a truncated *number* ("2,460 …") is useless in a way a truncated
 * label is not — "Energy produce…" still reads.
 *
 * A plain flex row rather than a `<dl>`: the run card's rows sit beside a timeline
 * in the same flex parent, and a definition list would have to either swallow that
 * timeline or be split across two lists that no longer share a grid.
 */
export const MetricRow = ({label, value}: {label: string; value: string}) => (
  <div className="flex w-full items-center justify-between gap-4 text-sm font-medium">
    <span className="min-w-0 flex-1 truncate text-secondary">{label}</span>
    <span className="shrink-0 whitespace-nowrap text-primary">{value}</span>
  </div>
);
