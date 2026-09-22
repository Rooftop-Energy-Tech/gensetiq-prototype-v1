import {useState} from 'react';

import type {LinkProps} from '@tanstack/react-router';

import type {Genset} from '../../types/genset.type';
import type {ControlMode} from '../../types/telemetry.type';
import {serviceHeadline} from '../../types/service.type';
import type {GensetDetail} from '../../data/detail';
import {useServiceStatus} from '../../data/services';
import {fuelRemainingHeadline} from '../../types/fuelLevel.type';
import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {amount, fuelHeadline} from '@/lib/format';
import {TrendPanel} from '@/modules/site/components/TrendPanel';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {keepFrom} from '@/modules/site/types/fromSearch.type';
import {countBySeverity} from '../../types/alert.type';
import {plantAlarmQueue} from '../../data/assertedAlarms';
import {standingAlarms, useAlarmHandling} from '../../data/alarms';
import {ControlPad} from './ControlPad';
import {FuelColumn, GeneratorColumns} from './GeneratorColumns';
import {CurrentRunCard} from './CurrentRunCard';
import {StandbyPanel} from './StandbyPanel';

/**
 * The genset's home page, in the bands the design stacks — the same bands, in the
 * same order, as a site's, a system's and a bank's.
 *
 * 1. **The strip** — the tank, its runway, service, and the alarm counts.
 * 2. **The dials** — the controls and the live readings.
 * 3. **The run and the tank** — one start's totals, and when the tank needs
 *    filling.
 * 4. **The chart** — diesel output, with a day stepper and a period control.
 * 5. **The details** — which machine this is and what size it is, in a narrow
 *    block between two rules.
 *
 * There was a sixth: **what is wrong** — the alerts and the readings behind them.
 * It is on the `Alarms` tab now, with the standing and cleared tables it was
 * repeating the subject of. The argument is the one the site page already made
 * about its device stack: a band that restates the page's alarm counts nine
 * hundred pixels below them is a second answer to a question the strip has
 * already answered, and the reader who wants the detail wants the log beside it.
 * The strip's alarm pill is the one click from here to there.
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
export const GensetHome = ({genset, detail}: {genset: Genset; detail: GensetDetail}) => {
  /**
   * Control mode is the one thing on this page a person can change, and it lives
   * in component state rather than the URL — unlike the alert filter, which went
   * to the Alarms tab with the band it filtered.
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

  /**
   * One subscription for both alarm sources on this page.
   *
   * Clearing a row on the Alarms tab has to drop it from band 1's counts on the way
   * back, without a reload. Read once here rather than inside each consumer: the
   * strip's two sources are claims about the same store, and two subscriptions is
   * how they end up a render apart.
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
   * The thresholds band that used to sit at the foot of this page was deliberately
   * **not** given these rows, and it still is not — it has moved to the Alarms tab,
   * where the tables beside it list them. Every card in that band prints the
   * register, the reading and the line the reading crossed, and this prototype has
   * read none of these registers, so there is no reading to draw.
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
        /* The pill opens this asset's own Alarms tab — the tab the count is read
           from, so the figure and the queue behind it cannot be two lists.
           `keepFrom` carries `from` across, which is what keeps a set
           opened from a site crumbing back to that site rather than springing to
           its register. See `fromSearch.type.ts`. */
        alarmLink={{
          to: '/gensets/$gensetId/alarms',
          params: {gensetId: genset.id},
          search: keepFrom as unknown as LinkProps['search'],
        }}
      />

      {/* Band 2 — the tank, and the controls.

          What a reader acts on. The two cards of figures that stood here until
          2026-09-22 are one band down now: a reader arrives asking what the machine
          is doing, which the title's run state and the tank answer in a line each,
          and only then asks for the figures behind it. The pad came up with the
          swap — the page's one interactive thing should not sit below two cards of
          readings.

          `items-stretch` so the card and the pad share a bottom edge, `gap-4`
          because the card carries its own border and the border is already doing
          the separating. */}
      <div className="flex flex-wrap items-stretch gap-4 py-4">
        {/* Fuel first, and outside the branch on both counts.

            **Leftmost** because it is the column that is always there. The two
            beside it describe a machine in motion and are replaced by the standby
            panel when it stops; a band whose first column changes identity with the
            run state gives a reader a different page to learn twice. Reading order
            also happens to be decision order here — how much is left, then how hard
            it is working, then what it is putting out.

            **Outside the branch** because the tank does not vanish with the engine.
            On a standby estate a stopped set is exactly when its level is the page's
            most useful fact: what is in it now is what the next outage gets. */}
        <FuelColumn genset={genset} detail={detail} running={running} />

        {/* The run, between the tank and the controls. Three things a reader takes
            in before any figure: how much is left, what this start has done, and
            what they can do about it. The card carries its own border, so it sits
            in the band beside the tank card rather than inside a wrapper. */}
        <div className="flex min-w-0 flex-1 items-stretch md:min-w-[420px]">
          <CurrentRunCard run={detail.run} gensetId={genset.id} now={now} />
        </div>

        {/* The pad came up here on 2026-09-22 — Afifah's call. It is the page's one
            interactive thing, and a reader who has come to *do* something should not
            have to scroll past two cards of figures to reach it. */}
        <div className="flex shrink-0 items-center">
          <ControlPad runState={genset.runState} mode={mode} onModeChange={setMode} />
        </div>
      </div>

      <hr className="border-subtle" />

      {/* Band 3 — the figures behind the band above.

          Conditions and output, or the standby panel in their place when the engine
          is stopped. The run card and the tank left this band on 2026-09-22 for the
          one above, which is where a reader looks first; what is left here is what
          they read second.

          A column below `md` rather than a wrapping row. Wrapping is what the desktop
          band wants — two halves that break onto two lines when the window narrows —
          but on a phone both halves *can* squeeze into one line once they are allowed
          to shrink, and the result is two 170px columns with the labels truncated
          away. The two questions are separate; at this width they are separate rows. */}
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-stretch">
        {/* The readings, under the run they belong to. They led the page until
            2026-09-22 and sit here now: a reader arrives asking what the machine is
            doing — which the title's run state, the tank and the run card answer
            above — and only then asks for the figures behind it. */}
        {running ? (
          <GeneratorColumns genset={genset} detail={detail} now={now} />
        ) : (
          <StandbyPanel genset={genset} readings={detail.readings} now={now} />
        )}

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
            : [{label: 'Lorry plate', value: genset.plateNumber}]),
        ]}
      />
    </div>
  );
};
