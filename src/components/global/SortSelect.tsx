import {useState} from 'react';
import {ArrowUpDownIcon, CheckIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';

export type SortOption<K extends string> = {
  key: K;
  /** The dimension, as the trigger writes it — `Fuel level`, `Site name`. */
  label: string;
  /** Which way this key runs, for the row's second line. */
  detail: string;
};

/**
 * How a register is ordered, as a dropdown beside the filters.
 *
 * ## Why this is not `FilterSelect`
 *
 * They look alike and they are not the same control. A filter has a way *out* — the
 * `All supplies` row that leads every one of those lists — because no filter is the
 * ordinary state. A sort has no such row: a list is always in some order, and the
 * question is only which. So there is no `undefined` here, no second click to clear,
 * and the trigger is never *unpressed*.
 *
 * That difference is the whole reason for a second component rather than a flag on
 * the first. A `FilterSelect` with `allLabel` omitted would be a filter pretending,
 * and the next person to add a filter would find a prop that means "actually this is
 * a sort".
 *
 * ## Why the trigger names the dimension and not the direction
 *
 * Because the direction is not a choice here. Each key runs the one way that is
 * useful — worst alarms first, emptiest tank first, names A to Z — and a control
 * offering six options where three are the reverse of the other three would spend a
 * reader's attention on a decision nobody needs to make. The row's second line says
 * which way, so it is stated rather than guessed.
 *
 * The icon stays put rather than flipping with the key, for the same reason: it says
 * *this orders the list*, which is true of every option.
 */
export const SortSelect = <K extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<SortOption<K>>;
  value: K;
  onChange: (next: K) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.key === value) ?? options[0];

  if (options.length < 2 || selected === undefined) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Sort by — currently ${selected.label}`}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-transparent',
            'bg-element px-2.5 text-sm font-medium whitespace-nowrap text-secondary',
            'transition-colors outline-none hover:text-primary',
            'focus-visible:ring-2 focus-visible:ring-outline',
          )}
        >
          <ArrowUpDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {selected.label}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-1">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              onChange(option.key);
              setOpen(false);
            }}
            className="flex w-full cursor-pointer items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-primary">{option.label}</span>
              <span className="truncate text-xs text-secondary">{option.detail}</span>
            </span>
            {option.key === value && (
              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-secondary" aria-hidden="true" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
