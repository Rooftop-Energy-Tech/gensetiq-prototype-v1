import {useState} from 'react';

import type {Genset} from '../../types/genset.type';
import type {ControlMode} from '../../types/telemetry.type';
import type {AlertFocus} from '../../types/detailView.type';
import type {GensetDetail} from '../../data/detail';
import {AlertsSection} from './AlertsSection';
import {ControlPad} from './ControlPad';
import {CurrentRunCard} from './CurrentRunCard';
import {FuelPanel} from './FuelPanel';
import {PhaseBars} from './PhaseBars';
import {PowerFlowDiagram} from './PowerFlowDiagram';
import {RunStateSummary} from './RunStateSummary';
import {TickGauge} from './TickGauge';

/**
 * The genset's home page — three bands, separated by rules.
 *
 * The order is the order the questions get asked, and it is worth stating because
 * it is the one design decision the whole page rests on:
 *
 *  1. **What is it doing, and how long for.** Run state, load, and the run's three
 *     totals; the tank and when it needs filling. Everything here is cumulative
 *     or slow-moving — it is still true if you looked away for an hour.
 *  2. **What can I do, and what is it doing right now.** The controls, the
 *     single-line diagram they act on, and the live dials. Everything here is
 *     instantaneous and only exists while the engine turns.
 *  3. **What is wrong.** Alerts, and the readings behind them.
 *
 * Bands 1 and 3 are always populated. Band 2 empties out when the engine stops,
 * which is why the gauges sit *after* the controls rather than before: the
 * controls are the part of that band that still matters on a stopped set.
 */
export const GensetHome = ({
  genset,
  detail,
  focus,
  onFocusChange,
}: {
  genset: Genset;
  detail: GensetDetail;
  focus: AlertFocus;
  onFocusChange: (focus: AlertFocus) => void;
}) => {
  /**
   * Control mode is the one thing on this page a person can change, and it lives
   * in component state rather than the URL — unlike the alert filter.
   *
   * The difference is that a filter describes what you are *looking at* and a
   * mode describes what the *machine* is set to. Putting a machine setting in a
   * query string would make it look shareable and reloadable when it is neither;
   * here it resets on navigation, which is the honest behaviour for a prototype
   * with no controller behind it.
   */
  const [mode, setMode] = useState<ControlMode>(detail.controlMode);

  // One clock reading for the whole page, so the run's stamps and its elapsed
  // time cannot land either side of a minute boundary and disagree.
  const [now] = useState(() => Date.now());

  const running = genset.runState === 'RUNNING';

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      {/* Band 1 — the run and the tank. */}
      <div className="flex flex-wrap items-stretch gap-6">
        <div className="flex min-w-[560px] flex-1 items-center gap-2.5 p-3">
          <RunStateSummary runState={genset.runState} loadKw={detail.loadKw} />
          <CurrentRunCard run={detail.run} gensetId={genset.id} now={now} />
        </div>

        <FuelPanel genset={genset} fuel={detail.fuel} running={running} />
      </div>

      <hr className="border-subtle" />

      {/* Band 2 — controls, the circuit they act on, and the live dials. */}
      <div className="flex flex-wrap items-start gap-12 py-4">
        <div className="flex shrink-0 items-center gap-8 rounded-xl">
          <PowerFlowDiagram live={running} />
          <ControlPad runState={genset.runState} mode={mode} onModeChange={setMode} />
        </div>

        {running ? (
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-start gap-8">
              {detail.gauges.map((gauge) => (
                <TickGauge key={gauge.key} reading={gauge} />
              ))}
            </div>

            <div className="flex flex-wrap items-start gap-x-18 gap-y-6">
              {detail.phases.map((group) => (
                <PhaseBars key={group.label} group={group} />
              ))}
            </div>
          </div>
        ) : (
          <p className="max-w-xs pt-6 text-sm text-secondary">
            {detail.online
              ? 'Live readings appear here while the engine is turning. This genset is stopped.'
              : 'No live readings — this controller has stopped reporting.'}
          </p>
        )}
      </div>

      <hr className="border-subtle" />

      {/* Band 3 — thresholds and the numbers behind them. */}
      <AlertsSection detail={detail} focus={focus} onFocusChange={onFocusChange} />
    </div>
  );
};
