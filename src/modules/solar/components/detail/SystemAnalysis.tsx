import {useMemo} from 'react';

import {cn} from '@/lib/utils';
import {cumulative} from '@/modules/site/data/hybrid';
import {SolarCumulativeChart} from '@/modules/site/components/SolarCumulativeChart';
import {SolarYieldChart} from '@/modules/site/components/SolarYieldChart';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {resolveRange, siteSeries} from '../../data/series';
import type {SystemDetail} from '../../data/systemDetail';
import type {SolarSystem} from '../../types/system.type';
import {DEFAULT_SOLAR_RANGE} from '../../types/range.type';
import type {SolarRange} from '../../types/range.type';
import type {SystemAnalysisSearch} from '../../types/analysisView.type';
import {SolarRangeTabs} from '../SolarRangeTabs';

/**
 * The system's analysis tab — **generation against design, over a chosen window.**
 *
 * ## What this tab was promised to be, and what happened to the other half
 *
 * The placeholder it replaces said it: *"Generation over time, and what it should
 * have been. Where a shortfall gets attributed to a cause — soiling, shading, a
 * string down, an inverter derating in the heat — rather than left as a single
 * percentage."*
 *
 * The first half is this page. The bars say *how much*, the cumulative wedge
 * beside them says *since when*, and the caption prices the gap in the diesel a
 * genset burned to cover it.
 *
 * The second half — attribution — used to be a trace of "the array's" readings
 * bolted underneath, and it moved down onto each inverter's page. Not to make
 * room: because an array does not have readings. Every DC current in a monitoring
 * product is one box describing its own terminals, and asking a ten-inverter
 * plant for *the* DC current has no answer. So the attribution path is now three
 * steps that each answer one question — **when** (this chart), **which box**
 * (band 2 of the home page, where a column of shares makes the odd one out
 * obvious), and **why** (that box's own trace).
 *
 * The genset's analysis tab is one section rather than two for a related reason:
 * a genset has no design figure. There is nothing to compare a coolant
 * temperature against except a threshold, and the threshold is already drawn on
 * the chart. A PV system is bought on a simulated number, which gives this page a
 * comparison the genset's cannot have — and, as the Solar report puts it, the
 * whole reason a benchmark is worth holding is that it changes something
 * downstream. Here it decides which box is worth opening.
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

  // The cumulative view reads the **same resolved series** as the bars beside it,
  // so the two are one dataset shown two ways rather than two that agree most of
  // the time. Changing the period moves both.
  const cumulativeSeries = useMemo(() => cumulative(series), [series]);

  const earliest =
    detail.months[0] === undefined ? now : new Date(detail.months[0].at).getTime();

  const shareOfDesign =
    detail.year.expectedKwh > 0
      ? Math.round((detail.year.actualKwh / detail.year.expectedKwh) * 100)
      : 0;

  const faulted = system.inverters.filter((one) => one.downStrings > 0);

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-24 md:pb-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-primary">
            Generated against design
            <span className="text-xs font-normal text-tertiary">{resolved.caption}</span>
          </h2>
          <p className="text-xs text-tertiary">
            {resolved.benchmark
              ? 'Against the P50 this system was bought on. The running month is hatched and counts towards nothing'
              : 'A design P50 is a monthly figure, so a window this short has none to measure against. Generation on its own'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'text-sm tabular-nums',
              detail.year.variance < -0.1 ? 'text-severity-warning' : 'text-secondary',
            )}
          >
            {shareOfDesign}% of design over twelve months
            {detail.year.onsetLabel !== undefined &&
              ` · stepped down in ${detail.year.onsetLabel}`}
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

      {/* Side by side, the pairing `SiteHome` makes: they are the same series
          counted two ways and a reader compares them by looking between them.
          Stacked, the second is below the fold on a laptop and reads as an
          appendix to the first. */}
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2 rounded-md border border-subtle bg-element px-3 py-3">
          <span className="text-sm font-medium text-primary">Per period</span>
          {series.length === 0 ? (
            <p className="py-10 text-center text-sm text-secondary">
              Nothing generated in this window.
            </p>
          ) : (
            <SolarYieldChart months={series} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 rounded-md border border-subtle bg-element px-3 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium text-primary">Cumulative</span>
            <span className="text-xs text-tertiary">
              {resolved.benchmark ? 'The band is what did not arrive' : 'No design at this grain'}
            </span>
          </div>
          {cumulativeSeries.length === 0 ? (
            <p className="py-10 text-center text-sm text-secondary">
              Nothing generated in this window.
            </p>
          ) : (
            <SolarCumulativeChart points={cumulativeSeries} />
          )}
        </div>
      </div>

      {/* The hand-off, and only where the chart has actually stepped. A permanent
          sentence telling a reader where to go next is furniture; one that appears
          on the systems with a dated fault and names the box carrying it is the
          next step of the job. */}
      {detail.year.onsetLabel !== undefined && faulted.length > 0 && (
        <p className="text-xs text-secondary">
          The step is {system.downStrings} of {system.strings} strings, on{' '}
          {faulted.map((one) => one.label).join(' and ')}. Open{' '}
          {faulted.length === 1 ? 'that inverter' : 'those inverters'} from the home page to see
          the readings behind it.
        </p>
      )}
    </div>
  );
};
