import type {ReactNode} from 'react';

/**
 * One device, as the panel beside the single-line diagram.
 *
 * ## Why it is one column now
 *
 * This was a full-width row under the chart, and its content was split left and
 * right: the figures in the left 640px and the genset's last run in a 479px block
 * beside them. Both halves were sized for a ~1,500px band. The card now sits in the
 * column next to the drawing — 355px at the narrowest width the page puts the two
 * side by side, about 600px at a wide desktop — so the split cannot hold, and it
 * would not have failed cleanly: those were `md:` breakpoints, which read the
 * *viewport*, so a desktop reader got a 479px block forced into a 355px column
 * while a phone, where the column is full width and the split would fit, got the
 * stack.
 *
 * So there is no split. Everything reads down: what this is, what state it is in,
 * its figures, then whatever second subject it carries. The last run is the only
 * `aside` there has ever been, and a run set under a machine's figures rather than
 * beside them is no worse a reading — it is still the same card, at the full width
 * of the panel instead of a fixed 479.
 *
 * ## The header
 *
 * Kind then unit, adjacent and left-aligned, which is the design's. The left says
 * what sort of thing this is, and the right names the specific unit. In a column
 * this narrow they were never going to be anywhere else, but the reason they belong
 * together is the same one the band had: pushing the unit to the far right would
 * put a gap between a thing and its name.
 */
export const SiteDeviceCard = ({
  label,
  identity,
  badges,
  aside,
  children,
}: {
  /** `Genset`, `Solar`, `Battery` — the kind, not the unit. */
  label: string;
  /**
   * The unit. A `<Link>` wherever it has a page of its own, which is the same move
   * the fleet table's name column makes: a row is a summary, and anybody who wants
   * the dials should be one click from them.
   */
  identity: ReactNode;
  badges: ReactNode;
  /**
   * A second subject about the same device, under its figures — the genset's last
   * run, and so far only that.
   *
   * Still its own prop rather than more `children`, because it is a card in its own
   * right and the gap above it is bigger than the gaps inside the column. A run is
   * a separate statement about the machine, not another of its figures.
   */
  aside?: ReactNode;
  children?: ReactNode;
}) => (
  <div className="flex h-full flex-col gap-3 rounded-md border border-subtle bg-element p-3">
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-sm font-medium text-secondary">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-primary">{identity}</span>
    </div>

    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">{badges}</div>

    {children}

    {/* `mt-1` on top of the column's own gap: enough to read as a break without
        being a second section. `flex` so the run card, which fills its parent,
        takes the panel's width. */}
    {aside !== undefined && <div className="mt-1 flex w-full">{aside}</div>}
  </div>
);

/**
 * The row's headline figures: a label over a value, in columns.
 *
 * The design sets the columns 240px apart and left-aligns them rather than
 * spreading them across the available width, and that survives the move into a
 * narrow panel unchanged — which is the point of a minimum rather than a count. At
 * the wide end two sit side by side as the design draws them; in a 355px column
 * they wrap to one a line, at the same size and the same left edge. Spreading them
 * instead would have made a bank's three figures 100px wide apiece at the narrow
 * end and half a screen apart at the wide one.
 */
export const SiteDeviceFigures = ({
  figures,
}: {
  figures: Array<{label: string; value: string; unit?: string}>;
}) => (
  <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
    {figures.map((figure) => (
      <div key={figure.label} className="flex min-w-[13.5rem] flex-col gap-1">
        <span className="text-sm font-medium text-secondary">{figure.label}</span>
        <span className="flex items-baseline gap-0.5 text-primary">
          <span className="text-base font-semibold tabular-nums">{figure.value}</span>
          {figure.unit !== undefined && (
            <span className="text-sm font-medium">{figure.unit}</span>
          )}
        </span>
      </div>
    ))}
  </div>
);
