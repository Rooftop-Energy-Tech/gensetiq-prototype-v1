import type {ReactNode} from 'react';

/**
 * One device, as a full-width row.
 *
 * ## Why a row and not a card in a grid
 *
 * Because the number of devices varies from one to three across the estate, and a
 * grid of cards has to answer "what fills the rest of the row" every time it is
 * not three. Seventeen of the twenty-five sites here have exactly one device, so
 * that question was being asked more often than not, and every answer to it was
 * either a stretched card or a hole.
 *
 * A stack of full-width rows never asks it. One row and three rows are the same
 * layout with different heights, so a reader moving between a genset-only site and
 * a solar hybrid finds the same page rather than two arrangements of one. It also
 * scales past three, which a three-column grid does not: a yard with four sets is
 * four rows, and nothing about this file changes.
 *
 * ## The header
 *
 * Kind then unit, adjacent and left-aligned, which is the design's. The left says
 * what sort of thing this is — the word a reader scanning a stack of rows is
 * looking for — and the right names the specific unit they want once they have
 * found it. In a full-width row the two belong together at the left edge; pushing
 * the unit to the far right would put a 1,700px gap between a thing and its name.
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
   * A block set beside the row's own content rather than under it — the genset's
   * last run, and so far only that.
   *
   * Beside the *whole* column, header included, which is where the design puts it:
   * a run is a second subject about the same machine, not a footnote to its
   * figures, and sitting it level with the heading says so. It also gives the row
   * something to put in its right half, which is the half a stacked full-width row
   * otherwise has to leave empty.
   */
  aside?: ReactNode;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-3 rounded-md border border-subtle bg-element p-3 md:flex-row md:gap-4">
    {/* Capped only when something sits beside it. A row with no aside — the array,
        the bank — takes the full width for its figures, which is the design's. */}
    <div
      className={
        aside === undefined
          ? 'flex min-w-0 flex-1 flex-col gap-3'
          : 'flex min-w-0 flex-1 flex-col gap-3 md:max-w-[640px]'
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-secondary">{label}</span>
        <span className="min-w-0 truncate text-sm font-medium text-primary">{identity}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">{badges}</div>

      {children}
    </div>

    {aside !== undefined && (
      <div className="flex w-full md:w-[479px] md:shrink-0">{aside}</div>
    )}
  </div>
);

/**
 * The row's headline figures: a label over a value, in columns.
 *
 * The design sets the two columns 240px apart and left-aligns them rather than
 * spreading them across the row. That is right for a stack of rows — the figures
 * line up down the page between one device and the next, so `Generated today` on
 * the solar row sits directly under `Fuel level` on the genset row, and the eye can
 * read the column instead of tracking across each row separately. Spreading them
 * to the full width would break that alignment on every row of different arity.
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
