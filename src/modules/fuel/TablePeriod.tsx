import {useState} from 'react';

import type {Chip} from './RegisterTable';
import {PERIOD_LABEL, PeriodControl, inputDay, periodWindow} from './PeriodControl';
import type {Period} from './PeriodControl';

/**
 * A table's own period, drawn as the page's control is: the same four segments and
 * the same `Custom` date pair (Jeff, 2026-09-30). The deliveries table and the truck
 * log each carry one.
 *
 * Until it is touched it shows and follows the page's period, so on arrival a table
 * lists what the figures above it add up. Once touched it holds its own, for that
 * table alone, and leaves a chip that puts it back to the page's.
 */

/** The page's period, which a table follows until its own control is touched. */
export type PageWindow = {period: Period; from: number; to: number; now: number; earliest: number};

const IN: Record<Period, string> = {
  '1d': 'the last day',
  '7d': 'the last 7 days',
  '1m': 'the last month',
  custom: 'this range',
};

/** `3 Sep – 11 Sep`, for the chip a custom range leaves. */
const rangeLabel = (from: string, to: string): string => {
  const day = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', {day: 'numeric', month: 'short'});
  return `${day(from)} – ${day(to)}`;
};

/**
 * `chipLabel` names the chip, `Delivered` or `Logged`. `onChange` runs on every
 * change of period, for the table to go back to its first page.
 */
export const useTablePeriod = (page: PageWindow, chipLabel: string, onChange: () => void) => {
  const [period, setPeriod] = useState<Period | undefined>(undefined);
  const [customFrom, setCustomFrom] = useState(() => inputDay(page.from));
  const [customTo, setCustomTo] = useState(() => inputDay(page.to - 1));

  const choose = (next: Period | undefined) => {
    setPeriod(next);
    onChange();
  };

  const range =
    period === undefined ? {from: page.from, to: page.to} : periodWindow(period, page.now, customFrom, customTo);

  const control = (
    <PeriodControl
      period={period ?? page.period}
      customFrom={period === undefined ? inputDay(page.from) : customFrom}
      customTo={period === undefined ? inputDay(page.to - 1) : customTo}
      earliest={page.earliest}
      now={page.now}
      onPeriodChange={(next) => {
        // Custom opened from the page's period starts on the page's dates, not on
        // whatever the dates were when the table first mounted.
        if (next === 'custom' && period === undefined) {
          setCustomFrom(inputDay(page.from));
          setCustomTo(inputDay(page.to - 1));
        }
        choose(next);
      }}
      onCustomChange={(nextFrom, nextTo) => {
        setCustomFrom(nextFrom);
        setCustomTo(nextTo);
        choose('custom');
      }}
    />
  );

  const chip: Chip | undefined =
    period === undefined
      ? undefined
      : {
          key: 'period',
          label: `${chipLabel} ${period === 'custom' ? rangeLabel(customFrom, customTo) : PERIOD_LABEL[period]}`,
          clear: () => choose(undefined),
        };

  /** `this period`, `the last 7 days` — for the count and the empty state. */
  const phrase = period === undefined ? 'this period' : IN[period];

  return {range, control, chip, phrase};
};
