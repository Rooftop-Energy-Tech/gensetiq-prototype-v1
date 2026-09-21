import {useMemo, useState} from 'react';

import {relativeTime} from '@/lib/format';
import {cn} from '@/lib/utils';
import {gensetPostings} from '@/modules/deployment/data/store';
import {postingEnd} from '@/modules/deployment/types/deployment.type';
import {PLOTTABLE_READING_GROUPS, PLOTTABLE_READING_KEYS} from '../../../data/detail';
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
import {DeploymentPicker} from '../../runs/DeploymentPicker';
import {RangePicker} from './RangePicker';
import {SeriesPicker} from './SeriesPicker';
import {SERIES_SLOTS} from './seriesMeta';
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
  const postings = useMemo(() => gensetPostings(genset.id), [genset.id]);
  /**
   * The postings as plain windows, which is all `analysisRange` needs.
   *
   * Each ends at *this machine's* end rather than the job's: a set collected on day
   * nine of a fortnight has nine days of readings, and drawing the job's full window
   * would put five days of another machine's work behind this one's trace.
   */
  const windows = useMemo(
    () =>
      postings.map((posting) => ({
        id: posting.deployment.id,
        startedAt: posting.deployment.startsAt,
        endedAt: postingEnd(posting),
      })),
    [postings],
  );
  const keys = selectedKeys(search);
  const earliest = historyStart();
  const range = analysisRange(search, runs, now, earliest, windows);

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
          groups={PLOTTABLE_READING_GROUPS}
          selected={keys}
          onToggle={(key) => onSearchChange(toggleKey(search, key))}
        />

        <div className="flex flex-wrap items-center gap-2">
          <RangePicker
            window={search.window}
            range={range}
            runs={runs}
            customFrom={search.from}
            customTo={search.to}
            earliest={earliest}
            now={now}
            // Each selector clears the others. They are alternative answers to one
            // question and `analysisRange` gives run precedence over deployment
            // over custom over preset — so a control that left the others standing
            // would appear to do nothing at all.
            onWindowChange={(window: AnalysisWindow) =>
              onSearchChange({...clearedRange(search), window})
            }
            onRunChange={(run) => onSearchChange({...clearedRange(search), run})}
            onCustomChange={(from, to) => onSearchChange({...clearedRange(search), from, to})}
          />
          <DeploymentPicker
            postings={postings}
            selectedId={range.kind === 'deployment' ? search.dep : undefined}
            onSelect={(dep) => onSearchChange({...clearedRange(search), dep})}
          />
        </div>
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

      {/* The key, centred under the frame — the band's one layout, which every
          chart in the app follows. Only alongside a chart: a legend under an empty
          panel is an explanation of marks the reader cannot see.

          It names the traces as well as the shading now. The picker above says
          which readings are *selected*; this says which colour each one was
          drawn in, which is the only thing tying a trace to its own axis. */}
      {drawn.length > 0 && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            {drawn.map((one, index) => (
              <span key={one.key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'h-0.5 w-3.5 shrink-0 rounded-full',
                    SERIES_SLOTS[index]?.background,
                  )}
                  aria-hidden="true"
                />
                <span className="text-secondary">{one.label}</span>
              </span>
            ))}

            <span className="flex items-center gap-1.5">
              <span
                className="size-3.5 shrink-0 rounded bg-highlight"
                aria-hidden="true"
              />
              <span className="text-secondary">Engine running</span>
            </span>
          </div>

          {/* What no swatch can say. */}
          <p className="text-xs text-tertiary">
            A broken trace is a reading that did not exist, not a reading of zero.
          </p>
        </div>
      )}
    </div>
  );
};
