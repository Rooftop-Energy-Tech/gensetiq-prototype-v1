import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {CheckIcon, ChevronDownIcon, SearchIcon} from 'lucide-react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';

export type SearchOption = {
  id: string;
  label: string;
  /** A second, quieter line: the street address under a placename. */
  detail?: string;
};

export type SearchGroup = {
  /** Omitted for a list with one group. */
  label?: string;
  options: Array<SearchOption>;
  /** Shown in place of the options: `Searching…`, `No matches`. */
  status?: string;
};

/**
 * A field-shaped trigger that opens a type-to-filter list (2026-09-30): the
 * deployment Settings' Customer and Address. The caller does the filtering, so one
 * group can be a local list and another an address search over the network.
 */
export const SearchSelect = ({
  id,
  value,
  placeholder,
  groups,
  query,
  onQueryChange,
  onSelect,
  selectedId,
  disabled = false,
  searchPlaceholder = 'Search',
}: {
  id?: string;
  /** What the closed field shows. */
  value: ReactNode;
  placeholder?: string;
  groups: Array<SearchGroup>;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (option: SearchOption) => void;
  selectedId?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const flat = groups.flatMap((group) => group.options);

  useEffect(() => setActive(0), [query, open]);

  const choose = (option: SearchOption) => {
    onSelect(option);
    setOpen(false);
    onQueryChange('');
  };

  let index = -1;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A closed list starts afresh, so a half-typed search does not greet the next open.
        if (!next) onQueryChange('');
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-default bg-element px-3 py-1.5 text-left text-sm text-primary shadow-xs outline-none',
            'focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className="min-w-0 flex-1">
            {value ?? <span className="text-tertiary">{placeholder}</span>}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-secondary" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
        <div className="flex items-center gap-2 border-b border-subtle px-3">
          <SearchIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((at) => Math.min(at + 1, flat.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((at) => Math.max(at - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const option = flat[active];
                if (option !== undefined) choose(option);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
          />
        </div>

        <div role="listbox" className="flex max-h-80 flex-col overflow-y-auto p-1">
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? groupIndex} className="flex flex-col">
              {group.label !== undefined && (
                <p className="px-2 pt-2 pb-1 text-xs font-medium text-tertiary">{group.label}</p>
              )}
              {group.status !== undefined && group.options.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-secondary">{group.status}</p>
              ) : (
                group.options.map((option) => {
                  index += 1;
                  const at = index;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={option.id === selectedId}
                      onMouseEnter={() => setActive(at)}
                      onClick={() => choose(option)}
                      className={cn(
                        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                        at === active && 'bg-hover',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-primary">{option.label}</span>
                        {option.detail !== undefined && (
                          <span className="block truncate text-xs text-secondary">
                            {option.detail}
                          </span>
                        )}
                      </span>
                      {option.id === selectedId && (
                        <CheckIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
