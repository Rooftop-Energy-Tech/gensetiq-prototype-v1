import {ChevronDownIcon, ChevronUpIcon, SlidersHorizontalIcon} from 'lucide-react';
import {Children} from 'react';
import type {CSSProperties, ReactNode} from 'react';

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
 * a red "Alarms raised" here and a red `Critical` badge two rows down are the same
 * red.
 */

type SummaryCardRowProps = {
  children: ReactNode;
  /** Fold the strip away — see `SummaryCollapseButton`. Phone width only. */
  collapsed?: boolean;
  id?: string;
  /**
   * How many leading cards are the narrow kind — see `CAPPED_COLUMNS`.
   *
   * A prop because "narrow" is a fact about a *card*, not about its index, and the
   * two screens no longer agree: the fleet is one narrow headline followed by four
   * `FilterCard`s that share the rest of the row, and the estate's four are all
   * narrow now that its three attribute filters have become toolbar dropdowns.
   */
  cappedColumns?: number;
};

/**
 * How many of the leading cards are held to a narrow, capped column.
 *
 * A headline, or a block of `block` chips — a label hard left, a count hard right —
 * is done at 13rem. What comes after is a card that turns extra width into something
 * a reader can use: a **wrapping** chip list where extra width is fewer lines, or a
 * `FilterCard` where it is a bucket's figure and the sentence under it.
 *
 * Three is the default because that is what the estate strip's leading cards were.
 * The fleet strip passes `1` — see `GensetsSummaryCards`.
 */
const CAPPED_COLUMNS = 3;

/**
 * The `xl` column template for however many cards the caller passed.
 *
 * Derived from the child count rather than taken as a prop, because the count is
 * **not fixed**: the sites strip's `By programme` card is withheld on an estate
 * whose dataset declares no programmes, so it renders four cards or five. A prop
 * would make every caller restate that condition, and the day a sixth card lands
 * the template and the children would disagree — which is exactly the bug this
 * replaces. A four-card row gets the identical template it always had.
 *
 * Five cards is the ceiling a row of this kind comfortably holds at 1440px — see
 * `SitesSummaryCards`, which is four because its attribute filters moved out to the
 * toolbar.
 */
const columnTemplate = (count: number, cap: number): string => {
  const capped = Math.min(cap, count);
  const slack = Math.max(0, count - capped);

  // Nothing wrapping to absorb the remainder, so the narrow cards share it evenly
  // instead: at 1312px four cards held to 13rem stop two-thirds of the way across
  // and read as a row whose last card failed to load. The 9rem floor is kept, so
  // the two-up stack below `xl` is unchanged.
  if (slack === 0) return `repeat(${count}, minmax(9rem, 1fr))`;

  return [
    `repeat(${capped}, minmax(9rem, 13rem))`,
    ...Array.from({length: slack}, () => 'minmax(0, 1fr)'),
  ].join(' ');
};

