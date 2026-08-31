import {useMemo, useState} from 'react';

import {relativeTime} from '@/lib/format';
import {SeriesPicker} from '@/modules/genset/components/detail/analysis/SeriesPicker';
import {TickGauge} from '@/modules/genset/components/detail/TickGauge';
import {TimeSeriesChart} from '@/modules/genset/components/detail/analysis/TimeSeriesChart';
import {hasData} from '@/modules/genset/types/series.type';
import type {ReadingSeries} from '@/modules/genset/types/series.type';
import {inverterDetail} from '../../../data/inverterDetail';
import {inverterReadingSeries} from '../../../data/inverterSeries';
import {alertsForInverter} from '../../../data/systemHealth';
import {systemCondition} from '../../../types/health.type';
import type {SystemAlert} from '../../../types/health.type';
import type {Inverter, InverterControlMode, SolarSystem} from '../../../types/system.type';
import {TRACE_WINDOW_MS, selectedKeys, toggleKey, traceWindow} from '../../../types/analysisView.type';
import type {InverterTraceSearch} from '../../../types/analysisView.type';
import {SystemHealth} from '../SystemHealth';
import {InverterControlPad} from './InverterControlPad';
import {StringBars} from './StringBars';
import {TraceRangeTabs} from './TraceRangeTabs';

/**
 * One inverter's page — **everything that is actually the box's.**
 *
 * ## Why this page exists
 *
 * Because the readings do. A PV system's dials, its strings, its control pad and
 * its trace all belong to a specific inverter, and the previous model put them on
 * a page about "the array", which is the half of a system that has no electronics
 * and reports nothing. That worked only while every system had exactly one box.
 *
 * The three bands are the genset home page's second, third and fourth, scoped to
 * a machine that really does have one of each:
 *
 *  1. **What can I do, and what is it doing right now.** The pad, the dials, the
 *     strings. All of it instantaneous, and all of it gone at night.
 *  2. **What is wrong with this box**, and the readings behind it — its own
 *     alerts, filtered out of the system's set, so a technician sent here is not
 *     reading about a wash that is overdue on the far side of the roof.
 *  3. **What has it been doing.** The trace: two readings, one window, one chart.
 *
 * Band 1 empties every night, which is why the pad sits before the dials rather
 * than after: at eight in the evening the pad is the only part of that band that
 * still means anything. The empty state says *which* of the two reasons it is
 * empty — night, or a box that has stopped talking — because they call for
 * completely different responses.
 */

/** First light and last, the hours `hybrid.ts` builds every solar day between. */
const FIRST_LIGHT = 7;
const LAST_LIGHT = 19;

