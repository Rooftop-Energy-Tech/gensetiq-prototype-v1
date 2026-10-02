import {CalendarIcon, ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

import {cn} from '@/lib/utils';

import {Input} from './input';
import {Popover, PopoverAnchor, PopoverContent} from './popover';

/** `2026-10-01` → `01/10/2026`; anything else → empty. */
const shown = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match === null ? '' : `${match[3]}/${match[2]}/${match[1]}`;
};

/** Digits typed so far, with the slashes put back: `0110` → `01/10`. */
const masked = (typed: string): string => {
  const digits = typed.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
};

/** `01/10/2026` → `2026-10-01` when it is a real calendar day, else `null`. */
const parsed = (text: string): string | null => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (match === null) return null;
  const [, dd, mm, yyyy] = match;
  const day = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (day.getDate() !== Number(dd) || day.getMonth() !== Number(mm) - 1) return null;
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * A date field that reads and types dd/mm/yyyy whatever the browser's locale
 * (2026-10-01). `<input type="date">` draws its text in the operating system's
 * format, so the same form read 10/01/2026 in a US-locale Firefox. The value in and
 * out is still `yyyy-mm-dd`, the native input's, so it drops in where one was. The
 * calendar button opens this app's own month grid, in the theme's tokens, rather than
 * the browser's picker, which every browser draws in its own colours (2026-10-01).
 *
 * `onChange` fires only with a whole valid day inside `min`–`max`, or `''` when the
 * field is cleared; a half-typed date goes back to the last good one on blur.
 */
export const DateInput = ({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}) => {
  const [draft, setDraft] = useState(shown(value));
  const [open, setOpen] = useState(false);

  useEffect(() => setDraft(shown(value)), [value]);

  const inRange = (iso: string) =>
    (min === undefined || iso >= min) && (max === undefined || iso <= max);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <Input
            id={id}
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            autoComplete="off"
            disabled={disabled}
            value={draft}
            className="pr-9"
            onChange={(event) => {
              const next = masked(event.target.value);
              setDraft(next);
              const iso = parsed(next);
              if (iso !== null && inRange(iso) && iso !== value) onChange(iso);
            }}
            onBlur={() => {
              if (draft === '') {
                if (value !== '') onChange('');
                return;
              }
              const iso = parsed(draft);
              if (iso === null || !inRange(iso)) setDraft(shown(value));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <button
            type="button"
            aria-label="Open calendar"
            aria-expanded={open}
            disabled={disabled}
            onClick={() => setOpen((shown) => !shown)}
            className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded text-secondary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <CalendarIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-auto p-3">
        <Calendar
          value={value}
          min={min}
          max={max}
          onPick={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const isoOf = (day: Date): string =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

const dayOf = (iso: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match === null ? null : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const addDays = (day: Date, days: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);

/**
 * A month of days, Monday first. Arrow keys move a day or a week, Page Up and Page
 * Down a month, and Enter picks; days outside `min`–`max` are greyed and cannot be
 * picked. Opens on the picked day, or today.
 */
const Calendar = ({
  value,
  min,
  max,
  onPick,
}: {
  value: string;
  min?: string;
  max?: string;
  onPick: (iso: string) => void;
}) => {
  const today = isoOf(new Date());
  const [focus, setFocus] = useState(() => dayOf(value) ?? new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  const inRange = (iso: string) =>
    (min === undefined || iso >= min) && (max === undefined || iso <= max);

  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${isoOf(focus)}"]`)?.focus();
  }, [focus]);

  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const days = Array.from({length: 42}, (_, index) => addDays(start, index));
  const shiftMonth = (by: number) =>
    setFocus(
      (at) =>
        new Date(
          at.getFullYear(),
          at.getMonth() + by,
          Math.min(at.getDate(), new Date(at.getFullYear(), at.getMonth() + by + 1, 0).getDate()),
        ),
    );

  return (
    <div className="flex w-64 flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-secondary hover:bg-hover hover:text-primary"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
        </button>
        <span aria-live="polite" className="text-sm font-medium text-primary">
          {MONTHS[focus.getMonth()]} {focus.getFullYear()}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-secondary hover:bg-hover hover:text-primary"
        >
          <ChevronRightIcon aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        className="grid grid-cols-7 gap-0.5"
        onKeyDown={(event) => {
          const step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7}[event.key];
          if (step !== undefined) {
            event.preventDefault();
            setFocus((at) => addDays(at, step));
          } else if (event.key === 'PageUp' || event.key === 'PageDown') {
            event.preventDefault();
            shiftMonth(event.key === 'PageUp' ? -1 : 1);
          }
        }}
      >
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            role="columnheader"
            className="flex h-7 items-center justify-center text-xs text-tertiary"
          >
            {weekday}
          </span>
        ))}
        {days.map((day) => {
          const iso = isoOf(day);
          const picked = iso === value;
          const outside = day.getMonth() !== focus.getMonth();
          const allowed = inRange(iso);
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-day={iso}
              tabIndex={iso === isoOf(focus) ? 0 : -1}
              aria-selected={picked}
              aria-current={iso === today ? 'date' : undefined}
              aria-label={`${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`}
              disabled={!allowed}
              onClick={() => onPick(iso)}
              className={cn(
                'flex size-8 cursor-pointer items-center justify-center rounded-md text-sm outline-none',
                'focus-visible:ring-[1px] focus-visible:ring-brand',
                'disabled:cursor-not-allowed disabled:opacity-30',
                picked
                  ? 'bg-brand font-medium text-brand-text'
                  : cn(
                      'hover:bg-hover',
                      outside ? 'text-tertiary' : 'text-primary',
                      iso === today && 'font-medium text-brand',
                    ),
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between border-t border-subtle pt-2">
        <button
          type="button"
          disabled={!inRange(today)}
          onClick={() => onPick(today)}
          className="cursor-pointer rounded-md px-2 py-1 text-xs text-brand hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Today
        </button>
        {value !== '' && (
          <button
            type="button"
            onClick={() => onPick('')}
            className="cursor-pointer rounded-md px-2 py-1 text-xs text-secondary hover:bg-hover hover:text-primary"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