export const SummaryCardRow = ({
  children,
  collapsed = false,
  id,
  cappedColumns = CAPPED_COLUMNS,
}: SummaryCardRowProps) => (
  // Capped cards first, then one slack column per wrapping chip list — see
  // `columnTemplate`. The template used to be a literal four columns, which put a
  // fifth card on a second row on its own the moment `By programme` appeared.
  //
  // Below `xl` they stack two-up rather than squeezing the lot across — at 1280px
  // with the detail panel open, five cards would each be narrower than the number
  // they carry.
  <div
    id={id}
    // A custom property rather than an inline `gridTemplateColumns`, because the
    // template must apply at `xl` and nowhere else and an inline style cannot be
    // scoped to a breakpoint. The variable is always set; only `xl` reads it.
    style={
      {
        '--summary-columns': columnTemplate(
          Children.toArray(children).length,
          cappedColumns,
        ),
      } as CSSProperties
    }
    className={cn(
      'grid grid-cols-2 gap-3 xl:grid-cols-[var(--summary-columns)]',
      // An odd number of cards leaves the last one alone in a two-up stack, so it
      // takes the whole row rather than half of it with a hole beside it.
      //
      // `max-xl:` rather than an unprefixed rule plus an `xl:` reset, and that is not
      // a style preference — a media query adds no specificity, so
      // `xl:[&>*:last-child]:col-span-1` (two classes) loses to
      // `[&>*:last-child:nth-child(odd)]:col-span-2` (three) and the fifth card keeps
      // its span into the one-row layout, needing a sixth track and wrapping to a
      // second row: the exact bug this whole change is fixing. Bounding the rule to
      // below `xl` means there is nothing to reset and nothing to out-specify.
      'max-xl:[&>*:last-child:nth-child(odd)]:col-span-2',
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

/**
 * The card's own box, exported so a card that is a **link** can wear it.
 *
 * Two cards on the estate strip lead somewhere instead of filtering in place, and a
 * `<section>` is the wrong element for those. Rather than teach `SummaryCard` to
 * render as a router `Link` — which costs it the router's route typing, since the
 * shared component cannot know either screen's routes — the caller builds its own
 * `Link` and puts this class on it. One declaration, so the two kinds of card cannot
 * drift apart in size, radius or ground.
 */
export const SUMMARY_CARD_BOX =
  'flex min-w-0 flex-col gap-1.5 rounded-md border border-subtle bg-element px-3 py-2.5';

/** The hover and focus treatment a linked card adds on top of the box. */
export const SUMMARY_CARD_LINK =
  'transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline';

export const SummaryCard = ({label, children, className}: SummaryCardProps) => (
  <section aria-label={label} className={cn(SUMMARY_CARD_BOX, className)}>
    <SummaryCardLabel>{label}</SummaryCardLabel>
    {children}
  </section>
);

/**
 * A card's heading, as its own export so a linked card's label reads identically.
 *
 * `<h2>` in both, because the two are the same rank on the page whatever element
 * carries the box around them.
 */
export const SummaryCardLabel = ({children}: {children: ReactNode}) => (
  <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-medium tracking-wide text-secondary uppercase">
    {children}
  </h2>
);

type HeadlineProps = {
  /**
   * A string where the figure carries its own unit — `23%` — and a number where the
   * `unit` beside it does that job. Both set in the same tabular face, so a column
   * of cards keeps one baseline whichever kind it holds.
   */
  value: number | string;
  /**
   * The word beside the figure — `sites`, `gensets`.
   *
   * Optional, because a figure that carries its own unit (`23%`) has nothing to put
   * here, and an empty span beside it would still take the baseline's gap. What such
   * a card is a share *of* belongs on the `detail` line, which has a full row for it
   * rather than the remainder of one.
   */
  unit?: string;
  /** The second figure the headline carries, e.g. `across 17 sites`. */
  detail: string;
};

export const Headline = ({value, unit, detail}: HeadlineProps) => (
  <div className="min-w-0">
    <p className="flex items-baseline gap-1.5">
      <span className="text-2xl leading-none font-semibold text-primary tabular-nums">
        {value}
      </span>
      {unit !== undefined && <span className="truncate text-sm text-secondary">{unit}</span>}
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

type FilterCardProps = {
  label: string;
  count: number;
  /** The word beside the figure — `gensets`. */
  unit: string;
  /** What the bucket means, one line, under the figure. */
  detail: string;
  tone?: ChipTone;
  /** Is this card's filter currently applied. */
  active: boolean;
  /** Toggle it. Called with the *next* state, so a second click clears. */
  onToggle: (next: boolean) => void;
};

/**
 * A whole card that is one filter — a `CountChip` given a card's width.
 *
 * The fleet strip's four readiness buckets are this rather than four rows inside one
 * card, and the trade is width for legibility: a bucket gets the headline figure the
 * `Fleet` card gets, plus the line of prose saying what it *means*, which as a chip
 * was a `title` attribute nobody hovers. Four of them across the strip also read as
 * a scale left to right — cover first, nothing-to-do last — which a stack of four
 * rows in a 13rem card does not.
 *
 * It stays a filter, and looks like one: `aria-pressed`, the highlighted ground the
 * chips use, and a second click clears. The hover treatment is `SUMMARY_CARD_LINK`'s,
 * because a card the whole of which is a target should feel the same here as it does
 * on the estate strip — the difference is that these narrow the list rather than
 * leading away from it, which is what the arrow on those says and this has none.
 *
 * The figure is `text-primary` whatever it counts, per the rule `DOT_CLASS` states:
 * the dot carries the bucket, the number does not.
 */
export const FilterCard = ({
  label,
  count,
  unit,
  detail,
  tone = 'neutral',
  active,
  onToggle,
}: FilterCardProps) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={() => onToggle(!active)}
    className={cn(
      SUMMARY_CARD_BOX,
      SUMMARY_CARD_LINK,
      'cursor-pointer text-left',
      active && 'border-strong bg-highlight hover:bg-highlight',
    )}
  >
    <SummaryCardLabel>
      <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[tone])} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </SummaryCardLabel>
    <p className="flex items-baseline gap-1.5">
      <span className="text-2xl leading-none font-semibold text-primary tabular-nums">{count}</span>
      <span className="truncate text-sm text-secondary">{unit}</span>
    </p>
    {/* Wraps rather than truncating, unlike `Headline`'s detail line: this sentence is
        the whole gain over a chip, and half of "Below the 25% reserve line" is worth
        less than the row being a few pixels taller. A grid row shares its height, so
        the four cards stay level whichever of them wraps. */}
    <p className="text-xs text-secondary">{detail}</p>
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
  /**
   * What the strip *is*, for the button's own label — `Show filters`.
   *
   * A prop because the two screens' strips are no longer the same kind of thing. The
   * fleet's four cards are all filters. The estate's are a summary: one of its four
   * still filters, but two of them are links out and calling the fold "filters"
   * would name the smaller half of what it hides.
   */
  noun?: string;
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
  noun = 'filters',
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
      {collapsed ? `Show ${noun}` : `Hide ${noun}`}
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
