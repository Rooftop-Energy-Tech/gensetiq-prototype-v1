import {useMemo, useState} from 'react';

import {relativeTime} from '@/lib/format';
import {PLOTTABLE_READING_KEYS} from '../../../data/detail';
import type {GensetDetail} from '../../../data/detail';
import {gensetRuns, historyStart, readingSeries, runsInWindow} from '../../../data/history';
import type {Genset} from '../../../types/genset.type';
import {hasData} from '../../../types/series.type';
import type {ReadingSeries} from '../../../types/series.type';
import type {Reading} from '../../../types/telemetry.type';
import {
  analysisRange,
  clearedRange,
  selectedKeys,
  toggleKey,
} from '../../../types/analysisView.type';
import type {AnalysisSearch, AnalysisWindow} from '../../../types/analysisView.type';
import {RangePicker} from './RangePicker';
import {SeriesPicker} from './SeriesPicker';
import {TimeSeriesChart} from './TimeSeriesChart';

/**
 * The genset's analysis tab: two readings, one window, one chart.
 *
 * The home page answers "what is this machine doing"; this one answers "what has
 * it been doing", and the difference is not a matter of showing more numbers. A
 * snapshot is a verdict — 103 °C is either past the limit or it isn't. A trace is
 * an argument: it shows the coolant climbing for two hours before the alarm, or
 * jumping in a minute, and those are different faults with the same reading.
 *
 * Two series at a time, on two axes. The cap is not a simplification — it is what
 * makes the axes honest. Readings have incompatible units, and the moment a third
 * arrives either two of them share a scale that fits neither, or every value gets
 * normalised to a percentage of its own range and the numbers stop being numbers.
 * Two is what a pair of axes can label truthfully.
 */
export const GensetAnalysis = ({
  genset,
  detail,
  search,
  onSearchChange,
}: {
  genset: Genset;
  detail: GensetDetail;
  search: AnalysisSearch;
  onSearchChange: (search: AnalysisSearch) => void;
}) => {
  // One clock reading for the page. The window, the run log and every series are
  // measured from it, so the right-hand edge of the chart is the same instant as
  // the "now" the run list is describing.
  const [now] = useState(() => Date.now());

  const runs = useMemo(() => gensetRuns(genset.id), [genset.id]);
  const keys = selectedKeys(search);
  const earliest = historyStart();
  const range = analysisRange(search, runs, now, earliest);

  const readings: Array<Reading> = PLOTTABLE_READING_KEYS.map(
    (key) => detail.readings[key],
  ).filter((reading): reading is Reading => reading !== undefined);

  const series = useMemo(
    () =>
      keys
        .map((key) => readingSeries(genset.id, key, range.from, range.to, now))
        .filter((one): one is ReadingSeries => one !== undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keys` is derived
    // from `search.keys`; depending on the array itself would rebuild every
    // render, since `selectedKeys` returns a new one each time.
    [genset.id, search.keys, range.from, range.to, now],
  );

  const drawn = series.filter(hasData);
  const shading = runsInWindow(genset.id, range.from, range.to);

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-6">
      {/* The design puts both controls on one row above the plot, the readings on
          the left and the window on the right. It is the right split: you choose
          what to look at far more often than how far back. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <SeriesPicker
          readings={readings}
          selected={keys}
          onToggle={(key) => onSearchChange(toggleKey(search, key))}
        />

        <RangePicker
          window={search.window}
          range={range}
          runs={runs}
          customFrom={search.from}
          customTo={search.to}
          earliest={earliest}
          now={now}
          // Each selector clears the other two. They are three answers to one
          // question and `analysisRange` gives run precedence over custom over
          // preset — so a control that left the others standing would appear to
          // do nothing at all.
          onWindowChange={(window: AnalysisWindow) =>
            onSearchChange({...clearedRange(search), window})
          }
          onRunChange={(run) => onSearchChange({...clearedRange(search), run})}
          onCustomChange={(from, to) => onSearchChange({...clearedRange(search), from, to})}
        />
      </div>

      <div className="flex min-h-[360px] flex-1 flex-col rounded-xl border border-subtle bg-element p-3">
        {drawn.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="max-w-sm text-center text-sm text-secondary">
              {series.length === 0
                ? 'Nothing to plot. Those readings are counters or window totals rather than trends — pick another.'
                : genset.runState === 'OFFLINE'
                  ? `No readings in this window. This panel stopped reporting ${relativeTime(genset.lastUpdated, now)}.`
                  : 'No readings in this window. The engine did not turn, and these readings only exist while it does.'}
            </p>
          </div>
        ) : (
          <TimeSeriesChart
            series={drawn}
            runs={shading}
            from={range.from}
            to={range.to}
          />
        )}
      </div>

      {/* Only alongside a chart. It is a legend, and a legend under an empty
          panel is an explanation of marks the reader cannot see. */}
      {drawn.length > 0 && (
        <p className="text-xs text-tertiary">
          Shaded bands are runs — the engine turning. A broken trace is a reading
          that did not exist, not a reading of zero.
        </p>
      )}
    </div>
  );
};
