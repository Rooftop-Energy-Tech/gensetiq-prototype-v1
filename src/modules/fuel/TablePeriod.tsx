import {useState} from 'react';

import {dateRange} from '@/lib/format';
import {RangePicker} from '@/modules/genset/components/detail/analysis/RangePicker';
import {WINDOW_LABELS, analysisRange, parseDateParam} from '@/modules/genset/types/analysisView.type';
import type {AnalysisWindow} from '@/modules/genset/types/analysisView.type';
import type {Chip} from './RegisterTable';
import type {Period} from './PeriodControl';

/**
 * A table's own period, drawn with the genset analysis tab's `RangePicker` — `24
 * hours`, `7 days`, `30 days` and a custom range (2026-10-05), the control the
 * depot page's level chart already used, so the app has one period control rather
 * than two. `By run` is off, as on the depot chart: a fuel table has no engine run
 * to pick. The History table carries one.
 *
 * It opens on 30 days, which is the page's own fixed window, so on arrival a table
 * lists what the figures above it add up. Changed, it holds its own period, for that
 * table alone, and leaves a chip that puts it back to 30 days. Held in the
 * component, not the URL, as the depot chart's is.
 */

/** The page's period, which a table opens on. */
export type PageWindow = {period: Period; from: number; to: number; now: number; earliest: number};

/** The window a table opens on and a cleared chip goes back to — the page's 30 days. */
const DEFAULT_WINDOW: AnalysisWindow = '30d';

/**
 * `chipLabel` names the chip, `When` or `Logged`. `onChange` runs on every
 * change of period, for the table to go back to its first page.
 */
export const useTablePeriod = (page: PageWindow, chipLabel: string, onChange: () => void) => {
  const [window, setWindow] = useState<AnalysisWindow>(DEFAULT_WINDOW);
  const [custom, setCustom] = useState<{from: string; to: string} | undefined>(undefined);

  const range = analysisRange(
    {keys: '', window, run: undefined, dep: undefined, from: custom?.from, to: custom?.to},
    [],
    page.now,
    page.earliest,
  );

  const choose = (nextWindow: AnalysisWindow, nextCustom: {from: string; to: string} | undefined) => {
    setWindow(nextWindow);
    setCustom(nextCustom);
    onChange();
  };

  const control = (
    <RangePicker
      window={window}
      range={range}
      runs={[]}
      customFrom={custom?.from}
      customTo={custom?.to}
      earliest={page.earliest}
      now={page.now}
      onWindowChange={(next) => choose(next, undefined)}
      onRunChange={() => undefined}
      onCustomChange={(from, to) => choose(window, {from, to})}
      showRuns={false}
    />
  );

  // The custom range named by the days picked, as the picker's own button names it —
  // not by `range.to`, which is the exclusive midnight after the last day.
  const fromMs = parseDateParam(custom?.from);
  const toMs = parseDateParam(custom?.to);
  const isCustom = range.kind === 'custom' && fromMs !== undefined && toMs !== undefined;
  const customLabel = isCustom ? dateRange(Math.min(fromMs, toMs), Math.max(fromMs, toMs)) : undefined;

  /** `last 30 days`, `last 24 hours`, or the custom dates — the cards' pill. */
  const label = customLabel ?? `last ${WINDOW_LABELS[window]}`;

  const chip: Chip | undefined =
    customLabel === undefined && window === DEFAULT_WINDOW
      ? undefined
      : {
          key: 'period',
          label: `${chipLabel} ${customLabel ?? WINDOW_LABELS[window]}`,
          clear: () => choose(DEFAULT_WINDOW, undefined),
        };

  /** `the last 30 days`, `this range` — for the count and the empty state. */
  const phrase = customLabel === undefined ? `the ${label}` : 'this range';

  return {range, control, chip, label, phrase};
};
