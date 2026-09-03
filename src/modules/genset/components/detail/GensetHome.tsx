import {useState} from 'react';
import type {FormEvent} from 'react';

import type {Genset} from '../../types/genset.type';
import type {ControlMode} from '../../types/telemetry.type';
import type {AlertFocus} from '../../types/detailView.type';
import {serviceHeadline, serviceNotice} from '../../types/service.type';
import type {GensetDetail} from '../../data/detail';
import {useServiceRecords, useServiceStatus} from '../../data/services';
import {gensetCondition, useFuelIntegrity} from '../../data/fuelIntegrity';
import {fuelLeakNotice} from '../../types/fuelIntegrity.type';
import {fuelLevelNotice, fuelRemainingHeadline} from '../../types/fuelLevel.type';
import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {amount, fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {TrendPanel} from '@/modules/site/components/TrendPanel';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {useSession} from '@/modules/auth/session';
import {countBySeverity} from '../../types/alert.type';
import {standingAlarms, useAlarmHandling} from '../../data/alarms';
import {runTotalsIn} from '../../data/history';
import {addActivityNote, gensetActivityLog, useActivityNotes} from '../../data/activity';
import {ActivityFeed} from '../ActivityFeed';
import {AlertsSection} from './AlertsSection';
import {ControlPad} from './ControlPad';
import {CurrentRunCard} from './CurrentRunCard';
import {FuelPanel} from './FuelPanel';
import {PhaseBars} from './PhaseBars';
import {RunStateSummary} from './RunStateSummary';
import {StandbyPanel} from './StandbyPanel';
import {TickGauge} from './TickGauge';

/**
 * The genset's home page, in the bands the design stacks — the same bands, in the
 * same order, as a site's, a system's and a bank's.
 *
 * 1. **The strip** — the tank, its runway, service, and the alarm counts.
 * 2. **The dials** — the controls and the live readings.
 * 3. **The run, the day and the tank** — one start's totals, all of today's, and
 *    when the tank needs filling.
 * 4. **The details** — which machine this is and what size it is, in a narrow
 *    block between two rules.
 * 5. **The chart** — diesel output, with a day stepper and a period control.
 * 6. **What is wrong** — alerts, and the readings behind them.
 * 7. **What has happened** — the feed, newest first.
 *
 * ## The order, and what the design changed about it
 *
 * The order is the order the questions get asked, and it is the one decision the
 * whole page rests on. It used to open on the run and the tank and put the dials
 * second; the frame swaps them, and it is right to. The strip above now answers
 * *how much* — today's energy and the tank — so the first band under it should
 * answer *what is happening this second*, which is the dials. The run's totals are
 * the slower reading of the same subject and follow it.
 *
 * Band 2 loses its dials when the engine stops, and `StandbyPanel` takes their
 * place beside the pad. It is not a placeholder: the readings that survive a
 * shutdown are the pre-start ones, and they are what the pad's question — start
 * it? — actually turns on.
 *
 * ## At phone width
 *
 * The bands survive intact and stack, which is the whole reason this page needed no
 * mobile rewrite: **the reading order is already vertical.** The bands are asked in
 * sequence and the rules between them carry that, so a phone gets the same page in
 * the same order with each band's row broken into a column.
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

  /**
   * The site this set stands at, for the strip's energy figure and the chart.
   *
   * `undefined` at the depot, and both fall away with it rather than printing
   * zeroes: an undeployed set has made no diesel today because it is not wired to
   * anything, and a chart of its output would be a flat line claiming a
   * measurement. The role is read live so a site flipped on its settings tab moves
   * the chart without a reload — the rule every page in this app follows.
   */
  const seed = genset.siteId === null ? undefined : siteSeed(genset.siteId);
  const role = useSitePowerRole(genset.siteId ?? '');

  /**
   * What this engine has done since midnight — starts, hours, kilowatt-hours and
   * litres, in one reading of the run log.
   *
   * From `runTotalsIn`, which is also what `gensetKwhIn` sums for the chart in band
   * 5, so a run that began before midnight is split between the two days the same
   * way here as it is in the bars below. Two implementations of that split is how a
   * card and the chart under it end up disagreeing about the same morning.
   */
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const today = runTotalsIn(genset.id, startOfToday, now, now);

  // Live, not from `detail` — a service logged in this session has to move the
  // reading in band 3 and clear the overdue notice without a reload. Measured
  // against the same `now` as everything else on the page.
  const service = useServiceStatus(genset.id, now);

  // Live for the same reason: switching the alarm off, or moving its threshold,
  // has to change band 1's verdict and band 3's list without a reload.
  const integrity = useFuelIntegrity(genset.id, now);

  /**
   * The register map's alarms still standing — not `detail.alerts`.
   *
   * Clearing one on the Alarms tab has to empty it out of band 6 and drop it from
   * band 1's counts on the way back, without a reload. Subscribing here rather
   * than inside `AlertsSection` keeps the strip and the section reading one list:
   * the counts above and the cards below are the same claim made twice, and two
   * subscriptions is how they end up a render apart.
   */
  const alerts = standingAlarms(genset.id, useAlarmHandling());

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
      {/* Band 1 — the three figures that decide whether somebody is sent out.

          Two diesel and one service, and the pairing is the point: the tank says
          how much is there, the runway says when that stops being true, and the
          service counter says whether the same trip has a second job on it. A
          lorry to an interior site is a day and a four-figure sum, so the
          questions this strip answers are the ones that fill it.

          The design's `Generation today` is **gone from here** and lives in band
          3's `Today` card with the hours, starts and litres that produced it. On
          its own in a strip it invited a share-of-site reading this page cannot
          honestly give — an engine's output may go into a battery and come back
          out tomorrow, so what fraction of *today* it carried is a question about
          the site's day, not the machine's.

          All three survive a stopped engine, which is what a summary has to do:
          the tank is the tank whether or not the engine is turning, and a set
          sitting idle is exactly the one whose service is quietly going overdue. */}
      <MetricStrip
        ariaLabel="Genset summary"
        metrics={[
          {
            label: 'Fuel level',
            value: fuelHeadline(genset.fuelLitres, genset.fuelCapacityLitres),
          },
          {
            label: 'Fuel remaining',
            value: fuelRemainingHeadline(genset.fuelLitres, detail.fuel, running),
          },
          {label: 'Service', value: serviceHeadline(service)},
        ]}
        counts={countBySeverity(alerts)}
      />

      {/* Band 2 — the live dials, and the controls that act on the circuit
          they read.

          The pad is on the **right** now, which is the frame's arrangement and the
          reverse of what this band used to do. The readings are what the band is
          about and they are what a reader scans; the pad is a thing you reach for
          having decided something, and a control column between the page's edge and
          its own subject was making the dials start a third of the way in.

          `md:ml-auto` rather than `justify-between`: the pad has to stay pinned to
          the right when the dials wrap short, and it has to fall *under* them at
          phone width rather than beside them — four tap targets squeezed next to a
          gauge row is the one thing in this band that must not happen. */}
      <div className="flex flex-wrap items-start gap-6 py-4 md:gap-12">
        {running ? (
          // `md:flex-1` so the readings take the slack and the pad stays beside
          // them: without it this column sizes to five 153px gauges and the pad
          // wraps underneath the phase bars at anything narrower than the design's
          // 1,530px band. Letting the gauge row wrap inside its own column is the
          // right way to lose width — a second row of dials still reads.
          <div className="flex min-w-0 flex-col gap-6 md:flex-1">
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
          <StandbyPanel genset={genset} readings={detail.readings} now={now} />
        )}

        {/* Hard right while the dials are up — that is the frame's arrangement, and
            it is what keeps five gauges and a phase chart from starting a third of
            the way into the band.

            Not when they are down. `StandbyPanel` is a 360px card, and pinning the
            pad opposite it on a 1,530px band strands the two at either end of an
            empty rule with nothing between them. Unpinned, the pad follows the card
            at the band's own gap and the pair reads as one thing: here is why there
            is nothing to show, and here is what you can do about it. */}
        <div className={cn(running && 'md:ml-auto')}>
          <ControlPad runState={genset.runState} mode={mode} onModeChange={setMode} />
        </div>
      </div>

      <hr className="border-subtle" />

      {/* Band 3 — the run, the day, and the tank.

          The run card carries two columns now — this run, and everything since
          midnight — so the band reads at three horizons without gaining a third
          card: what one start did, what the day's starts did together, and how
          many more starts are left in the tank beside them.
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
          <CurrentRunCard run={detail.run} today={today} gensetId={genset.id} now={now} />
        </div>

        <FuelPanel
          genset={genset}
          fuel={detail.fuel}
          running={running}
          integrity={integrity}
        />
      </div>

      <hr className="border-subtle" />

      {/* Band 4 — what the machine is, in the `DetailBand` all four detail pages
          share.

          The frame puts the *site's* `Supply` and `Installed capacity` here, which
          is the site page's own band copied across — a genset page stating how the
          yard is fed would be the machine answering a question about the yard, and
          the rail's back card is one click from the page that does answer it. So
          the band keeps its place and takes this machine's identity instead.

          **Identity, and deliberately nothing else.** Which machine this is, what
          it is, what size it is — the rows a person needs to order a part, brief a
          technician or find it in a yard. Rating is among them because it is also
          the denominator of every load figure in the bands above, and was
          otherwise only behind the rail's info hover.

          `Tank capacity` has **gone from this band**, and not because it stopped
          mattering: it is already stated as `Max capacity` in the fuel panel one
          band up, beside the level it is the denominator of. A figure printed
          twice on one page is a figure a reader has to check against itself.

          What is **not** here is the instrumentation — controller model, register
          numbers, fuel-sensor scaling, whether a tank is one bulk vessel or a day
          tank fed from it. Every one of those is a real question and none of them
          is settled; they belong to whoever wires the ingest up, and a details
          block that guessed would be this prototype asserting facts it has not
          got. */}
      <DetailBand
        ariaLabel="Genset details"
        rows={[
          {label: 'Name', value: genset.tag},
          {label: 'Make and model', value: genset.model},
          {label: 'Rated capacity', value: amount(detail.ratedKw, 'kW')},
          // Only when there is one. Most of the estate is bolted to a plinth and
          // has no plate, and a row reading "—" would present the ordinary case as
          // missing data.
          ...(genset.plateNumber === null
            ? []
            : [{label: 'Number plate', value: genset.plateNumber}]),
        ]}
      />

      <hr className="border-subtle" />

      {/* Band 5 — what this engine has put out over time. `TrendPanel` held to the
          one metric this page is about, exactly as the solar and battery pages hold
          it to theirs, and handed **this genset alone** rather than the yard's set:
          the site page's own band is where a reader compares two machines.

          Absent at the depot. See the note on `seed` above — an undeployed set has
          no site, and a chart of its output would be a flat line claiming a
          measurement nobody took. */}
      {seed !== undefined && (
        <TrendPanel
          seed={seed}
          role={role}
          gensetIds={[genset.id]}
          metrics={['GENSET']}
          now={now}
          ariaLabel="Genset output"
        />
      )}

      {/* Band 6 — thresholds and the numbers behind them. */}
      <AlertsSection
        detail={detail}
        alerts={alerts}
        service={service}
        notice={serviceNotice(genset.id, service)}
        leak={fuelLeakNotice(genset.id, integrity)}
        fuelLevel={fuelLevelNotice(genset)}
        condition={gensetCondition(genset.id, now)}
        focus={focus}
        onFocusChange={onFocusChange}
      />

      <hr className="border-subtle" />

      {/* Band 7 — what the machine has been through, newest first. The same
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
