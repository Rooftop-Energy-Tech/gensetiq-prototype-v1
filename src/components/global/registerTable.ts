/**
 * The register table's look, as classes, so every table in the app is drawn one way
 * (2026-10-05): the Gensets and Deployments registers, the Service index, the Fuel
 * tables, and the genset detail tabs' alarm, service and run tables.
 *
 * A frame with a `subtle` edge and `md` corners; a separated-border table, since a
 * sticky header row loses a collapsed border as it scrolls; a 40px header on the
 * canvas, in body-size `secondary` text; and a `subtle` rule under every body cell.
 * Classes rather than a component because the tables differ in everything else —
 * the registers' equal-gap columns (`fuel/RegisterTable`), the detail tabs'
 * wrapping cells — and only the look is shared.
 */

/** The box around the table. */
export const REGISTER_FRAME = 'rounded-md border border-subtle';

/** The `<table>` itself. */
export const REGISTER_TABLE = 'w-full border-separate border-spacing-0 text-sm';

/** A header cell. Alignment is the caller's: `text-left`, or `text-right` for figures. */
export const REGISTER_TH = 'sticky top-0 z-10 h-10 border-b border-subtle bg-canvas font-medium text-secondary';

/**
 * The rule under every body cell, set from the table so a row component need not
 * repeat it — a separated-border table draws no border on a `<tr>`. The last row's
 * is dropped, since the frame's own edge is under it.
 */
export const REGISTER_ROWS =
  '[&_tbody_td]:border-b [&_tbody_td]:border-subtle [&_tbody_tr:last-child_td]:border-b-0';
