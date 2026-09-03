import {MetricRow} from '@/modules/genset/components/detail/MetricRow';

/**
 * The band that says **what the thing on this page is** — one per detail page, and
 * the same band on all four.
 *
 * The site, genset, solar and battery pages each grew their own copy of this: a
 * `<section>` at a fixed narrow width holding a column of `MetricRow`s, with the
 * comment above each one saying it was "the narrow block the site page uses". Three
 * of those comments were true and the fourth had drifted, which is what a shared
 * shape maintained by copying eventually does. It is one component now, and the
 * pages supply the rows.
 *
 * ## What belongs in it
 *
 * Facts that **do not move**. The strip at the top of each of these pages carries
 * the figures that change — output, charge, fuel, alarms — and a reader checks
 * those to decide whether anything needs doing today. These are nameplates and
 * identity: what the machine is rated at, where the yard is, how many modules are
 * on the roof. Their job is to tell you what you have just been looking at, and
 * mixing them into the strip would put two rates of change in one line.
 *
 * ## Two columns, and why the split is where it is
 *
 * A single narrow column under a full-width band left most of the page empty and
 * pushed the chart below it out of view for no reason. So the rows split in two
 * once there is room.
 *
 * The split is **column-wise**: the left column is the first half of the list and
 * the right is the second, so the two-column version is the one-column version cut
 * in half rather than a different reading order. That is what the two nested
 * `<div>`s buy — at narrow width they stack and the rows read straight down exactly
 * as they did before. It also means the row count is never baked into a class name,
 * which matters because these lists are not fixed: the site's `Programme` row is
 * withheld on an estate that declares none, and the four pages carry between two and
 * eight rows each.
 *
 * It keys off a **container query**, not a breakpoint. These bands sit inside two
 * rails — the app's and the section's — that take 480px between them, so the
 * viewport width says nothing useful about how much room the rows actually have: a
 * `md:` split would fire at 768px, where the band is 288px wide. `@container`
 * measures the band itself, which is the only width that decides whether two
 * columns fit.
 *
 * ## Why it is full width
 *
 * It used to be capped at one column's 510px, then at two columns plus their
 * gutter. Both caps left the band's own rules — the hairlines above and below it,
 * which run the full width of the page — bracketing a block of content that stopped
 * a third of the way across. The rules are what say where this band is, so the
 * content now runs to meet them, inset by the same padding as every other band on
 * the page.
 *
 * The consequence, and it is a real one: on a very wide monitor each column is wide
 * enough that a label and its right-aligned value sit a long way apart. What holds
 * it together is that the values line up down each column's right edge, which is
 * `MetricRow`'s own design and the reason the rows are worth setting as rows at all.
 */
export type DetailRow = {
  label: string;
  value: string;
};

export const DetailBand = ({
  ariaLabel,
  rows,
}: {
  /** `Site details`, `Genset details` — the band has no visible heading. */
  ariaLabel: string;
  rows: Array<DetailRow>;
}) => {
  // The odd row goes to the **left** column, so a three-row band reads 2 + 1 and the
  // longer column is the one the eye starts on.
  const split = Math.ceil(rows.length / 2);
  // Filtered so a one-row band renders one column rather than an empty second cell.
  const columns = [rows.slice(0, split), rows.slice(split)].filter(
    (column) => column.length > 0,
  );

  return (
    <section aria-label={ariaLabel} className="@container px-5 py-1">
      {/* `gap-y` matters at narrow width and nowhere else: the two column `<div>`s
          are stacked there, and without it the seam between them would be the one
          place in the list where the rhythm breaks. */}
      <div className="grid w-full gap-x-14 gap-y-2.5 @2xl:grid-cols-2">
        {columns.map((column, index) => (
          <div key={index} className="flex flex-col gap-2.5">
            {column.map((row) => (
              <MetricRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};
