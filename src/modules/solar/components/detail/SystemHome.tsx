import {MoonIcon} from 'lucide-react';

import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {Badge} from '@/components/ui/badge';
import {amount, stampDate} from '@/lib/format';
import {TickGauge} from '@/modules/genset/components/detail/TickGauge';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {UNHANDLED, isStanding} from '@/modules/genset/types/alarmState.type';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {TrendPanel} from '@/modules/site/components/TrendPanel';
import {junctionBoxes} from '../../data/junctionBoxes';
import {solarAlarmQueue} from '../../data/solarAlarmQueue';
import {systemAlerts} from '../../data/systemHealth';
import {systemCondition} from '../../types/health.type';
import type {SystemDetail} from '../../data/systemDetail';
import type {SolarSystem} from '../../types/system.type';
import {JunctionBoxRack} from './JunctionBoxRack';
import {SystemHealth} from './SystemHealth';

/**
 * A solar system's home page, in the five bands the design stacks — the same
 * bands, in the same order, as a site's and a genset's.
 *
 * 1. **The strip** — solar capacity, what it has made today, and the alarm counts.
 * 2. **The junction boxes** — what the array is putting out right now, broken out a
 *    box at a time, with a `Dark` badge beside the total when the sun is down.
 * 3. **The details** — what the system *is*: three nameplate facts, nothing live.
 * 4. **The chart** — generation, with a day stepper and a period control.
 * 5. **What is wrong** — the rules, and the numbers behind them.
 *
 * ## What changed, and why the old shape went
 *
 * This page used to open on a state hero, a four-row figure card and today's curve
 * side by side, then list the inverters and close on an activity feed. What is left
 * is the design's five bands and nothing else, which is the whole point: an
 * operator moving between a tower's genset, its array and its bank now finds the
 * same things in the same places, and the pages differ only in what they are
 * *about*. Three pages that each invented their own shape was the thing this design
 * set out to fix.
 *
 * The one figure with nowhere to go was the day's own curve, and it did not need
 * one: band 4's `Day` view is that curve, drawn from the same model, with a stepper
 * that reaches yesterday as well — which the old band could not.
 *
 * ## Where the inverters went
 *
 * Nowhere; there are none. This page listed them, then handed them to `Devices`
 * when that section arrived, and the boxes are now gone from the model
 * altogether: these are telco sites, a tower runs a −48 V DC bus and its loads
 * are DC, so the array feeds the bus and there is no AC stage to invert to.
 * `system.type.ts` records what went with them.
 *
 * `Devices` kept its place in the rail and changed subject. It holds the array —
 * the glass, the strings, and how many of them are dark — which is what its own
 * doc comment always said it was missing.
 *
 * ## Where the activity feed went
 *
 * Nowhere; it is gone. Unlike the boxes it was not a door to anything — a list of
 * things that had already happened, with a text field for adding another. Its
 * components and its note store are still in the module, unreferenced, if it is
 * wanted back.
 *
 * ## Nothing on this page is a verdict
 *
 * Every figure here is a measurement or a nameplate. The page reports what the
 * system is and what it made, and it does not hold either up against a target —
 * there is no design figure anywhere in this app to hold them against. The one
 * comparison it does draw is the system against **itself**: band 4's day view
 * carries the array's own recent normal, and band 5's string rule fires on a step
 * in its own series.
 *
 * ## At phone width
 *
 * The bands are already a column, so nothing rearranges, and there is nothing left
 * on the page that cannot reflow.
 */

/** First light and last, the hours `hybrid.ts` builds every solar day between. */
const FIRST_LIGHT = 7;
const LAST_LIGHT = 19;

