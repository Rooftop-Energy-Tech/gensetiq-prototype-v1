import {useState} from 'react';
import {CheckIcon, ChevronDownIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';
import type {ChipTone} from '@/components/global/SummaryCards';

/**
 * One filter, as a dropdown in a toolbar rather than a card of chips.
 *
 * ## Why some filters are dropdowns and some are cards
 *
 * A card of `CountChip`s shows every bucket and its count at once, which is worth a
 * card's width when the *distribution* is information a reader wants — the status
 * buckets are the estate's readiness, and folding them behind a click would hide the
 * one thing this screen is for.
 *
 * The estate's other three groupings are not that. How a site is fed, which region it
 * is in and which rollout filed it are **attributes**: a reader either wants one of
 * them or does not, and the counts beside them are context rather than an answer. Three
 * cards' worth of width to say so left the strip in two rows. As dropdowns they cost a
 * button each, the counts survive inside, and the summary fits on one line.
 *
 * ## The shape
 *
 * The app's own picker pattern — `InstallationPicker` and the range calendar — rather
 * than a native `<select>`: the rows carry a count on the right, the trigger has to
 * show a *pressed* state when a filter is on, and neither survives an `<option>`.
 *
 * `aria-pressed` on the trigger says the same thing the highlight does, so a filter
 * left on is announced as well as drawn. The check mark repeats it inside, because a
 * reopened dropdown has to say which row it is currently on without relying on the
 * trigger the reader has just covered with a popover.
 */

export type FilterOption<K extends string> = {
  key: K;
  label: string;
  count: number;
  /** Colours the row's dot, for a grouping that carries a verdict. */
  tone?: ChipTone;
};

const DOT_CLASS: Record<ChipTone, string> = {
  neutral: 'bg-tertiary',
  ok: 'bg-severity-ok',
  warning: 'bg-severity-warning',
  critical: 'bg-severity-critical',
  fuel: 'bg-fuel',
  'fuel-low': 'bg-fuel-tip',
};

type FilterSelectProps<K extends string> = {
  /**
   * What the control filters by, shown while nothing is chosen — `Supply`, `Region`.
   *
   * A noun rather than an instruction ("Filter by supply"): the row of them reads as
   * a set of dimensions, and the chevron already says it opens.
   */
  label: string;
  /** The way back out, e.g. `All supplies`. Leads the list, as it does elsewhere. */
  allLabel: string;
  options: Array<FilterOption<K>>;
  value: K | undefined;
  /** Called with the next value, or `undefined` when the filter is cleared. */
  onChange: (next: K | undefined) => void;
};

export const FilterSelect = <K extends string>({
  label,
  allLabel,
  options,
  value,
  onChange,
}: FilterSelectProps<K>) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.key === value);

  // Nothing to choose between, so nothing to draw — the rule `InstallationPicker`
  // sets. An estate whose dataset declares no programmes has an empty list here, and
  // a dropdown that opens onto one row is a control that cannot do anything.
  if (options.length === 0) return null;

  const choose = (next: K | undefined) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-pressed={selected !== undefined}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5',
            'text-sm font-medium whitespace-nowrap transition-colors outline-none',
            'focus-visible:ring-2 focus-visible:ring-outline',
            selected !== undefined
              ? 'border-subtle bg-highlight text-primary'
              : 'border-transparent bg-element text-secondary hover:text-primary',
          )}
        >
          {/* The selected value *replaces* the dimension's name rather than sitting
              after it. `Sarawak` says which filter is on as well as `Region: Sarawak`
              does, in half the width, and the row of triggers is read as a set. */}
          {selected?.label ?? label}
          <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-1">
        <button
          type="button"
          onClick={() => choose(undefined)}
          className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-hover"
        >
          {allLabel}
          {selected === undefined && (
            <CheckIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
          )}
        </button>

        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            // A second click on the row already chosen clears it, so the filter can
            // be put down without hunting for `All` — the `CountChip` behaviour these
            // replaced, kept.
            onClick={() => choose(option.key === value ? undefined : option.key)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {option.tone !== undefined && (
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[option.tone])}
                  aria-hidden="true"
                />
              )}
              <span className="truncate text-primary">{option.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-secondary tabular-nums">{option.count}</span>
              {option.key === value && (
                <CheckIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
              )}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
