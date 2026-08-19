import {useState} from 'react';
import type {FormEvent} from 'react';

import type {Genset} from '../../types/genset.type';
import type {ControlMode} from '../../types/telemetry.type';
import type {AlertFocus} from '../../types/detailView.type';
import {serviceNotice} from '../../types/service.type';
import type {GensetDetail} from '../../data/detail';
import {useServiceRecords, useServiceStatus} from '../../data/services';
import {gensetCondition, useFuelIntegrity} from '../../data/fuelIntegrity';
import {fuelLeakNotice} from '../../types/fuelIntegrity.type';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useSession} from '@/modules/auth/session';
import {addActivityNote, gensetActivityLog, useActivityNotes} from '../../data/activity';
import {ActivityFeed} from '../ActivityFeed';
import {AlertsSection} from './AlertsSection';
import {ControlPad} from './ControlPad';
import {CurrentRunCard} from './CurrentRunCard';
import {FuelPanel} from './FuelPanel';
import {PhaseBars} from './PhaseBars';
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
 *  2. **What can I do, and what is it doing right now.** The controls and the live
 *     dials. Everything here is instantaneous and only exists while the engine
 *     turns.
 *  3. **What is wrong.** Alerts, and the readings behind them.
 *
 * Bands 1 and 3 are always populated. Band 2 empties out when the engine stops,
 * which is why the gauges sit *after* the controls rather than before: the
 * controls are the part of that band that still matters on a stopped set.
 *
 * ## At phone width
 *
 * The bands survive intact and stack, which is the whole reason this page needed no
 * mobile rewrite: **the reading order is already vertical.** The three bands are
 * asked in sequence and the rules between them are what carry that, so a phone gets
 * the same page in the same order with each band's row broken into a column.
 *
 * Every child keeps its designed size: the gauges are 153px, the phase bars 322px
 * and the control pad 220px, all of which fit a 390px screen. Nothing in band 2
 * needs to shrink or scroll sideways — the pad in particular is four **tap targets**
 * and a control shrunk below a thumb is worse than no reflow at all.
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

  // Live, not from `detail` — a service logged in this session has to move the
  // reading in band 3 and clear the overdue notice without a reload. Measured
  // against the same `now` as everything else on the page.
  const service = useServiceStatus(genset.id, now);

  // Live for the same reason: switching the alarm off, or moving its threshold,
  // has to change band 1's verdict and band 3's list without a reload.
  const integrity = useFuelIntegrity(genset.id, now);

  // The feed is every record that mentions this machine, merged — controller
  // events, dispatch postings, refuel orders, services and typed notes — the
  // same derivation the fleet page's panel makes, so the two never disagree.
  const records = useServiceRecords();
  const notes = useActivityNotes();
  const activity = gensetActivityLog(genset, records, notes);
  const session = useSession();
  const [noteDraft, setNoteDraft] = useState('');

  const handleLogNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addActivityNote(genset.id, noteDraft, session?.email ?? 'operator');
    setNoteDraft('');
  };

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 md:pb-6">
      {/* Band 1 — the run and the tank.
          A column below `md` rather than a wrapping row. Wrapping is what the desktop
          band wants — two halves that break onto two lines when the window narrows —
          but on a phone both halves *can* squeeze into one line once they are allowed
          to shrink, and the result is two 170px columns with the labels truncated
          away. The two questions are separate; at this width they are separate rows. */}
      <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-stretch">
        {/* The 560px floor is a desktop instruction — "keep the run beside the state
            or wrap the whole band" — and on a 390px screen it is unsatisfiable, so
            it would win over `flex-wrap` and push the page into a sideways scroll.
            `min-w-0` replaces it below `md`: a flex item's automatic minimum is its
            content's, so without it the run card's widest line — a timestamp that
            must not wrap — becomes the floor for the whole band. */}
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2.5 p-3 md:min-w-[560px] md:flex-row md:items-center">
          <RunStateSummary runState={genset.runState} loadKw={detail.loadKw} />
          <CurrentRunCard run={detail.run} gensetId={genset.id} now={now} />
        </div>

        <FuelPanel
          genset={genset}
          fuel={detail.fuel}
          running={running}
          integrity={integrity}
        />
      </div>

      <hr className="border-subtle" />

      {/* Band 2 — controls, the circuit they act on, and the live dials. */}
      <div className="flex flex-wrap items-start gap-6 py-4 md:gap-12">
        <ControlPad runState={genset.runState} mode={mode} onModeChange={setMode} />

        {running ? (
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-start gap-8">
              {detail.gauges.map((gauge) => (
                <TickGauge key={gauge.key} reading={gauge} />
              ))}
            </div>

            <div className="flex flex-wrap items-start gap-y-6 md:gap-x-18">
              {detail.phases.map((group) => (
                <PhaseBars key={group.label} group={group} />
              ))}
            </div>
          </div>
        ) : (
          <p className="max-w-xs pt-6 text-sm text-secondary">
            {genset.runState === 'OFFLINE'
              ? 'No live readings — this panel has stopped reporting.'
              : 'Live readings appear here while the engine is turning. This genset is stopped.'}
          </p>
        )}
      </div>

      <hr className="border-subtle" />

      {/* Band 3 — thresholds and the numbers behind them. */}
      <AlertsSection
        detail={detail}
        service={service}
        notice={serviceNotice(genset.id, service)}
        leak={fuelLeakNotice(genset.id, integrity)}
        condition={gensetCondition(genset.id, now)}
        focus={focus}
        onFocusChange={onFocusChange}
      />

      <hr className="border-subtle" />

      {/* Band 4 — what the machine has been through, newest first. The same
          feed the fleet page's slide-over shows, so an event reads identically
          wherever it is met; here it sits last because it is the page's only
          backwards-looking band. */}
      <section className="flex max-w-xl flex-col gap-3">
        <h3 className="text-sm font-medium text-primary">Activity</h3>
        {/* The feed's manual inlet. Everything else here is derived from a
            record another screen owns; this is the one line an operator types
            — a padlock replaced, a smell of diesel, a gate left open — and it
            files under their own name. */}
        <form onSubmit={handleLogNote} className="flex items-center gap-2">
          <Input
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Log an entry against this genset"
            aria-label="Log an entry against this genset"
            className="h-8"
          />
          <Button type="submit" size="sm" variant="outline" disabled={noteDraft.trim() === ''}>
            Log
          </Button>
        </form>
        <ActivityFeed activity={activity} />
      </section>
    </div>
  );
};
