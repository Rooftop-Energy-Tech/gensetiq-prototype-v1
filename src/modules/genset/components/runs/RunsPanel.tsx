import type {ReactNode} from 'react';
import {Link} from '@tanstack/react-router';
import {DownloadIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {amount, dateRange, duration, stampAt, stampDate} from '@/lib/format';
import {cn} from '@/lib/utils';
import {DEFAULT_ANALYSIS_WINDOW, DEFAULT_KEYS} from '../../types/analysisView.type';
import {runElapsedMs} from '../../types/run.type';
import {runLoadKw} from '../../data/history';
import {gensetDetail} from '../../data/detail';
import type {GensetRun} from '../../types/run.type';
import {countsInRange} from '../../types/runsView.type';
import type {RunRange, RunTotals, RunWindow} from '../../types/runsView.type';
import type {Genset} from '../../types/genset.type';
import {RunsRangeControl} from './RunsRangeControl';
import {RunsTimeline} from './RunsTimeline';
import type {TimelineLane} from './RunsTimeline';

/**
 * The runs tab, for a genset or for a site.
 *
 * Three bands, and the order is the order the questions arrive in: *what has this
 * been doing* (the strip), *how much of it* (the totals), *which runs exactly* (the
 * log). A reader who only wanted the first stops after one glance, which is the
 * point of it being first.
 *
 * One component for both pages rather than two that drift. A site's log differs
 * from a genset's in exactly two ways — its strip has a lane per set and its table
 * an asset column — and both are the same fact: a site log has more than one
 * machine in it. Everything else, including the rules about what a window contains
 * and what the totals cover, is identical, and those are the parts worth having in
 * one place.
 */
export type RunsRow = {run: GensetRun; genset: Genset};

export const RunsPanel = ({
  window,
  range,
  customFrom,
  customTo,
  earliest,
  now,
  lanes,
  rows,
  totals,
  heldCount,
  showAsset,
  energyNote,
  deploymentPicker,
  onWindowChange,
  onCustomChange,
  onExport,
}: {
  window: RunWindow;
  range: RunRange;
  customFrom: string | undefined;
  customTo: string | undefined;
  earliest: number;
  now: number;
  lanes: Array<TimelineLane>;
  rows: Array<RunsRow>;
  totals: RunTotals;
  /** Runs held in total, so an empty window can be told from an empty log. */
  heldCount: number;
  showAsset: boolean;
  /** The site's caveat about whose energy this is. */
  energyNote: string | undefined;
  /**
   * The genset page's by-posting selector, rendered beside the range control.
   * A slot rather than data, because the site's log has no posting to scope by
   * and should not have to say so.
   */
  deploymentPicker?: ReactNode;
  onWindowChange: (window: RunWindow) => void;
  onCustomChange: (from: string, to: string) => void;
  onExport: () => void;
}) => {
  const empty = rows.length === 0;

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <RunsRangeControl
            window={window}
            range={range}
            customFrom={customFrom}
            customTo={customTo}
            earliest={earliest}
            now={now}
            onWindowChange={onWindowChange}
            onCustomChange={onCustomChange}
          />
          {deploymentPicker}
        </div>

        {/* Disabled on an empty window rather than hidden. A control that
            disappears reads as a feature that isn't there; one that is present and
            inert says "nothing to export from *this* window", which is the
            actual state and is fixed by the chips beside it. */}
        <Button variant="outline" size="sm" onClick={onExport} disabled={empty}>
          <DownloadIcon aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {heldCount > 0 && (
        <RunsTimeline lanes={lanes} from={range.from} to={range.to} now={now} />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Completed runs" value={String(totals.completed)} />
        {/* `duration()` renders 0 as "under a minute", which is the right answer
            for a run that has just started and the wrong one for a window where
            nothing ran at all — it claims the engine turned. The other three tiles
            say `0` in their own units; this one should too. */}
        <Metric
          label="Time running"
          value={totals.runtimeMs === 0 ? '0 hours' : duration(totals.runtimeMs)}
        />
        <Metric label="Energy produced" value={amount(totals.energyKwh, 'kWh')} />
        <Metric label="Fuel consumed" value={amount(totals.fuelLitres, 'L')} />
        {/* Fuel efficiency over the window — energy out per litre in. The two
            tiles it is derived from sit beside it, so the arithmetic is
            checkable on sight. */}
        <Metric
          label="Avg SFC"
          value={totals.sfcKwhPerL === null ? '-' : `${totals.sfcKwhPerL.toFixed(2)} kWh/L`}
        />
        {/* Only the genset log carries this — a site's sets differ in nameplate,
            so "of rated" has no single denominator there. */}
        {totals.loadFactor !== null && (
          <Metric label="Avg load factor" value={`${Math.round(totals.loadFactor * 100)}%`} />
        )}
      </div>

      {/* Every qualification on those four figures, stated under them. The span is
          the load-bearing one: without it "204,300 kWh" reads as a lifetime total,
          and the machine has been in service far longer than this log goes back. */}
      <div className="flex flex-col gap-1 text-xs text-secondary">
        <p>Covering {dateRange(range.from, range.to - 1)}.</p>

        {range.requested !== undefined && (
          <p className="text-severity-warning">
            Clamped — this log holds runs from {stampDate(new Date(earliest).toISOString())}{' '}
            onward, and the range you asked for reaches past what is held.
          </p>
        )}

        {totals.open > 0 && (
          <p>
            {totals.open === 1 ? 'One run is' : `${totals.open} runs are`} still turning, listed
            below and excluded from these totals — the figures are still climbing.
          </p>
        )}

        {totals.carriedIn > 0 && (
          <p>
            {totals.carriedIn === 1 ? 'One run was' : `${totals.carriedIn} runs were`} already
            turning when this window opened, listed below and counted by the period{' '}
            {totals.carriedIn === 1 ? 'it' : 'they'} started in.
          </p>
        )}

        {energyNote !== undefined && <p>{energyNote}</p>}
      </div>

      <div className="overflow-hidden rounded-md border border-subtle bg-element">
        {empty ? (
          <p className="px-4 py-10 text-center text-sm text-secondary">
            {heldCount === 0
              ? 'No runs held. This log goes back sixty days and the engine has not turned in that time.'
              : 'The engine did not turn in this window. Try a longer one — the log holds ' +
                `${heldCount} run${heldCount === 1 ? '' : 's'}.`}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-subtle text-xs text-secondary">
                <Th>Started</Th>
                <Th>Ended</Th>
                {showAsset && <Th>Set</Th>}
                <Th align="right">Duration</Th>
                <Th align="right">Avg load</Th>
                <Th align="right">Energy</Th>
                <Th align="right">Fuel</Th>
                <Th align="right">SFC</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map(({run, genset}) => {
                // A row the totals do not claim — still turning, or carried in from
                // before the window. Its figures are dimmed rather than hidden: the
                // run happened and is worth seeing, but a reader adding the column
                // up by eye should be able to tell which rows they are adding.
                const counted = countsInRange(run, range);

                return (
                <tr
                  key={run.id}
                  className="border-b border-subtle last:border-b-0"
                  title={
                    counted
                      ? undefined
                      : run.endedAt === null
                        ? 'Still turning — not totalled until it stops.'
                        : 'Began before this window — totalled in the period it started in.'
                  }
                >
                  <td className="px-3 py-2.5">
                    {/* The stamp is the link, not the row. A run's natural
                        follow-up question is "what did the readings do while it
                        ran", and the analysis tab already answers exactly that
                        for one run — this closes a loop that so far only ran the
                        other way, from that tab's run picker to here. */}
                    <Link
                      to="/gensets/$gensetId/analysis"
                      params={{gensetId: genset.id}}
                      search={{
                        keys: DEFAULT_KEYS,
                        window: DEFAULT_ANALYSIS_WINDOW,
                        run: run.id,
                      }}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {stampAt(run.startedAt)}
                    </Link>
                  </td>

                  <td className="px-3 py-2.5 text-secondary">
                    {run.endedAt === null ? (
                      <span className="text-teal">Running</span>
                    ) : (
                      stampAt(run.endedAt)
                    )}
                  </td>

                  {showAsset && (
                    <td className="px-3 py-2.5">
                      <Link
                        to="/gensets/$gensetId"
                        params={{gensetId: genset.id}}
                        className="text-secondary underline-offset-4 hover:text-primary hover:underline"
                      >
                        {genset.tag}
                      </Link>
                    </td>
                  )}

                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular-nums',
                      counted ? 'text-secondary' : 'text-tertiary',
                    )}
                  >
                    {duration(runElapsedMs(run, now))}
                  </td>
                  {/* The run's average electrical load, and what share of
                      nameplate it worked at. The percentage is the SFC column's
                      explanation: a lightly-loaded run burns more per kWh. */}
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular-nums',
                      counted ? 'text-secondary' : 'text-tertiary',
                    )}
                  >
                    {rowLoad(run, genset, now)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular-nums',
                      counted ? 'text-secondary' : 'text-tertiary',
                    )}
                  >
                    {amount(run.energyProducedKwh, 'kWh')}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular-nums',
                      counted ? 'text-secondary' : 'text-tertiary',
                    )}
                  >
                    {amount(run.fuelConsumedLitres, 'L')}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular-nums',
                      counted ? 'text-secondary' : 'text-tertiary',
                    )}
                  >
                    {run.fuelConsumedLitres > 0
                      ? `${(run.energyProducedKwh / run.fuelConsumedLitres).toFixed(2)} kWh/L`
                      : '-'}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!empty && (
        <p className="text-xs text-secondary">
          Every run turning during this window is listed. The totals claim the ones that{' '}
          <em>started</em> in it and have finished — so a run spanning an edge is counted whole
          by one period rather than split across two. Dimmed figures are the rows that were not
          counted here.
        </p>
      )}
    </div>
  );
};

/**
 * `320 kW · 40%` — the run's average electrical load, and the share of the
 * set's nameplate that is. Falls back to the kW alone when the nameplate
 * cannot be resolved, rather than showing a percentage of nothing.
 */
const rowLoad = (run: GensetRun, genset: Genset, now: number): string => {
  const loadKw = Math.round(runLoadKw(run, now));
  const ratedKw = gensetDetail(genset.id)?.ratedKw;
  if (ratedKw === undefined || ratedKw <= 0) return `${loadKw} kW`;
  return `${loadKw} kW · ${Math.round((loadKw / ratedKw) * 100)}%`;
};

const Metric = ({label, value}: {label: string; value: string}) => (
  <div className="flex flex-col gap-1 rounded-md border border-default bg-element px-3 py-2.5">
    <span className="text-xs text-secondary">{label}</span>
    <span className="text-base font-medium text-primary tabular-nums">{value}</span>
  </div>
);

const Th = ({children, align}: {children: ReactNode; align?: 'right'}) => (
  <th
    scope="col"
    className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
  >
    {children}
  </th>
);
