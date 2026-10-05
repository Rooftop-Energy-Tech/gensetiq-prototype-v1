import {useState} from 'react';

/**
 * Which stretch of the record a view reports on.
 *
 * The Fuel page drew a period control above every tab, and a depot's own page drew
 * another, until 2026-09-30, when both went to a fixed last month with no control
 * (Jeff: the pages show the current state — see `useFuelWindow`). The deliveries
 * table and the truck log kept one each, and on 2026-10-05 theirs became the genset
 * analysis tab's `RangePicker` — see `TablePeriod`. What is left here is the page's
 * own window.
 */

export const PERIODS = ['1d', '7d', '1m', 'custom'] as const;

export type Period = (typeof PERIODS)[number];

const DAY = 24 * 3_600_000;

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
 * not drift while the page is open. The tables' own controls open on the same 30
 * days — see `TablePeriod`.
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
