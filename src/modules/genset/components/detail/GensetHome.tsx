import {useState} from 'react';

import type {Genset} from '../../types/genset.type';
import type {ControlMode} from '../../types/telemetry.type';
import type {AlertFocus} from '../../types/detailView.type';
import {serviceHeadline, serviceNotice} from '../../types/service.type';
import type {GensetDetail} from '../../data/detail';
import {useServiceStatus} from '../../data/services';
import {gensetCondition, useFuelIntegrity} from '../../data/fuelIntegrity';
import {fuelLeakNotice} from '../../types/fuelIntegrity.type';
import {fuelLevelNotice, fuelRemainingHeadline} from '../../types/fuelLevel.type';
import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {amount, fuelHeadline} from '@/lib/format';
import {cn} from '@/lib/utils';
import {TrendPanel} from '@/modules/site/components/TrendPanel';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {countBySeverity} from '../../types/alert.type';
import {plantAlarmQueue} from '../../data/assertedAlarms';
import {standingAlarms, useAlarmHandling} from '../../data/alarms';
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
 * 3. **The run and the tank** — one start's totals, and when the tank needs
 *    filling.
 * 4. **The details** — which machine this is and what size it is, in a narrow
 *    block between two rules.
 * 5. **The chart** — diesel output, with a day stepper and a period control.
 * 6. **What is wrong** — alerts, and the readings behind them.
 *
 * ## The order, and what the design changed about it
 *
 * The order is the order the questions get asked, and it is the one decision the
 * whole page rests on. It used to open on the run and the tank and put the dials
 * second; the frame swaps them, and it is right to. The strip above now answers
 * *how much is left* — the tank and its runway — so the first band under it should
 * answer *what is happening this second*, which is the dials. The run's totals are
 * the slower reading of the same subject and follow it.
 *
 * ## Where the activity feed went
 *
 * Nowhere; it is gone, as it is from `/solar`. It closed the page as band 7 — a
 * list of things that had already happened, with a text field for adding another
 * — and it was the page's only backwards-looking band, which is why it was last
 * and why nothing above it moves now that it has gone. Its component, its
 * derivation and its note store are still in the module, unreferenced, if it is
 * wanted back. Everything it showed is still owned by a screen of its own: runs
 * on `Runs`, services on `Service`, and deliveries on the tank chart.
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

  // Live, not from `detail` — a service logged in this session has to move the
  // reading in band 3 and clear the overdue notice without a reload. Measured
  // against the same `now` as everything else on the page.
  const service = useServiceStatus(genset.id, now);

  // Live for the same reason: switching the alarm off, or moving its threshold,
  // has to change band 1's verdict and band 3's list without a reload.
  const integrity = useFuelIntegrity(genset.id, now);

  /**
   * One subscription for both alarm sources on this page.
   *
   * Clearing a row on the Alarms tab has to empty it out of band 6 and drop it
   * from band 1's counts on the way back, without a reload. Read once here rather
   * than inside each consumer: the strip's counts and the cards below are claims
   * about the same store, and two subscriptions is how they end up a render apart.
   */
  const handling = useAlarmHandling();

  /** The controller's own bits, still standing — not `detail.alerts`. */
  const alerts = standingAlarms(genset.id, handling);

  /**
   * And the site monitoring unit's rows filed against this set — the nine
   * per-phase AC registers, where the yard has a unit and no utility incomer.
   *
   * The **same call the Alarms tab makes**, which is the whole point of it being a
   * function rather than a filter written twice. The strip said `2` while the tab
   * listed `4`, because the tab merges both devices and the strip only knew about
   * one; a summary that undercounts the page it summarises is worse than no
   * summary, since a reader who trusts it never opens the tab.
   *
   * Band 6 is deliberately **not** given these rows. It is the thresholds band —
   * every card in it prints the register, the reading and the line the reading
   * crossed — and this prototype has read none of those registers, so there is no
   * reading to draw. The footnote under it says so rather than leaving a reader to
   * work out why the strip is ahead of the cards.
   */
  const plantStanding = plantAlarmQueue(
    genset.siteId ?? '',
    role,
    'GENSET',
    handling,
  ).standing;

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 md:pb-6">
      {/* Band 1 — the three figures that decide whether somebody is sent out.

          Two diesel and one service, and the pairing is the point: the tank says
          how much is there, the runway says when that stops being true, and the
          service counter says whether the same trip has a second job on it. A
          lorry to an interior site is a day and a four-figure sum, so the
          questions this strip answers are the ones that fill it.

          The design's `Generation today` is **gone from here** and lives in band
          5's chart, where a day stepper and a period control put it beside
          yesterday and the week. On its own in a strip it invited a share-of-site
          reading this page cannot honestly give — an engine's output may go into a
          battery and come back out tomorrow, so what fraction of *today* it
          carried is a question about the site's day, not the machine's.

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
        counts={countBySeverity([...alerts, ...plantStanding])}
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

      {/* Band 4 — how much this engine has run over time. `TrendPanel` held to the
          one metric this page is about, exactly as the solar and battery pages hold
          it to theirs, and handed **this genset alone** rather than the yard's set:
          the site page's own band is where a reader compares two machines.

          Hours rather than the kilowatts this drew before. A set's output is its
          site's load reflected back — the curve is a rectangle whatever the day
          did — where its hours are the number the estate is actually managed in,
          and the number an abnormal week shows up in. See `gensetHoursIn`.

          Absent at the depot. See the note on `seed` above — an undeployed set has
          no site, and a chart of its runtime would be a flat line claiming a
          measurement nobody took. */}
      {seed !== undefined && (
        <>
          <TrendPanel
            seed={seed}
            role={role}
            gensetIds={[genset.id]}
            metrics={['GENSET']}
            now={now}
            ariaLabel="Genset runtime"
          />

          {/* Inside the condition with the chart it closes. An undeployed set
              draws no trend, and a rule left standing on its own would double the
              one above it. */}
          <hr className="border-subtle" />
        </>
      )}

      {/* Band 5 — what the machine is, in the `DetailBand` all four detail pages
          share, and last of the bands that describe it rather than report on it.

          Under the chart rather than above it, which is the order all four detail
          pages now keep: nothing in this band changes between one visit and the
          next, and it was sitting between the fuel panel and the runtime trend —
          two live bands a reader reads together — with a block of nameplates
          wedged in the middle.

          The frame puts the *site's* `Supply` and `Installed capacity` here, which
          is the site page's own band copied across — a genset page stating how the
          yard is fed would be the machine answering a question about the yard, and
          the rail's back row is one click from the page that does answer it. So
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

      {/* Why band 1 counts more than band 6 shows.

          Stated on the page rather than left as a discrepancy a reader has to
          notice and then distrust. The strip is the total this set is carrying;
          this band is the subset with a reading and a threshold behind it. */}
      {plantStanding.length > 0 && (
        <p className="max-w-prose text-xs text-tertiary">
          The counts above also include {plantStanding.length} AC{' '}
          {plantStanding.length === 1 ? 'alarm' : 'alarms'} asserted by the site's
          monitoring unit, which are not carded here — this band draws each alert
          against the reading and threshold behind it, and those registers have no
          reading. They are listed in full on the Alarms tab.
        </p>
      )}
    </div>
  );
};