export const SystemHome = ({
  system,
  detail,
  now,
}: {
  system: SolarSystem;
  detail: SystemDetail;
  now: number;
}) => {
  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const daylight = hour >= FIRST_LIGHT && hour <= LAST_LIGHT;
  const reporting = system.state !== 'OFFLINE';

  const seed = siteSeed(system.siteId);

  /**
   * The array's boxes, or none where nobody has surveyed the roof. Decides which of
   * band 2's two layouts is drawn — see the band.
   */
  const boxes = junctionBoxes(system);

  /**
   * Why the sun is not up, said out loud — and built here rather than in the band so
   * that both of band 2's layouts place the same badge.
   *
   * Without it this is the most misread thing on the page. At nine in the evening every
   * figure in the band reads 0 kW and the state rolls up to `Idle`, which is
   * pixel-for-pixel what a plant that has tripped in the middle of the afternoon looks
   * like — and the health band below raises nothing, because nothing is wrong. A reader
   * who has learned to check this page in a hurry would be checking it at exactly the
   * hour it cannot answer.
   *
   * The bank page puts its flow direction beside its glyph for the same reason: the fact
   * that makes a reading legible belongs beside the reading and not two bands away.
   */
  const darkBadge = daylight ? null : (
    <Badge variant="secondary">
      <MoonIcon className="text-tertiary" aria-hidden="true" />
      Dark
      <span className="text-secondary"> | </span>
      first light {String(FIRST_LIGHT).padStart(2, '0')}:00
    </Badge>
  );

  /**
   * Every alarm this array is carrying — the derived rules **and** the monitoring
   * unit's registers — and it is the same call the Alarms tab makes.
   *
   * That is the whole point of `solarAlarmQueue` existing. The strip used to count
   * `systemHealth`'s rules alone and read `1` while the tab listed `2` off the
   * device; neither number was wrong about its own source, and a reader has no way
   * to know there were two sources. Now band 1 and the tab are one list counted
   * twice.
   *
   * Subscribed once here and handed down, for the reason `GensetHome` does it: the
   * counts above and the cards below are claims about the same store, and two
   * subscriptions is how they end up a render apart.
   */
  const handling = useAlarmHandling();
  const {standing} = solarAlarmQueue(system, detail, now, handling);

  /**
   * Band 5 keeps only the derived rules, because it is the band that draws them.
   *
   * Every card in it prints the reading and the line the reading crossed, and the
   * chart above it marks the same threshold — that is what makes a rule reviewable
   * rather than merely announced. A register on a device nothing has read has no
   * reading to draw and no axis to sit on, so the unit's rows stay on the Alarms
   * tab and the footnote under the band says where they went.
   *
   * Filtered by the same handling as the strip, so clearing a wash from the tab
   * empties the card here too. `condition` is recomputed from what survives rather
   * than taken from `systemHealth` — a verdict of `Attention` over a band with
   * nothing in it is the mismatch this whole file is about, in miniature.
   */
  const derived = systemAlerts(system, detail, now).filter(
    (alert) => isStanding({handling: handling[alert.id] ?? UNHANDLED}),
  );
  const condition = systemCondition(derived);

  /**
   * Today's figures are the plant's, so a system nobody can hear has none.
   *
   * An em dash rather than `0 kWh`, which is a different claim: zero says the
   * system made nothing, and what is actually known is that nobody heard it.
   * `systemDetail` already refuses to publish the model's day here; this is the
   * same refusal said out loud in the cell.
   */
  const generatedToday = reporting
    ? amount(Math.round(detail.today.generatedKwh), 'kWh')
    : '—';

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-3 pb-24 md:pb-6">
      <MetricStrip
        ariaLabel="System summary"
        // The design's two, and both are facts this page can always answer: an
        // array has a capacity whether or not anything is talking to it, and the
        // day's energy says `—` rather than nothing when it is not.
        metrics={[
          {label: 'Solar capacity', value: amount(system.kwp, 'kWp')},
          {label: 'Generation today', value: generatedToday},
        ]}
        counts={countBySeverity(standing)}
      />

      {/* Band 2 — the array's generation, a junction box at a time.

          It was one hero dial reading the whole array. Jeff asked for the strings per
          box and the generation per box (2026-09-09), and `JunctionBoxRack` carries the
          argument for what those cards may and may not claim — the short version being
          that the strings are surveyed and the kilowatts are one measured figure shared
          out, which the caption says on the page.

          The dial survives as the fallback, and it is a real fallback rather than dead
          code: `wiring` is `null` at any site nobody has surveyed, and a box breakdown
          there would be inventing the combiners as well as their readings. Every site
          with an array has a monitoring unit today, so this branch is reached only by a
          reader flipping a site to solar hybrid on its settings tab — which is exactly
          the case a fallback is for.

          The dial's full scale is the array's **nameplate kWp**. It used to be the
          inverters' combined AC rating, on the argument that a
          dial which could never fill reads as a plant permanently underperforming —
          these systems were deliberately oversized to their boxes, so kWp was
          unreachable by design. With no boxes there is no AC rating to scale to, and the
          honest full scale is the glass. The consequence is real and worth knowing: a
          clear noon lands near half way up. */}
      <section aria-label="Generation now" className="flex flex-col gap-3 py-6">
        {boxes.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <TickGauge
              size="hero"
              colorClassName="text-solar"
              reading={{
                key: 'output',
                label: 'Generation',
                value: reporting ? system.outputKw : 0,
                unit: 'kW',
                precision: 1,
                min: 0,
                max: Math.max(1, system.kwp),
              }}
            />
            {darkBadge}
          </div>
        ) : (
          <JunctionBoxRack
            system={system}
            boxes={boxes}
            reporting={reporting}
            /* The page's one read of the alarm store, handed down — so a box marked
               here and the count in band 1 are two readings of one list. Clearing
               `PV 1 Array Fault` on the Alarms tab unmarks SJB 1 on the way back. */
            standing={standing}
            dark={darkBadge}
          />
        )}
      </section>

      <div className="border-t border-subtle" />

      {/* Band 3 — generation over time. `TrendPanel` with one metric, which is the
          site page's diagnostics band held to the only quantity this page is about;
          a picker offering the bank and the genset here would be the register's own
          boundary dissolving. A system whose site has been flipped away from solar
          cannot reach this page at all, so `seed` is only ever missing for an id
          the router already 404s. */}
      {seed !== undefined && (
        <TrendPanel
          seed={seed}
          role={system.role}
          gensetIds={[]}
          metrics={['SOLAR']}
          now={now}
          ariaLabel="Generation"
        />
      )}

      <div className="border-t border-subtle" />

      {/* Band 4 — what the system *is*, in the `DetailBand` all four detail pages
          share. Three nameplate facts and nothing live: this band should read the
          same on a Tuesday morning as it does on a Sunday night — which is why it
          sits *under* the chart on all four of them now, and not between the dial
          and the trend it was separating.

          It was four. `Installed capacity` was the inverters' combined AC rating,
          and it sat beside the kWp deliberately: the ratio between the two was
          what every one of these was specified with, and side by side they
          answered "why does the dial top out below the nameplate". There is no AC
          rating on a telco site and the dial's scale is now the kWp itself, so the
          question and the row that answered it both went. `DetailBand` splits a
          three-row list 2 + 1 and needs no help.

          **`Commissioned` earns its place by dating everything else.** A system
          five years old has given up a few points to the glass simply ageing, and
          a reader comparing this year's chart with last year's needs to know that
          before they go looking for a fault.

          What is deliberately *not* here: the strings and the last wash. Each has
          a section of its own in the rail — `Devices`, `Service` — and restating
          them would make this band a second index of the page. It is a description
          of the system, not a summary of what is under it. */}
      <DetailBand
        ariaLabel="System details"
        rows={[
          {label: 'System capacity', value: amount(system.kwp, 'kWp')},
          {
            label: 'Number of panels',
            value: `${system.modules.toLocaleString('en-MY')} × ${system.moduleWatts} W`,
          },
          {label: 'Commissioned', value: stampDate(system.commissionedAt)},
        ]}
      />

      {/* Band 5 — what is wrong, and the numbers behind it. Every rule the system
          carries: this is the page somebody opens to find out whether anything
          needs doing, and it is now the only page that answers. */}
      <SystemHealth
        alerts={derived}
        condition={condition}
        readings={detail.readings}
        daylight={daylight}
        lastUpdated={system.lastUpdated}
        now={now}
        heading="The system's own figures"
      />

      {/* Why band 1 counts more than this band shows — stated on the page rather
          than left as a discrepancy a reader has to notice and then distrust. */}
      {standing.length > derived.length && (
        <p className="max-w-prose text-xs text-tertiary">
          The counts above also include {standing.length - derived.length}{' '}
          {standing.length - derived.length === 1 ? 'alarm' : 'alarms'} asserted by the
          site's monitoring unit against the conversion units and their arrays. They are
          not carded here — this band draws each rule against the reading and threshold
          behind it, and those registers carry no reading. The Alarms tab lists every row
          from both sources, with what has been done about each one.
        </p>
      )}
    </div>
  );
};
