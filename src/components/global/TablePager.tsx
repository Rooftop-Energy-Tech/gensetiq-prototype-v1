import {ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon} from 'lucide-react';

import {useState} from 'react';

import {Button} from '@/components/ui/button';
import {figure} from '@/lib/format';
import {cn} from '@/lib/utils';

/**
 * Under a register's table (Gensets, Deployments): which rows are showing, and a way
 * to the rest.
 *
 * The pages sit centred under the table, with first and last beside previous and
 * next (2026-09-30); the row count keeps the left edge. Three number slots: the
 * current page always in the middle, its neighbours either side, and an empty slot
 * where there is no neighbour (before page 1, after the last). The field therefore
 * never moves, and the numbers slide past it as previous and next are pressed. The current page's number is a
 * field: type a page and press Enter to go there.
 * Withheld when everything fits on one, since a pager with nowhere to go is a
 * control that does nothing.
 */
/**
 * The current page, typed over to jump. Enter or leaving the field goes there; a
 * number past either end lands on that end, and anything that is not a number puts
 * the current page back. Escape abandons the edit.
 */
const PageField = ({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
}) => {
  const [draft, setDraft] = useState<string | undefined>(undefined);

  const commit = () => {
    if (draft === undefined) return;
    const typed = Number.parseInt(draft, 10);
    setDraft(undefined);
    if (Number.isNaN(typed)) return;
    const next = Math.min(Math.max(typed, 1), pageCount);
    if (next !== page) onPageChange(next);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`Page ${page} of ${pageCount}, type a page to go to`}
      aria-current="page"
      value={draft ?? String(page)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          setDraft(undefined);
          event.currentTarget.blur();
        }
      }}
      className={cn(
        'h-7 w-9 rounded-md border border-default bg-highlight text-center font-medium text-primary tabular-nums outline-none',
        'focus-visible:border-brand focus-visible:ring-[1px] focus-visible:ring-brand',
      )}
    />
  );
};

export const TablePager = ({
  label,
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: {
  /** Names the pager for assistive tech — `Gensets table pages`. */
  label: string;
  /** 1-based, already clamped to `pageCount`. */
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
}) => {
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const numbers = [page - 1, page, page + 1];

  return (
    <nav
      aria-label={label}
      className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 pt-2 text-sm"
    >
      <p className="text-secondary tabular-nums">
        {figure(first)}–{figure(last)} of {figure(total)}
      </p>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronsLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        {numbers.map((number) =>
          number < 1 || number > pageCount ? (
            <span key={number} aria-hidden="true" className="size-7" />
          ) : number === page ? (
            <PageField key={number} page={page} pageCount={pageCount} onPageChange={onPageChange} />
          ) : (
            <Button
              key={number}
              variant="ghost"
              size="icon-sm"
              className="size-7 tabular-nums"
              aria-label={`Page ${number}`}
              onClick={() => onPageChange(number)}
            >
              {number}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={page === pageCount}
          onClick={() => onPageChange(pageCount)}
          aria-label="Last page"
        >
          <ChevronsRightIcon aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
};
