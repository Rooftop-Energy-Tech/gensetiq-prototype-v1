import type {ReactNode} from 'react';

/**
 * The shell every primary-device card shares: what kind of plant it is, which unit
 * it is, the badge row, and whatever figures that kind of plant reports.
 *
 * ## Why the three cards share a shell rather than each drawing their own
 *
 * Because the design's three are the *same card* three times — the frame draws
 * `Genset`, `Solar` and `Battery` with an identical header, an identical badge row
 * and an identical figure block, and differs only in what goes in them. Writing
 * that three times is how the fuel card ends up with a 12px header and the battery
 * card a 14px one, and a row of cards that do not line up reads as three unrelated
 * panels rather than one bank of plant.
 *
 * The `label` / `identity` split is the design's and it is doing real work: the
 * left says what *kind* of thing this is, which is what a reader scanning the row
 * needs, and the right names the specific unit, which is what they need once they
 * have found it. Collapsing them into one heading loses the scan.
 */
export const SiteDeviceCard = ({
  label,
  identity,
  badges,
  children,
}: {
  /** `Genset`, `Solar`, `Battery` — the kind, not the unit. */
  label: string;
  /**
   * The unit, hard right. A `<Link>` wherever the unit has a page of its own, which
   * is the same move the genset row's name makes: a card is a summary, and anybody
   * who wants the dials should be one click from them.
   */
  identity: ReactNode;
  badges: ReactNode;
  children?: ReactNode;
}) => (
  // `flex-1` with a floor, so three cards share the row evenly on a desktop and
  // stack rather than compress on a phone. `min-w-0` because the identity line
  // truncates, and a flex child cannot truncate below its content without it.
  //
  // The 520px ceiling is the design's 515, and it is what stops a site with only
  // one kind of plant from stretching that card across the whole page. Without it a
  // lone genset card is 1,500px wide and the run card inside it puts "Time ran" and
  // "9 hours" at opposite ends of the screen — a label and its value far enough
  // apart to have to be read twice. Three cards still fill a desktop row exactly:
  // 3 × 520 plus two gaps is the band's own width.
  <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-md border border-subtle bg-element p-3 md:min-w-[20rem] md:max-w-[32.5rem]">
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-sm font-medium text-secondary">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-primary">
        {identity}
      </span>
    </div>

    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">{badges}</div>

    {children}
  </div>
);

/**
 * The figure block: a label over a value, in columns.
 *
 * The design lays two of these side by side on the solar and battery cards and one
 * on the genset's. Columns rather than the `MetricRow` label-left/value-right pair
 * the card's *details* use, because these are the card's headline numbers and the
 * design sets them at 16px semibold under a 14px label — a figure that size wants
 * to sit under its label rather than across the card from it.
 */
export const SiteDeviceFigures = ({
  figures,
}: {
  figures: Array<{label: string; value: string; unit?: string}>;
}) => (
  <div className="flex flex-wrap items-start gap-x-8 gap-y-3 pt-1">
    {figures.map((figure) => (
      <div key={figure.label} className="flex min-w-[7rem] flex-col gap-1">
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
