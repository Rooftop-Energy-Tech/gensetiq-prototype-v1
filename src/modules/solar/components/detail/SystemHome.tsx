import {MoonIcon} from 'lucide-react';

import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {Badge} from '@/components/ui/badge';
import {amount, stampDate} from '@/lib/format';
import {TickGauge} from '@/modules/genset/components/detail/TickGauge';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {TrendPanel} from '@/modules/site/components/TrendPanel';
import {systemHealth} from '../../data/systemHealth';
import type {SystemDetail} from '../../data/systemDetail';
import type {SolarSystem} from '../../types/system.type';
import {SystemHealth} from './SystemHealth';

/**
 * A solar system's home page, in the five bands the design stacks — the same
 * bands, in the same order, as a site's and a genset's.
 *
 * 1. **The strip** — solar capacity, what it has made today, and the alarm counts.
 * 2. **The gauge** — one dial, what it is putting out right now, with a `Dark`
 *    badge under it when the sun is down.
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

  const {alerts, condition} = systemHealth(system, detail, now);
  const seed = siteSeed(system.siteId);

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
        counts={countBySeverity(alerts)}
      />

      {/* Band 2 — one dial, centred, at hero size. The design gives the whole band
          to a single reading, which is right for the one number on this page that
          is true only at this instant: everything in the strip above is cumulative
          and everything below is history.

          Full scale is the array's **nameplate kWp**, which is the only ceiling
          there is now. It used to be the inverters' combined AC rating, on the
          argument that a dial which could never fill reads as a plant permanently
          underperforming — these systems were deliberately oversized to their
          boxes, so kWp was unreachable by design. With no boxes there is no AC
          rating to scale to, and the honest full scale is the glass. The
          consequence is real and worth knowing: a clear noon lands near half way
          up, because that is what an array does. */}
      <section aria-label="Generation now" className="flex flex-col items-center gap-3 py-6">
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

        {/* Why the sun is not up, said out loud.

            Without it this is the most misread thing on the page. At nine in the
            evening the dial reads 0 kW and the state rolls up to `Idle`, which is
            pixel-for-pixel what a plant that has tripped in the middle of the
            afternoon looks like — and the health band below raises nothing,
            because nothing is wrong. A reader who has learned to check this page
            in a hurry would be checking it at exactly the hour it cannot answer.

            The bank page puts its flow direction here for the same reason: the
            fact that makes the dial legible belongs beside the dial and not two
            bands away. */}
        {!daylight && (
          <Badge variant="secondary">
            <MoonIcon className="text-tertiary" aria-hidden="true" />
            Dark
            <span className="text-secondary"> | </span>
            first light {String(FIRST_LIGHT).padStart(2, '0')}:00
          </Badge>
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
        alerts={alerts}
        condition={condition}
        readings={detail.readings}
        daylight={daylight}
        lastUpdated={system.lastUpdated}
        now={now}
        heading="The system's own figures"
      />
    </div>
  );
};