export const InverterPage = ({
  system,
  inverter,
  alerts,
  search,
  onSearchChange,
  now,
}: {
  system: SolarSystem;
  inverter: Inverter;
  /** The system's full set — this page filters to the ones that name this box. */
  alerts: Array<SystemAlert>;
  search: InverterTraceSearch;
  onSearchChange: (next: InverterTraceSearch) => void;
  now: number;
}) => {
  /**
   * The one thing on this page a person can change, and it lives in component
   * state rather than the URL — the distinction `GensetHome` draws: a filter
   * describes what you are looking at and a mode describes what the *machine* is
   * set to. A machine setting in a query string looks shareable and reloadable
   * when it is neither. It resets on navigation, which is the honest behaviour
   * for a prototype with no inverter behind it.
   */
  const [mode, setMode] = useState<InverterControlMode>(inverter.controlMode);

  const detail = useMemo(() => inverterDetail(inverter), [inverter]);

  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const daylight = hour >= FIRST_LIGHT && hour <= LAST_LIGHT;
  const live = inverter.state === 'GENERATING';
  const reporting = inverter.state !== 'OFFLINE';

  const mine = alertsForInverter(alerts, inverter.id);

  const window = traceWindow(search);
  const traceFrom = now - TRACE_WINDOW_MS[window];
  const keys = selectedKeys(search);

  // Only the instantaneous readings are trends, and the picker is handed those
  // and nothing else. Every reading on this page happens to be one — the
  // windowed and cumulative figures are the *system's*, and they are on the
  // system's page — which is the reading-ownership split falling out in the UI.
  const plottable = detail.readings.filter((reading) => reading.kind === 'instantaneous');

  const traces = useMemo(
    () =>
      keys
        .map((key) =>
          inverterReadingSeries(system, inverter, detail, mine, key, traceFrom, now, now),
        )
        .filter((one): one is ReadingSeries => one !== undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keys` is derived
    // from `search.keys`; depending on the array itself would rebuild every
    // render, since `selectedKeys` returns a new one each time.
    [system, inverter, detail, mine, search.keys, traceFrom, now],
  );

  const drawn = traces.filter(hasData);

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 md:pb-6">
      {/* Band 1 — the pad, the dials, the strings. */}
      <div className="flex flex-wrap items-start gap-6 pt-2 md:gap-12">
        <InverterControlPad state={inverter.state} mode={mode} onModeChange={setMode} />

        {live ? (
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-start gap-8">
              {detail.gauges.map((gauge) => (
                <TickGauge key={gauge.key} reading={gauge} />
              ))}
            </div>

            <div className="flex flex-wrap items-start gap-y-6 md:gap-x-18">
              <StringBars strings={detail.strings} />
            </div>
          </div>
        ) : (
          <p className="max-w-xs pt-6 text-sm text-secondary">
            {inverter.state === 'OFFLINE'
              ? `No live readings — this inverter has stopped reporting. Last heard from ${relativeTime(inverter.lastUpdated, now)}.`
              : daylight
                ? 'No live readings. There is daylight but this inverter is not delivering.'
                : 'Live readings appear here while there is sun on the modules. It is dark.'}
          </p>
        )}
      </div>

      <hr className="border-subtle" />

      {/* Band 2 — what is wrong with *this box*. The system's own rules — an
          overdue wash, a design never met — stay on the system's page: they are
          not this machine's fault and not this machine's fix. */}
      <SystemHealth
        alerts={mine}
        condition={systemCondition(mine)}
        readings={detail.readings}
        daylight={daylight}
        reporting={reporting}
        lastUpdated={inverter.lastUpdated}
        now={now}
        heading="This inverter's readings"
      />

      <hr className="border-subtle" />

      {/* Band 3 — the trace. */}
      <section aria-label="Readings over time" className="flex min-h-0 flex-1 flex-col gap-3">
        <header className="flex flex-col gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-primary">Readings over time</h3>
            <p className="text-xs text-tertiary">
              Two at a time, one per axis. DC current against DC voltage tells a dead string
              from a shaded one; AC output against temperature catches a box derating itself
              every afternoon
            </p>
          </div>

          {/* Both controls on one row, readings left and window right — the split
              the genset tab makes, and the right one: you choose what to look at
              far more often than how far back. */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <SeriesPicker
              readings={plottable}
              selected={keys}
              onToggle={(key) => onSearchChange(toggleKey(search, key))}
            />
            <TraceRangeTabs
              window={window}
              onWindowChange={(next) => onSearchChange({...search, window: next})}
            />
          </div>
        </header>

        <div className="flex min-h-[360px] flex-1 flex-col rounded-xl border border-subtle bg-element p-3">
          {drawn.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="max-w-sm text-center text-sm text-secondary">
                {traces.length === 0
                  ? 'Nothing to plot. Pick a reading.'
                  : inverter.state === 'OFFLINE'
                    ? 'No readings in this window. This inverter has stopped reporting.'
                    : 'No readings in this window. These quantities only exist while there is sun on the modules.'}
              </p>
            </div>
          ) : (
            // `runs` is empty on purpose. On a genset the shaded bands are runs,
            // which is information the trace does not otherwise carry. An
            // inverter's equivalent would be daylight — and the AC output trace
            // **is** the daylight pattern, drawn. Shading it would print one fact
            // twice, and at 30 days it would be thirty stripes over the thing they
            // were meant to clarify.
            <TimeSeriesChart series={drawn} runs={[]} from={traceFrom} to={now} />
          )}
        </div>

        {drawn.length > 0 && (
          <p className="text-xs text-secondary">
            A broken trace is a reading that did not exist, not a reading of zero — these
            quantities stop at last light and resume at first.
          </p>
        )}
      </section>
    </div>
  );
};
