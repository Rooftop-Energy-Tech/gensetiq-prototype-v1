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
 * 3. **The details** — what the system *is*: four nameplate facts, nothing live.
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
 * To `Devices`, the section in the rail whose whole subject they are. They had to
 * go *somewhere*: the rail deliberately does not list the boxes — a mini-grid is
 * ten of them and a nested list would be an inventory (see `SystemDetailShell`) —
 * so had the band simply been deleted, `/solar/<id>/inverters/<id>` would have been
 * reachable by typing it and by nothing else.
 *
 * `Devices` is also where a reader would look for them, which the home page never
 * quite was. The band was here because the page was built before the section
 * existed.
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
 * The bands are already a column, so nothing rearranges, and with the inverter
 * table gone there is nothing left on the page that cannot reflow.
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

          Scaled to the **AC** rating, not the array's kWp. What the gauge measures
          is what the inverters are passing, and a dial that could never reach its
          own full scale — every one of these systems is deliberately oversized to
          its boxes — would read as a plant permanently underperforming. */}
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
            max: Math.max(1, Math.round(system.acKw)),
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

      {/* Band 3 — what the system *is*, in the `DetailBand` all four detail pages
          share. Four nameplate facts and nothing live: this band should read the
          same on a Tuesday morning as it does on a Sunday night.

          **The first two are a pair.** The kWp is the glass on the roof and the kW
          is the most the inverters can ever pass to the tower, and the ratio
          between them is what every one of these was specified with — so
          `Installed capacity` is the AC figure, deliberately, rather than a second
          statement of the DC one above it. Side by side they answer "why does the
          dial top out below the nameplate", which is otherwise the second thing a
          reader asks about band 2.

          **`Commissioned` earns its place by dating everything else.** A system
          five years old has given up a few points to the glass simply ageing, and
          a reader comparing this year's chart with last year's needs to know that
          before they go looking for a fault.

          What is deliberately *not* here: the inverters, the strings and the last
          wash. Each has a section of its own in the rail — `Devices`, `Devices`,
          `Service` — and restating them would make this band a second index of the
          page. It is a description of the system, not a summary of what is under
          it. */}
      <DetailBand
        ariaLabel="System details"
        rows={[
          {label: 'System capacity', value: amount(system.kwp, 'kWp')},
          {label: 'Installed capacity', value: amount(system.acKw, 'kW')},
          {
            label: 'Number of panels',
            value: `${system.modules.toLocaleString('en-MY')} × ${system.moduleWatts} W`,
          },
          {label: 'Commissioned', value: stampDate(system.commissionedAt)},
        ]}
      />

      <div className="border-t border-subtle" />

      {/* Band 4 — generation over time. `TrendPanel` with one metric, which is the
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

      {/* Band 5 — what is wrong, and the numbers behind it. Every rule, including
          the ones that name a box: this is the page somebody opens to find out
          whether anything needs doing, and making them read six inverter pages to
          answer that would be the register's mistake repeated one level down. */}
      <SystemHealth
        alerts={alerts}
        condition={condition}
        readings={detail.readings}
        daylight={daylight}
        reporting={reporting}
        lastUpdated={system.lastUpdated}
        now={now}
        heading="The system's own figures"
      />
    </div>
  );
};
