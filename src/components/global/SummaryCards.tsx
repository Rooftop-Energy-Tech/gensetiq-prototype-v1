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
 * act on is half a control, so each count doubles as a toggle: click "Refuel due"
 * and the list and the map both narrow to those rows. The numbers themselves do not
 * move when you do — see `fleetSummary` for why — so the strip stays a picture of
 * the whole fleet while the list below it answers a narrower question.
 *
 * Nothing here invents colour of its own. A count that carries a verdict is given
 * the same token the badge in the table uses, passed in by the caller as `tone`, so
 * a red "Tank empty" here and a red `Critical` badge two rows down are the same red.
 */

export const SummaryCardRow = ({children}: {children: ReactNode}) => (
  // Three fixed-ish cards and one that takes the slack, because the customer card
  // holds a wrapping chip list and the other three hold two or three rows each.
  // Below `xl` they stack two-up rather than squeezing four across — at 1280px
  // with the detail panel open, four cards would each be narrower than the number
  // they carry.
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-[repeat(3,minmax(9rem,13rem))_minmax(0,1fr)]">
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

export type ChipTone = 'neutral' | 'ok' | 'warning' | 'critical';

/**
 * Tone → the glyph's colour. The chip's own surface stays neutral in every tone.
 *
 * `runStateMeta.ts`'s rule, applied here: colour the mark, not the field. A strip
 * of four cards with coloured surfaces is a traffic light before it is a set of
 * numbers, and the one thing these need to be legible as is numbers.
 */
const DOT_CLASS: Record<ChipTone, string> = {
  neutral: 'bg-tertiary',
  ok: 'bg-severity-ok',
  warning: 'bg-severity-warning',
  critical: 'bg-severity-critical',
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
