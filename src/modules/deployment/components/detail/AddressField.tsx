import {SearchIcon} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';

import {Popover, PopoverAnchor, PopoverContent} from '@/components/ui/popover';
import {cn} from '@/lib/utils';
import type {DeploymentPin} from '../../types/deployment.type';
import {resolveAddressOption, useAddressGroups} from './addressSearch';

/**
 * The address as a search box you type straight into (2026-10-01), for Settings and
 * the new-deployment form. Suggestions open under it as you type; picking one hands
 * its pin back through `onPick`. Leaving without picking puts the current address
 * back, so the box never shows text that is not where the deployment stands.
 */
export const AddressField = ({
  id,
  address,
  onPick,
  disabled = false,
  trailing,
}: {
  id?: string;
  /** The address the deployment stands at now, or `null` before one is picked. */
  address: string | null;
  onPick: (pin: DeploymentPin) => void;
  disabled?: boolean;
  /** A small control inside the box on the right, such as the map toggle. */
  trailing?: ReactNode;
}) => {
  const [text, setText] = useState(address ?? '');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const {groups, places} = useAddressGroups(query);
  const options = groups.flatMap((group) => group.options);
  const status = groups[0]?.status;

  useEffect(() => setText(address ?? ''), [address]);
  useEffect(() => setActive(0), [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setText(address ?? '');
  };

  const choose = (index: number) => {
    const option = options[index];
    const picked = option === undefined ? undefined : resolveAddressOption(option, places);
    if (picked === undefined) return;
    onPick(picked.pin);
    setText(picked.pin.address);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  return (
    <Popover open={open && query.trim() !== ''}>
      <PopoverAnchor asChild>
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary"
          />
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            value={text}
            placeholder="Search an address or enter coordinates"
            onChange={(event) => {
              setText(event.target.value);
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={close}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((at) => Math.min(at + 1, options.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((at) => Math.max(at - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                choose(active);
              } else if (event.key === 'Escape' && open) {
                // Close the list, not the dialog around it.
                event.stopPropagation();
                close();
              }
            }}
            className={cn(
              'h-9 w-full min-w-0 rounded-md border border-default bg-element py-1 pl-9 text-sm text-primary shadow-xs outline-none placeholder:text-tertiary',
              'focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand',
              'disabled:cursor-not-allowed disabled:opacity-50',
              trailing === undefined ? 'pr-3' : 'pr-28',
            )}
          />
          {trailing !== undefined && (
            <span className="absolute top-1/2 right-1 -translate-y-1/2">{trailing}</span>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        // A press in the list would blur the input and close it before the click lands.
        onMouseDown={(event) => event.preventDefault()}
      >
        <div role="listbox" className="flex max-h-80 flex-col overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-secondary">{status}</p>
          ) : (
            options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  'flex w-full cursor-pointer flex-col rounded-md px-2 py-1.5 text-left text-sm',
                  index === active && 'bg-hover',
                )}
              >
                <span className="block truncate text-primary">{option.label}</span>
                {option.detail !== undefined && (
                  <span className="block truncate text-xs text-secondary">{option.detail}</span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
