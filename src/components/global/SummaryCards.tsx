import {ChevronDownIcon, ChevronUpIcon, SlidersHorizontalIcon} from 'lucide-react';
import type {ReactNode} from 'react';

import {cn} from '@/lib/utils';

/**
 * The card strip above the fleet and estate lists.
 *
 * Shared between `/gensets` and `/sites` rather than written twice, unlike the two
 * toolbars: a toolbar's controls differ in what they *do*, but these cards are one
 * shape — a label, a set of counts, and a way to filter by one of them — over two
 * sets of numbers. The thing that differs is entirely in the data, which is what
 * makes a shared component the smaller of the two options here.
 *
 * ## The chips are filters, and that is an addition
 *
 * The ask was for cards that show the counts. Showing a number an operator cannot
 * act on is half a control, so each count doubles as a toggle: click "Low fuel"
 * and the list and the map both narrow to those rows. The numbers themselves do not
 * move when you do — see `fleetSummary` for why — so the strip stays a picture of
 * the whole fleet while the list below it answers a narrower question.
 *
 * Nothing here invents colour of its own. A count that carries a verdict is given
 * the same token the badge in the table uses, passed in by the caller as `tone`, so
 * a red "Tank empty" here and a red `Critical` badge two rows down are the same red.
 */

type SummaryCardRowProps = {
  children: ReactNode;
  /** Fold the strip away — see `SummaryCollapseButton`. Phone width only. */
  collapsed?: boolean;
  id?: string;
};

export const SummaryCardRow = ({children, collapsed = false, id}: SummaryCardRowProps) => (
  // Three fixed-ish cards and one that takes the slack, because the customer card
  // holds a wrapping chip list and the other three hold two or three rows each.
  // Below `xl` they stack two-up rather than squeezing four across — at 1280px
  // with the detail panel open, four cards would each be narrower than the number
  // they carry.
  <div
    id={id}
    className={cn(
      'grid grid-cols-2 gap-3 xl:grid-cols-[repeat(3,minmax(9rem,13rem))_minmax(0,1fr)]',
      // `hidden md:grid`, not a bare `hidden`: the fold is a phone affordance and the
      // button driving it does not exist above `md`, so a desktop has to render the
      // strip whatever state the flag happens to hold. Kept in CSS for the reason
      // `useIsCompact` gives — a class cannot fall out of step with the stylesheet,
      // and nothing here needs the breakpoint as a value.
      collapsed && 'hidden md:grid',
    )}
  >
    {children}
  </div>
);

type SummaryCardProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export const SummaryCard = ({label, children, className}: SummaryCardProps) => (
  <section
    aria-label={label}
    className={cn(
      'flex min-w-0 flex-col gap-1.5 rounded-md border border-subtle bg-element px-3 py-2.5',
      className,
    )}
  >
    <h2 className="text-xs font-medium tracking-wide text-secondary uppercase">{label}</h2>
    {children}
  </section>
);

type HeadlineProps = {
  value: number;
  unit: string;
  /** The second figure the headline carries, e.g. `across 17 sites`. */
  detail: string;
};

export const Headline = ({value, unit, detail}: HeadlineProps) => (
  <div className="min-w-0">
    <p className="flex items-baseline gap-1.5">
      <span className="text-2xl leading-none font-semibold text-primary tabular-nums">
        {value}
      </span>
      <span className="truncate text-sm text-secondary">{unit}</span>
    </p>
    <p className="mt-1 truncate text-xs text-secondary">{detail}</p>
  </div>
);

export type ChipTone = 'neutral' | 'ok' | 'warning' | 'critical' | 'fuel' | 'fuel-low';

/**
 * Tone → **the dot's** colour, and the dot's alone.
 *
 * `runStateMeta.ts`'s rule, applied here and then applied again to the numbers: the
 * mark carries the state, the type does not. A count set in red is a coloured
 * *number* before it is a status, it fights the neighbouring counts for attention,
 * and four cards of it read as an alert screen rather than as a summary. So every
 * figure on this strip is `text-primary` whatever it is counting, and the dot beside
 * it says which bucket it belongs to.
 */
const DOT_CLASS: Record<ChipTone, string> = {
  neutral: 'bg-tertiary',
  ok: 'bg-severity-ok',
  warning: 'bg-severity-warning',
  critical: 'bg-severity-critical',
  fuel: 'bg-fuel',
  'fuel-low': 'bg-fuel-tip',
};

