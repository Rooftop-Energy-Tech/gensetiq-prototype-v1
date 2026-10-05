import {useState} from 'react';

import type {LinkProps} from '@tanstack/react-router';

import {gensetKva} from '../../types/genset.type';
import type {Genset} from '../../types/genset.type';
import type {ControlMode} from '../../types/telemetry.type';
import {serviceHeadline} from '../../types/service.type';
import type {GensetDetail} from '../../data/detail';
import {useServiceStatus} from '../../data/services';
import {fuelRemainingHeadline} from '../../types/fuelLevel.type';
import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {amount, figure, fuelHeadline} from '@/lib/format';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {keepFrom} from '@/modules/site/types/fromSearch.type';
import {ALERT_SEVERITIES, countBySeverity} from '../../types/alert.type';
import type {AlertSeverity} from '../../types/alert.type';
import {plantAlarmQueue} from '../../data/assertedAlarms';
import {appAlarms} from '../../data/alarmViews';
import {standingAlarms, useAlarmHandling} from '../../data/alarms';
import {
  ActivityIcon,
  BatteryChargingIcon,
  ClockIcon,
  GaugeIcon,
  PlugZapIcon,
  ThermometerIcon,
  TruckIcon,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import type {ComponentType, SVGProps} from 'react';

import {gensetTotalsIn} from '@/modules/deployment/data/seed';
import {activePosting} from '@/modules/deployment/data/store';
import {postingEnd} from '@/modules/deployment/types/deployment.type';
import {ControlPad} from './ControlPad';
import {OilCanIcon} from './OilCanIcon';
import {OutputBars} from './OutputBars';
import {PhaseBars} from './PhaseBars';
import {ReadingTile} from './ReadingTile';
import {Column, FuelColumn} from './FuelCard';
import {CurrentRunCard} from './CurrentRunCard';
import {StandbyPanel} from './StandbyPanel';

/**
 * The genset's home page, in four bands:
 *
 * 1. **The strip** — the tank, its runway, service, and the alarm counts.
 * 2. **The run** — the controls (`ControlPad`) and the current run's totals
 *    (`CurrentRunCard`).
 * 3. **The tank and the readings** — the fuel card, `Generator conditions` (the
 *    marks while running, the two hour counters always) and `Generator output`
 *    (running only).
 * 4. **The details** — which machine this is and what size it is (`DetailBand`).
 *
 * A chart band (diesel output, with a day stepper) sat between 3 and 4 until it
 * moved to the Analysis tab.
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
 * whole page rests on. The strip answers *how much is left* — the tank and its
 * runway — so the band under it answers *what is happening now*: the run and the
 * controls that act on it (above the readings since 2026-09-22). The readings and
 * the tank follow.
 *
 * ## Where the activity feed went
 *
 * Nowhere; it is gone. It closed the page as band 7 — a
 * list of things that had already happened, with a text field for adding another
 * — and it was the page's only backwards-looking band, which is why it was last
 * and why nothing above it moves now that it has gone. Its component, its
 * derivation and its note store are still in the module, unreferenced, if it is
 * wanted back. Everything it showed is still owned by a screen of its own: runs
 * on `Runs`, services on `Service`, and deliveries on the tank chart.
 *
 * The dials band is dropped entirely when the engine stops, and `StandbyPanel`
 * takes the two generator cards' place beside the tank. It is not a placeholder:
 * the readings that survive a shutdown are the pre-start ones, and they are what
 * the pad's question — start it? — actually turns on.
 *
 * ## At phone width
 *
 * The bands survive intact and stack, which is the whole reason this page needed no
 * mobile rewrite: **the reading order is already vertical.** The bands are asked in
 * sequence and the rules between them carry that, so a phone gets the same page in
 * the same order with each band's row broken into a column.
 *
 * Every child keeps its designed size: the gauges are 153px and the phase bars
 * 322px, which fit a 390px screen. The control pad takes 20% of band 2 from `md`
 * and the run card 80% (Jeff, 2026-10-05); below `md` the pad is full width. Nothing in band 2
 * needs to shrink or scroll sideways — the pad in particular is four **tap targets**
 * and a control shrunk below a thumb is worse than no reflow at all.
 */
/**
 * A mark per live reading, keyed by the reading's own id.
 *
 * Matched to the reference controller's set rather than chosen freshly: an operator
 * who reads one of these screens all day should not have to learn a second
 * vocabulary here. The oil can is drawn in `OilCanIcon` because Lucide has none;
 * the rest are Lucide's, which the app already uses everywhere else.
 *
 * `GaugeIcon` is the fallback for a reading that gains a dial later without gaining
 * a mark — visibly generic, so it shows up as something to fix rather than passing
 * as a decision.
 */
const READING_ICON: Record<string, LucideIcon | ComponentType<SVGProps<SVGSVGElement>>> = {
  'oil-pressure': OilCanIcon,
  'coolant-temp': ThermometerIcon,
  'battery-voltage': BatteryChargingIcon,
  'active-power': PlugZapIcon,
  frequency: ActivityIcon,
};

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

  // The two counters that ride with the live marks. `engineHours` is the machine's
  // own; `postingHours` is its runtime clipped to the job it is standing on, and is
  // `undefined` where it stands on none — the same totals the deployment's own page
  // reads, so the two cannot disagree.
  const engineHours = detail.readings['engine-hours']?.value;
  // Load as a share of nameplate, for the bar beside the phases. The kW figure is
  // the fact and this is its altitude — 236 kW means nothing until you know whether
  // the machine is rated 300 or 1,250.
  const loadPercent =
    detail.ratedKw > 0 ? Math.round(((detail.loadKw ?? 0) / detail.ratedKw) * 100) : 0;

  // What this run could have produced at full load: the rating over the hours it has
  // actually turned. `1` as a floor so a run a minute old cannot divide by zero and
  // peg the bar at full.
  const runHours =
    (((detail.run.endedAt === null ? now : new Date(detail.run.endedAt).getTime()) -
      new Date(detail.run.startedAt).getTime()) /
      3_600_000) || 0;
  const runCapacityKwh = Math.max(1, Math.round(detail.ratedKw * runHours));
  const posting = activePosting(genset.id, now);
  const postingHours =
    posting === undefined
      ? undefined
      : gensetTotalsIn(
          genset.id,
          new Date(posting.deployment.startsAt).getTime(),
          (() => {
            const end = postingEnd(posting);
            return end === null ? now : new Date(end).getTime();
          })(),
          now,
        ).runtimeHours;

  /**
   * The yard's power role, for the strip. Read live so a site flipped on its
   * settings tab moves the page without a reload — the rule every page here
   * follows. The `siteSeed` beside it went with the fuel-consumption chart on
   * 2026-09-22; nothing else on this page needed the yard itself.
   */
  const role = useSitePowerRole(genset.siteId ?? '');

  // Live, not from `detail` — a service logged in this session has to move the
  // reading in band 3 and drop its service alarm without a reload. Measured
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

  // The worst alarm standing against each reading, so a mark can be coloured by its
  // own subject rather than by the machine's overall state. `standingAlarms` is
  // already the handled-aware list the alarm chips below are counted from, so a red
  // oil mark and a red chip are one fault stated twice rather than two.
  const severityByReading = new Map<string, AlertSeverity>();
  for (const alert of alerts) {
    if (alert.readingKey === null) continue;
    const held = severityByReading.get(alert.readingKey);
    // Worst wins: `ALERT_SEVERITIES` is ordered worst-first, so a lower index is
    // graver and a warning can never overwrite a critical.
    if (held === undefined || ALERT_SEVERITIES.indexOf(alert.severity) < ALERT_SEVERITIES.indexOf(held)) {
      severityByReading.set(alert.readingKey, alert.severity);
    }
  }

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
   * **not** given these rows. It was removed outright on 2026-09-14 (see
   * `GensetAlarms`), and the Alarms tab has only the tables. Every card in that band printed the
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
    // `gap-3` between bands, down from `gap-5` on 2026-09-22. The gap applies on
    // both sides of every rule, so 20px was really 40px of air around a 1px line,
    // and the card bands carried their own `py-4` on top of that — close to 56px
    // between one card's bottom edge and the next card's top. The padding goes with
    // it: the gap is the separation now, stated in one place.
    <div className="flex flex-col gap-3 px-4 pb-24 md:pb-6">
      {/* Band 1 — the three figures that decide whether somebody is sent out.

          Two diesel and one service, and the pairing is the point: the tank says
          how much is there, the runway says when that stops being true, and the
          service counter says whether the same trip has a second job on it. A
          lorry to an interior site is a day and a four-figure sum, so the
          questions this strip answers are the ones that fill it.

          The design's `Generation today` is **gone from here**; output over time is
          the Analysis tab's, where a range picker puts it beside yesterday and the
          week. On its own in a strip it invited a share-of-site
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
            // An em dash on a stopped set, like the fuel card's burn rate and
            // refuel date below it. `fuelRemainingHeadline` phrases a stopped
            // machine as "9 hours of runtime" — runtime it would get if started,
            // which is true and still reads in this strip as time it has left.
            value: running
              ? fuelRemainingHeadline(genset.fuelLitres, detail.fuel, running)
              : '—',
          },
          {label: 'Service', value: serviceHeadline(service)},
        ]}
        // The app's own rows too — the low tank and each service item falling due —
        // as the Alarms tab lists them. See `appAlarms`. `service` above subscribes,
        // so logging a service drops its row from these counts on the way back.
        counts={countBySeverity([...alerts, ...plantStanding, ...appAlarms(genset, handling)])}
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

      {/* Band 2 — the run, and the controls that act on it.

          Above the readings since 2026-09-22 — Afifah's call. A reader arrives
          knowing what they came for: the title says whether the engine is turning
          and what it is carrying, this band says what the current start has done
          and offers the four buttons that change it. The three cards of figures
          below are what you consult once you have looked.

          A column below `md` rather than a wrapping row. Wrapping is what the desktop
          band wants — two halves that break onto two lines when the window narrows —
          but on a phone both halves *can* squeeze into one line once they are allowed
          to shrink, and the result is two 170px columns with the labels truncated
          away. The two questions are separate; at this width they are separate rows. */}
      {/* Under the fuel strip: the 2 × 2 controls at the far left, then the run card
          taking the rest of the row (2026-09-29). The pad had sat at the far right of
          two equal halves, which left a gap wider than either. Both sit flush with
          the strip's edges. On a phone the pad is a full-width 2 × 2 above the run.
          From `md` a grid, 20% to the pad and 80% to the run (Jeff, 2026-10-05); it
          was the pad at a fixed 220px and the run taking the rest. */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,4fr)] md:items-stretch">
        {/* Where the fuel panel stood until 2026-09-22, and first in the row since
            2026-09-29: the controls lead, and the run they act on follows. */}
        <div className="flex min-w-0">
          <ControlPad runState={genset.runState} mode={mode} onModeChange={setMode} />
        </div>
        {/* `min-w-0`: a grid or flex item's automatic minimum is its content's, so
            without it the card's widest line, a timestamp that must not wrap, would
            push the page into a sideways scroll. The 360px floor it had went with the
            20/80 grid (2026-10-05). */}
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2.5 md:flex-row">
          <CurrentRunCard run={detail.run} gensetId={genset.id} now={now} />
        </div>

      </div>

      <hr className="border-subtle" />

      {/* Band 3 — the dials, and the two bar charts under them.

          Back on 2026-09-22 after a week as label/value rows. The argument for
          taking them out still holds for *some* of them — a governor holds 50.0 Hz
          and a needle says nothing a figure does not — but it was applied to the
          whole row, and it should not have been. Oil pressure falling through a run
          and coolant climbing towards its shutdown are movements, and a movement is
          what a dial is for. The cards below keep every figure regardless, so
          nothing here is the only place a reading lives.

          Absent when the engine is stopped: `detail.gauges` and `detail.phases` are
          empty then, and a row of needles pinned at zero says less than one line of
          text saying the engine is off — which is what `StandbyPanel` is, in the
          output card's place. */}
      {/* The tank leads the band, with the live readings to its right. Both halves
          answer "what is it doing right now" — the tank says how long it can keep
          going, the marks say how it is going — and a reader takes the pair in
          together rather than across a rule.

          **Leftmost because it is the half that is always there.** The readings
          vanish with the engine; the tank does not, and a band whose first element
          changed with the run state would give a reader two pages to learn. It is
          the same argument that put the tank first among the cards before them. */}
      {/* Three columns, whatever fills them. A flex row with `flex-1` children
          divides the band between however many cards are present, so a stopped set
          -- which draws two -- stretched the tank to half the page. A grid keeps the
          tank a third wide whether the two generator cards are beside it or not. */}
      <div className="grid items-stretch gap-4 md:grid-cols-3">
        <FuelColumn genset={genset} detail={detail} running={running} />

        {/* The marks in a card of their own, titled like the tank beside them. They
            stood bare on the band until 2026-09-22, which made it read as one carded
            thing next to a loose group of tiles; the heading also gives seven marks
            a name, which they had none of. */}
        {/* Output is running-only from 2026-09-22 — Afifah's call: a stopped set
            drew an Output card holding one sentence. Conditions was too until
            2026-10-05, which took the two hour counters off every idle machine, most
            of the estate; it now stays, holding only the counters while stopped. */}
        <Column title="Generator conditions">
          {/* Two equal columns, each tile centred in its half, so the column lines
              hold down the card; a lone last tile stays in the first (2026-09-29).
              As a left-packed wrap the tiles sat out of line with each other. */}
          <div className="grid grid-cols-2 items-start justify-items-center gap-x-4 gap-y-6 pt-1">
            {running && detail.gauges.map((gauge) => (
              <ReadingTile
                key={gauge.key}
                label={gauge.label}
                value={figure(gauge.value, gauge.precision ?? 0)}
                unit={gauge.unit}
                icon={READING_ICON[gauge.key] ?? GaugeIcon}
                // The dial carried its range on its face. A tile has nowhere for
                // it, so the one reading that is genuinely read against limits
                // rather than as a number keeps them as a note. The other four sit
                // at nominal whenever they are well, and a band under them would
                // be four lines of type saying "still fine".
                note={gauge.key === 'oil-pressure' ? `${gauge.min}–${gauge.max} bar` : undefined}
                severity={severityByReading.get(gauge.key)}
              />
            ))}

            {/* The two hour figures, and they sit **outside** the running gate the
                marks are inside. They are counters rather than live readings:
                a stopped set has run for just as many hours as it had a minute
                before it stopped, and they were the only two things the conditions
                card held that the marks do not. Gating them with the marks would
                have taken them off the page for every idle machine, which is most
                of the estate. */}
            <ReadingTile
              label="Run hours"
              value={engineHours === undefined ? '—' : figure(engineHours)}
              unit="h"
              icon={ClockIcon}
            />
            <ReadingTile
              label="On deployment"
              value={
                postingHours === undefined
                  ? 'Not deployed'
                  : figure(postingHours, 1)
              }
              unit={postingHours === undefined ? undefined : 'h'}
              icon={TruckIcon}
              note={posting?.deployment.reference}
            />
          </div>
        </Column>

        {/* The third card: what is coming out, with the bars that carry a whole
            question each at the bottom of it.

            **Output first, phases last** — Afifah's call, 2026-09-22. The five
            output lines are five separate readings and are scanned; line voltage and
            phase current are two sets of three asked whether they agree with one
            another, which is a comparison rather than a scan. A comparison reads
            fine at the foot of a card; five readings buried under six bars do not. */}
        {running && (
        <Column title="Generator output">
            <div className="flex flex-col gap-6 pt-1">
              <OutputBars
                lines={[
                  {label: 'PF', value: detail.readings['power-factor']?.value ?? 0, unit: '', min: 0, max: 1, precision: 2, severity: severityByReading.get('power-factor')},
                  // 45–55 rather than 0–55: a 0-based bar sits at 91% for every
                  // healthy set and moves a pixel on the 2 Hz droop it exists to show.
                  {label: 'Freq', value: detail.readings['frequency']?.value ?? 0, unit: 'Hz', min: 45, max: 55, precision: 1, severity: severityByReading.get('frequency')},
                  {label: 'Load', value: loadPercent, unit: '%', min: 0, max: 100, severity: severityByReading.get('active-power')},
                  {label: 'Power', value: detail.loadKw ?? 0, unit: 'kW', min: 0, max: Math.round(detail.ratedKw), severity: severityByReading.get('active-power')},
                  // Energy has no nameplate to sit against, so its ceiling is what
                  // this run *could* have made: the machine's rating over the hours
                  // it has turned. The bar then reads as the run's load factor.
                  {label: 'Energy', value: detail.run.energyProducedKwh, unit: 'kWh', min: 0, max: runCapacityKwh},
                ]}
              />

              {detail.phases.map((group) => (
                <PhaseBars key={group.label} group={group} severities={severityByReading} />
              ))}
            </div>
        </Column>
        )}

        {/* In the two cards' place rather than a rule below them. A stopped set's
            band is the tank and this: what is in it, and whether the bank will turn
            it over. */}
        {!running && <StandbyPanel genset={genset} readings={detail.readings} now={now} />}
      </div>

      <hr className="border-subtle" />

      {/* Band 4 — what the machine is, in the `DetailBand`, and last of the bands:
          it describes the machine rather than reporting on it.

          Last, which is the order the detail pages kept: nothing in this band changes between one visit and the
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
          otherwise only behind the rail's info hover. It reads in kVA, as the
          nameplate and the fleet list state it, under the label `Rating` every
          detail panel uses (2026-10-05; it was `Rated capacity` in kW).

          `Tank capacity` has **gone from this band**, and not because it stopped
          mattering: it is already stated as `Tank capacity` in the fuel panel one
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
          // The plate first, which is also its lorry's since the set is bolted to
          // one. The serial after it: it is on the nameplate, and nobody in the yard
          // says it.
          ...(genset.plateNumber === null
            ? []
            : [{label: 'Number plate', value: genset.plateNumber}]),
          {label: 'Asset tag', value: genset.tag},
          {label: 'Make and model', value: genset.model},
          {label: 'Rating', value: amount(gensetKva(genset), 'kVA')},
        ]}
      />
    </div>
  );
};
