import {useState} from 'react';

import {cn} from '@/lib/utils';

/**
 * Which stretch of the record a view reports on.
 *
 * The Fuel page drew one of these above every tab, and a depot's own page drew
 * another, until 2026-09-30, when both went to a fixed last month with no control
 * (Jeff: the pages show the current state — see `useFuelWindow`). It is still drawn
 * by the deliveries table and the truck log, each of which starts on the page's
 * month and narrows itself alone once touched — see `TablePeriod`.
 *
 * Four presets and a custom pair. The presets are the periods a yard actually works
 * to: yesterday, the week, the month. `Custom` is for the argument that starts after
 * one of those shows something — "what happened between the 3rd and the 11th".
 */

export const PERIODS = ['1d', '7d', '1m', 'custom'] as const;

export type Period = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<Period, string> = {
  '1d': '1 day',
  '7d': '7 days',
  '1m': '1 month',
  custom: 'Custom',
};

const DAY = 24 * 3_600_000;

/** `yyyy-mm-dd` in the reader's own timezone, for the date inputs. */
export const inputDay = (at: number): string => {
  const t = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};

/**
 * The window a period means, right now.
 *
 * A preset ends at `now` rather than at midnight: a yard checking the day's
 * reconciliation at four in the afternoon means the last twenty-four hours, not
 * yesterday's closed book. Custom is whole days, because that is what a date input
 * can express — and its end runs to midnight *after* the day picked, so a range
 * drawn to the 11th includes the 11th.
 */
export const periodWindow = (
  period: Period,
  now: number,
  customFrom: string,
  customTo: string,
): {from: number; to: number} => {
  if (period === 'custom') {
    const from = new Date(`${customFrom}T00:00:00`).getTime();
    const to = new Date(`${customTo}T00:00:00`).getTime() + DAY;
    return Number.isNaN(from) || Number.isNaN(to) || to <= from
      ? {from: now - 30 * DAY, to: now}
      : {from, to};
  }

  const days = period === '1d' ? 1 : period === '7d' ? 7 : 30;
  return {from: now - days * DAY, to: now};
};

/**
 * The Fuel pages' one window: the last month, ending now (Jeff, 2026-09-30).
 *
 * The page and a depot's own page each had a period control until that day; both
 * now show the current state only. `now` is held once per mount, so the figures do
 * not drift while the page is open. The tables' own controls still start here —
 * see `TablePeriod`.
 */
export const useFuelWindow = () => {
  const [now] = useState(() => Date.now());
  const period: Period = '1m';
  return {
    now,
    period,
    ...periodWindow(period, now, '', ''),
    // `last 30 days`, not `1 month` (Jeff, 2026-10-01): the window rolls, ending
    // now, and a month would read as the calendar's, resetting on the 1st.
    periodLabel: 'last 30 days',
  };
};

export const PeriodControl = ({
  period,
  customFrom,
  customTo,
  earliest,
  now,
  onPeriodChange,
  onCustomChange,
}: {
  period: Period;
  customFrom: string;
  customTo: string;
  /** The oldest instant the record holds — the calendar cannot reach past it. */
  earliest: number;
  now: number;
  onPeriodChange: (period: Period) => void;
  onCustomChange: (from: string, to: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-3">
    {/* A segmented control, in the pattern the runs and analysis tabs use. A reader
        moving between the three carries the expectation. */}
    <div className="flex items-center gap-1 rounded-md border border-subtle bg-element p-1">
      {PERIODS.map((entry) => (
        <button
          key={entry}
          type="button"
          onClick={() => onPeriodChange(entry)}
          className={cn(
            'rounded px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-outline',
            entry === period
              ? 'bg-highlight text-primary'
              : 'text-secondary hover:text-primary',
          )}
        >
          {PERIOD_LABEL[entry]}
        </button>
      ))}
    </div>

    {period === 'custom' && (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={customFrom}
          min={inputDay(earliest)}
          max={customTo}
          onChange={(event) => onCustomChange(event.target.value, customTo)}
          className="rounded border border-subtle bg-canvas px-2 py-1 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-outline"
        />
        <span className="text-sm text-tertiary">to</span>
        <input
          type="date"
          value={customTo}
          min={customFrom}
          max={inputDay(now)}
          onChange={(event) => onCustomChange(customFrom, event.target.value)}
          className="rounded border border-subtle bg-canvas px-2 py-1 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-outline"
        />
      </div>
    )}
  </div>
);