type CountChipProps = {
  label: string;
  count: number;
  tone?: ChipTone;
  /** Is this chip's filter currently applied. */
  active: boolean;
  /** Toggle it. Called with the *next* state, so a second click clears. */
  onToggle: (next: boolean) => void;
  /** Fills the row's width — how the two- and three-row cards are laid out. */
  block?: boolean;
  /**
   * Native tooltip text — what the bucket means, for the status chips.
   *
   * A `title` rather than the app's `Tooltip` component: four of these sit in one
   * card and each is already a button, and wrapping every count in a Radix trigger
   * to explain a two-word label costs more than the label is worth.
   */
  title?: string;
};

export const CountChip = ({
  label,
  count,
  tone = 'neutral',
  active,
  onToggle,
  block = false,
  title,
}: CountChipProps) => (
  <button
    type="button"
    title={title}
    aria-pressed={active}
    onClick={() => onToggle(!active)}
    className={cn(
      'flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-sm transition-colors outline-none',
      'hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
      active && 'bg-highlight hover:bg-highlight',
      block && 'w-full justify-between',
    )}
  >
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[tone])} aria-hidden="true" />
      <span className={cn('truncate', active ? 'text-primary' : 'text-secondary')}>{label}</span>
    </span>
    <span className="shrink-0 font-medium text-primary tabular-nums">{count}</span>
  </button>
);

/**
 * The line under a card's chips — a figure that qualifies them without being a
 * filter of its own.
 *
 * The estate total under a filtered headline is the case: it belongs beside the
 * counts but is not one of the buckets, and as a chip it would read as one.
 */
export const CardNote = ({children}: {children: ReactNode}) => (
  <p className="truncate text-xs text-tertiary">{children}</p>
);

type SummaryCollapseButtonProps = {
  collapsed: boolean;
  /** Called with the *next* state, the same shape as `CountChip`'s `onToggle`. */
  onCollapsedChange: (next: boolean) => void;
  /**
   * How many of the strip's chips are applied.
   *
   * Not decoration. Folded, the cards are the only thing on this width saying a
   * filter is on — the chips carry that state and they have just been hidden. A list
   * of two rows with the reason folded away reads as a broken list, so the closed
   * button reports the count and there is something visibly there to reopen.
   */
  activeCount: number;
  /** Id of the `SummaryCardRow` this folds, for `aria-controls`. */
  controls: string;
};

/**
 * Fold the card strip away, below `md` only.
 *
 * The cards have a phone form and their chips are the only filtering this width
 * has — but stacked two-up they are four rows deep, which on a 375px screen is most
 * of the viewport before the fleet list has started. So they fold, and the list
 * takes the height back.
 *
 * `md:hidden`, because above the breakpoint there is nothing to solve: the strip is
 * one row of four and the table under it already has the room it needs.
 *
 * Placed *below* the cards, which is the unusual half of this. A disclosure control
 * normally leads its content, but what is being folded sits at the top of the page
 * under a toolbar, and a second control above it pushes the cards further from the
 * list they describe. Underneath, the button lands between the strip and the list in
 * both states — reading as the seam between them, which is the thing it operates.
 */
export const SummaryCollapseButton = ({
  collapsed,
  onCollapsedChange,
  activeCount,
  controls,
}: SummaryCollapseButtonProps) => {
  const Chevron = collapsed ? ChevronDownIcon : ChevronUpIcon;

  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-controls={controls}
      onClick={() => onCollapsedChange(!collapsed)}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-md border border-subtle bg-element',
        'px-3 py-2 text-sm font-medium text-secondary transition-colors',
        'hover:bg-hover hover:text-primary',
        'outline-none focus-visible:ring-2 focus-visible:ring-outline',
        'md:hidden',
      )}
    >
      <SlidersHorizontalIcon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? 'Show filters' : 'Hide filters'}
      {/* Closed state only: open, the highlighted chips say this already, and a
          second count beside them invites the reader to reconcile two figures. */}
      {collapsed && activeCount > 0 && (
        <span className="rounded-full bg-highlight px-1.5 py-0.5 text-xs font-medium text-primary tabular-nums">
          {activeCount} active
        </span>
      )}
      <Chevron className="size-4 shrink-0" aria-hidden="true" />
    </button>
  );
};
