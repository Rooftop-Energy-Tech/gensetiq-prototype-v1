import {useState} from 'react';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';

import {cn} from '@/lib/utils';
import {dateParam} from '../../../types/analysisView.type';

/**
 * Two months side by side, click a day then click another.
 *
 * Hand-built rather than a date-picker dependency, for the reason everything
 * else here is: the app's whole surface is four hundred lines of SVG and a
 * colour scale, and a calendar is a grid of buttons. The library versions arrive
 * with their own theming to be overridden, their own locale handling, and a
 * range model richer than two dates.
 *
 * Two months rather than one because the ranges people ask for cross month
 * boundaries — "the last week of July into August" is one drag here and two
 * navigations plus a lost anchor in a single-month picker.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
] as const;

/** First of the month containing an instant. */
const monthStart = (at: number): Date => {
  const day = new Date(at);
  return new Date(day.getFullYear(), day.getMonth(), 1);
};

const addMonths = (at: Date, months: number): Date =>
  new Date(at.getFullYear(), at.getMonth() + months, 1);

/**
 * The cells of one month, `undefined` for the leading and trailing blanks.
 *
 * Blanks rather than the neighbouring months' days: with two months on screen
 * the same date would appear twice, once live and once as filler, and clicking
 * the filler copy is a trap.
 */
const monthCells = (month: Date): Array<Date | undefined> => {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // `getDay()` is Sunday-based; the grid starts Monday.
  const lead = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;

  return [
    ...Array.from({length: lead}, () => undefined),
    ...Array.from(
      {length: days},
      (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
    ),
  ];
};

const sameDay = (left: Date, right: number): boolean =>
  dateParam(left.getTime()) === dateParam(right);

export const RangeCalendar = ({
  from,
  to,
  earliest,
  latest,
  onSelect,
}: {
  /** `YYYY-MM-DD`, or `undefined` when no custom range is set. */
  from: string | undefined;
  to: string | undefined;
  earliest: number;
  latest: number;
  onSelect: (from: string, to: string) => void;
}) => {
  // Opens on the month the current selection sits in, or on the latest month
  // there is data for — the right-hand pane shows "now", which is where almost
  // every range starts being reasoned about.
  const [leftMonth, setLeftMonth] = useState(() =>
    addMonths(monthStart(from === undefined ? latest : new Date(`${from}T00:00`).getTime()), -1),
  );

  /**
   * The first click of a new range, before the second lands.
   *
   * Held here rather than pushed to the URL: a half-made range is not a state
   * worth linking to or stepping back through, and committing it would redraw
   * the chart across a window the reader is still in the middle of describing.
   */
  const [anchor, setAnchor] = useState<Date | undefined>(undefined);
  const [hovered, setHovered] = useState<Date | undefined>(undefined);

  const selectedFrom = from === undefined ? undefined : new Date(`${from}T00:00`).getTime();
  const selectedTo = to === undefined ? undefined : new Date(`${to}T00:00`).getTime();

  // While an anchor is down, the highlight follows the cursor — so the reader
  // can see the span they are about to commit before they commit it.
  const previewStart =
    anchor === undefined
      ? selectedFrom
      : Math.min(anchor.getTime(), (hovered ?? anchor).getTime());
  const previewEnd =
    anchor === undefined
      ? selectedTo
      : Math.max(anchor.getTime(), (hovered ?? anchor).getTime());

  const handleClick = (day: Date) => {
    if (anchor === undefined) {
      setAnchor(day);
      return;
    }

    const [start, end] = [anchor.getTime(), day.getTime()].sort((a, b) => a - b);
    setAnchor(undefined);
    setHovered(undefined);
    onSelect(dateParam(start), dateParam(end));
  };

  const renderMonth = (month: Date) => (
    <div key={month.getTime()} className="flex w-[224px] flex-col gap-2">
      <p className="text-center text-sm font-medium text-primary">
        {MONTHS[month.getMonth()]} {month.getFullYear()}
      </p>

      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="flex h-6 items-center justify-center text-[10px] font-medium text-tertiary"
          >
            {weekday.charAt(0)}
          </span>
        ))}

        {monthCells(month).map((day, index) => {
          if (day === undefined) return <span key={`blank-${index}`} className="h-8" />;

          const at = day.getTime();
          const disabled = at < earliest - 1 || at > latest;
          const isStart = previewStart !== undefined && sameDay(day, previewStart);
          const isEnd = previewEnd !== undefined && sameDay(day, previewEnd);
          const inRange =
            previewStart !== undefined &&
            previewEnd !== undefined &&
            at > previewStart &&
            at < previewEnd;

          return (
            <button
              key={at}
              type="button"
              disabled={disabled}
              aria-pressed={isStart || isEnd}
              onClick={() => handleClick(day)}
              onPointerEnter={() => setHovered(day)}
              className={cn(
                'flex h-8 cursor-pointer items-center justify-center text-xs font-medium transition-colors',
                // Square in the middle of a run, rounded at its ends, so the
                // selection reads as one band rather than a row of chips.
                inRange && 'bg-highlight text-primary',
                isStart && 'rounded-l-md bg-brand text-brand-text',
                isEnd && 'rounded-r-md bg-brand text-brand-text',
                !inRange && !isStart && !isEnd && 'rounded-md text-secondary hover:bg-highlight',
                disabled && 'cursor-not-allowed text-tertiary opacity-40 hover:bg-transparent',
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  const canGoBack = addMonths(leftMonth, -1).getTime() + 32 * 86_400_000 > earliest;
  const canGoForward = addMonths(leftMonth, 2).getTime() <= latest;

  return (
    <div className="flex flex-col gap-2 p-2" onPointerLeave={() => setHovered(undefined)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-secondary transition-colors hover:bg-highlight hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Previous month</span>
        </button>

        <p className="text-xs text-tertiary">
          {anchor === undefined ? 'Pick a start date' : 'Pick an end date'}
        </p>

        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-secondary transition-colors hover:bg-highlight hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Next month</span>
        </button>
      </div>

      <div className="flex gap-4">{[leftMonth, addMonths(leftMonth, 1)].map(renderMonth)}</div>
    </div>
  );
};
