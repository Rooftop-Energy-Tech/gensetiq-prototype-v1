import {ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, SearchIcon, SearchXIcon, XIcon} from 'lucide-react';
import {Fragment, useState} from 'react';
import type {ReactNode} from 'react';

import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {cn} from '@/lib/utils';

/**
 * The pieces both Fuel tables are built from, so the Depots tab's deliveries and
 * the Trucks tab's log behave alike (Jeff, 2026-09-29): a search box, filter
 * dropdowns, a `Filtered by` row with `Clear all`, headers that sort, and the
 * equal-gap layout. Each piece is the Gensets register's markup — `GensetsTable`
 * for the header and the gaps, `GensetsActiveFilters` for the chips — so a reader
 * who knows that table knows these.
 */

export type Direction = 'asc' | 'desc';

/**
 * Which column sorts, and which way. A new column opens in its own natural
 * direction; the one already showing flips — `changeSort` in the Gensets page.
 */
export const useSort = <K extends string>(natural: Record<K, Direction>, initial: K) => {
  const [sort, setSort] = useState<K>(initial);
  const [direction, setDirection] = useState<Direction>(natural[initial]);
  const change = (next: K) => {
    if (next === sort) {
      setDirection(direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSort(next);
    setDirection(natural[next]);
  };
  const order = <T,>(rows: ReadonlyArray<T>, compare: Record<K, (a: T, b: T) => number>): Array<T> =>
    rows.slice().sort((a, b) => (direction === 'asc' ? 1 : -1) * compare[sort](a, b));
  return {sort, direction, change, order};
};

/** Every real cell: held to its content. See `GensetsTable` for the layout. */
export const CELL = 'w-px px-2.5 whitespace-nowrap';
/** A body cell: `CELL`, the row's height and its rule. */
export const TD = cn(CELL, 'h-11 border-b border-subtle py-2');

/** The stretch between two columns. Layout, so hidden from assistive tech. */
export const Gap = ({header = false, hide}: {header?: boolean; hide?: string}) =>
  header ? (
    <th aria-hidden="true" className={cn('sticky top-0 z-10 h-10 border-b border-subtle bg-canvas p-0', hide)} />
  ) : (
    <td aria-hidden="true" className={cn('h-11 border-b border-subtle p-0', hide)} />
  );

export type Column<K extends string> = {
  label: string;
  /** The key this header sorts by, or `undefined` where the column cannot sort. */
  sort: K | undefined;
  /** Classes that drop the column at a width, e.g. `hidden sm:table-cell`. */
  hide?: string;
  align?: 'right';
};

export const SearchBox = ({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
}) => (
  <InputGroup className="w-full max-w-[187px] min-w-[140px] flex-1">
    <InputGroupAddon>
      <SearchIcon aria-hidden="true" />
    </InputGroupAddon>
    <InputGroupInput
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
    />
  </InputGroup>
);

/** Plates are typed with or without their space, so neither side keeps one. */
export const matches = (needle: string, ...haystacks: Array<string>): boolean => {
  const n = needle.trim().toLowerCase().replace(/\s/g, '');
  return n === '' || haystacks.some((h) => h.toLowerCase().replace(/\s/g, '').includes(n));
};

export type Chip = {key: string; label: string; clear: () => void};

export const ActiveFilters = ({chips}: {chips: ReadonlyArray<Chip>}) =>
  chips.length === 0 ? null : (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Active filters" role="group">
      <span className="text-secondary">Filtered by:</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          aria-label={`Remove filter ${chip.label}`}
          className={cn(
            'flex h-7 cursor-pointer items-center gap-1 rounded-full border border-subtle bg-highlight pr-1.5 pl-2.5',
            'font-medium whitespace-nowrap text-primary transition-colors outline-none',
            'hover:bg-hover focus-visible:ring-2 focus-visible:ring-outline',
          )}
        >
          {chip.label}
          <XIcon className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => chips.forEach((chip) => chip.clear())}
        className="cursor-pointer px-1 font-medium text-secondary underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-outline"
      >
        Clear all
      </button>
    </div>
  );

export const EmptyTable = ({children}: {children: ReactNode}) => (
  <p className="flex items-center gap-2 rounded-md border border-subtle bg-element p-3 text-sm text-secondary">
    <SearchXIcon className="size-4 shrink-0" aria-hidden="true" />
    {children}
  </p>
);

/**
 * The header row. `aria-sort` is `none` on a sortable column not in use and absent
 * on one that cannot sort, so a screen reader is never offered a dead control.
 */
export const SortHeader = <K extends string>({
  columns,
  sort,
  direction,
  onSort,
}: {
  columns: ReadonlyArray<Column<K>>;
  sort: K;
  direction: Direction;
  onSort: (next: K) => void;
}) => (
  <thead>
    <tr>
      {columns.map((column, index) => {
        const active = column.sort !== undefined && column.sort === sort;
        const Icon = !active ? ChevronsUpDownIcon : direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;
        const key = column.sort;
        return (
          <Fragment key={column.label}>
            {index > 0 && <Gap header hide={column.hide} />}
            <th
              scope="col"
              aria-sort={
                key === undefined ? undefined : active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
              }
              className={cn(
                CELL,
                'sticky top-0 z-10 h-10 border-b border-subtle bg-canvas font-medium text-secondary',
                column.align === 'right' ? 'text-right' : 'text-left',
                column.hide,
              )}
            >
              {key === undefined ? (
                column.label
              ) : (
                <button
                  type="button"
                  onClick={() => onSort(key)}
                  className={cn(
                    'group/sort relative -mx-1 inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5',
                    'transition-colors outline-none hover:text-primary',
                    'focus-visible:ring-2 focus-visible:ring-outline',
                    active && 'text-primary',
                  )}
                >
                  {column.label}
                  {/* The inactive arrows appear on hover in the gap rather than holding
                      a slot, for the reason `GensetsTable` gives. */}
                  <Icon
                    className={cn(
                      'size-3.5 shrink-0 transition-opacity',
                      !active &&
                        'absolute top-1/2 left-full -translate-y-1/2 opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100',
                    )}
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    {active
                      ? `Sorted by ${column.label.toLowerCase()} — click to reverse`
                      : `Sort by ${column.label.toLowerCase()}`}
                  </span>
                </button>
              )}
            </th>
          </Fragment>
        );
      })}
    </tr>
  </thead>
);
