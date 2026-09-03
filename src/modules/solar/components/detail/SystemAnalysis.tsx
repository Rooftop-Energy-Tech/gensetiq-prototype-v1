import {useMemo} from 'react';

import {SolarYieldChart} from '@/modules/site/components/SolarYieldChart';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {amount} from '@/lib/format';
import {resolveRange, siteSeries} from '../../data/series';
import type {SystemDetail} from '../../data/systemDetail';
import type {SolarSystem} from '../../types/system.type';
import {DEFAULT_SOLAR_RANGE} from '../../types/range.type';
import type {SolarRange} from '../../types/range.type';
import type {SystemAnalysisSearch} from '../../types/analysisView.type';
import {SolarRangeTabs} from '../SolarRangeTabs';

/**
 * The system's analysis tab — **generation over a chosen window.**
 *
 * ## What this tab is, now that it is one chart
 *
 * It was two charts: bars per bucket, and the same series added up beside them.
 * The second existed to make a small persistent gap visible across a period, and
 * without a figure to hold the series against it was an integral of the bars
 * drawn next to the bars.
 *
 * So the tab is the bars, over whatever window the reader picks, and the window
 * lives in the query string so "look at the July dip" is a link.
 *
 * ## Attribution is still three steps
 *
 * The placeholder this replaced promised generation over time *and* a shortfall
 * pinned to a cause. The second half is not on this page and was never going to
 * be: an array has no readings of its own. Every DC current in a monitoring
 * product is one box describing its own terminals, and asking a ten-inverter
 * plant for *the* DC current has no answer.
 *
 * So the path is **when** (this chart, where a step is a visible drop that stays
 * down), **which box** (`Devices`, where a column of shares makes the odd one out
 * obvious), and **why** (that box's own trace).
 */
export const SystemAnalysis = ({
  system,
  detail,
  search,
  onSearchChange,
  now,
}: {
  system: SolarSystem;
  detail: SystemDetail;
  search: SystemAnalysisSearch;
  onSearchChange: (next: SystemAnalysisSearch) => void;
  now: number;
}) => {
  const seed = siteSeed(system.siteId);
  const range: SolarRange = search.range ?? DEFAULT_SOLAR_RANGE;

  const resolved = useMemo(
    () => resolveRange(range, search.from, search.to, now),
    [range, search.from, search.to, now],
  );

  const series = useMemo(
    () => (seed === undefined ? [] : siteSeries(seed, system.role, resolved, now)),
    [seed, system.role, resolved, now],
  );

  const earliest =
    detail.months[0] === undefined ? now : new Date(detail.months[0].at).getTime();

  /**
   * The window's own total, and the running bucket is left out of it.
   *
   * A part-finished month added into a sum a reader compares with last month's is
   * the one arithmetic mistake this series is prone to, and it is the same reason
   * the bar carrying it is hatched.
   */
  const total = series
    .filter((bucket) => !bucket.inProgress)
    .reduce((sum, bucket) => sum + bucket.actualKwh, 0);

  const faulted = system.inverters.filter((one) => one.downStrings > 0);

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-24 md:pb-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-primary">
            Generated
            <span className="text-xs font-normal text-tertiary">{resolved.caption}</span>
          </h2>
          <p className="text-xs text-tertiary">
            {resolved.grain === 'month' ? 'A bar per month' : 'A bar per day'}. The bucket still
            running is hatched and counts towards nothing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-secondary tabular-nums">
            {amount(total, 'kWh')} over the window
          </span>

          <SolarRangeTabs
            range={range}
            from={search.from}
            to={search.to}
            earliest={earliest}
            now={now}
            onRangeChange={(next) =>
              onSearchChange({...search, range: next, from: undefined, to: undefined})
            }
            onCustomChange={(from, to) => onSearchChange({...search, range: 'custom', from, to})}
          />
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-2 rounded-md border border-subtle bg-element px-3 py-3">
        {series.length === 0 ? (
          <p className="py-10 text-center text-sm text-secondary">
            Nothing generated in this window.
          </p>
        ) : (
          <SolarYieldChart months={series} />
        )}
      </div>

      {/* The hand-off, and only where the array has actually stepped. A permanent
          sentence telling a reader where to go next is furniture; one that appears
          on the systems with a dated fault and names the box carrying it is the
          next step of the job. */}
      {detail.stepLabel !== undefined && faulted.length > 0 && (
        <p className="text-xs text-secondary">
          Output stepped down in {detail.stepLabel} and has stayed there: {system.downStrings} of{' '}
          {system.strings} strings, on {faulted.map((one) => one.label).join(' and ')}. Open{' '}
          {faulted.length === 1 ? 'that inverter' : 'those inverters'} from Devices to see the
          readings behind it.
        </p>
      )}
    </div>
  );
};
