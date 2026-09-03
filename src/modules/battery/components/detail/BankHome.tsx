import {BatteryChargingIcon} from 'lucide-react';

import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {TickGauge} from '@/modules/genset/components/detail/TickGauge';
import {TrendPanel} from '@/modules/site/components/TrendPanel';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {BANK_FLOW_LABEL, bankFlow} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';

/**
 * A bank's home page, in the bands the solar page uses — because it is the same
 * design, over the other half of the hybrid.
 *
 * 1. **The strip** — how big the bank is, how long it would carry the site, and
 *    the alarm counts.
 * 2. **The gauge** — one dial: where the charge stands right now.
 * 3. **The details** — what the bank *is*, in a narrow block between two rules.
 * 4. **The chart** — state of charge, with a day stepper and a period control.
 *
 * ## Why there are four bands and not seven
 *
 * Because a bank has no boxes to list, no alert rules and no activity to feed —
 * see below. The bands that exist are the design's, in the design's order, and the
 * three that are missing are missing because the *model* is, not because the page
 * chose to drop them. Each has a section of its own in the rail saying what it will
 * hold, which is the same way `/solar` was stood up before it had a register.
 *
 * ## The alarm column, and why it reads zero
 *
 * Honestly. Nothing in this app raises a battery alarm — no cell imbalance, no
 * over-temperature, no low-charge rule, no BMS fault — and the `Alarms` section
 * says so in as many words. The strip keeps the column because it is the design's
 * fixed third and because a reader moving between a genset, an array and a bank
 * should find it in the same place on all three; what it must not do is invent a
 * count. Zeros here mean *no rule has ever been written*, and the section behind
 * the rail's `Alarms` row is where that gets fixed.
 *
 * ## The gauge is charge, not power
 *
 * The solar page's dial is generation, because what an array is *doing* is the
 * question. A bank's is state of charge, because what a bank is *holding* is: an
 * operator deciding whether to send a genset out tonight needs the level, and the
 * direction and rate are the caption under it. Charge is also the one reading with
 * a natural full scale — 0 to 100% — where a converter's throughput has only a
 * nameplate.
 */
export const BankHome = ({bank, now}: {bank: BatteryBank; now: number}) => {
  const flow = bankFlow(bank);
  const seed = siteSeed(bank.siteId);

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-3 pb-24 md:pb-6">
      <MetricStrip
        ariaLabel="Bank summary"
        metrics={[
          {label: 'Battery capacity', value: amount(bank.kwh, 'kWh')},
          {label: 'Autonomy from full', value: amount(bank.autonomyHours, 'h')},
        ]}
        // See the note above: no battery rule exists to count, and a fabricated
        // number would be worse than a truthful zero.
        counts={{CRITICAL: 0, WARNING: 0, NEUTRAL: 0}}
      />

      <section
        aria-label="Charge now"
        className="flex flex-col items-center gap-3 py-6"
      >
        <TickGauge
          size="hero"
          colorClassName="text-battery"
          reading={{
            key: 'soc',
            label: 'State of charge',
            value: Math.round(bank.soc * 100),
            unit: '%',
            min: 0,
            max: 100,
          }}
        />

        {/* The direction, under the level. Which way the energy is going is a fact
            about the same instant the dial reads, and separating them into two
            bands would make a reader hold one while they went looking for the
            other. `At rest` is a real third state, not a rounding of the two —
            a bank floating on a bus is neither charging nor carrying. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="whitespace-pre">
            <BatteryChargingIcon
              className={flow === 'IDLE' ? 'text-tertiary' : 'text-battery'}
              aria-hidden="true"
            />
            {BANK_FLOW_LABEL[flow]}
            {flow !== 'IDLE' && (
              <>
                <span className="text-secondary"> | </span>
                {amount(Math.abs(bank.powerKw), 'kW')}
              </>
            )}
          </Badge>

          {/* What the bank would carry *from here*, not from full — and the badge
              that would get somebody out of bed.

              This used to be `autonomyHours × soc`, computed on this page, and it
              was optimistic twice over: it spent the quarter of the dial the plant
              sheds at, and it spent it out of a nameplate the bank no longer holds.
              At SWK-0794 that read six hours where the site had under two. It now
              comes from `hybridState`, so the badge, the site page's strip and the
              register are one number rather than three implementations of it. */}
          <Badge variant="secondary">
            {amount(bank.hoursLeft, 'h', 1)} left at this load
          </Badge>
        </div>
      </section>

      <div className="border-t border-subtle" />

      {/* What the bank is, in the `DetailBand` all four detail pages share.
          The first two are the bank's nameplates — how much it holds and how fast it
          can move it — which is the storage equivalent of a system's kWp beside its
          AC rating, and the pair a reader needs to know whether this bank can
          actually absorb the array above it at noon.

          Health belongs under them rather than beside the dial, and the rule above
          is doing real work. Two percentages side by side read as one quantity at
          two precisions, and a reader who took 81% health for a worse 81% charge
          would have the wrong fact entirely: the dial moves every hour and this
          moves over years. Putting health with the nameplates says what it is —
          how much of that specification is still there. */}
      <DetailBand
        ariaLabel="Bank details"
        rows={[
          {
            label: 'Number of modules',
            value: `${bank.modules.toLocaleString('en-MY')} × ${bank.moduleKwh} kWh`,
          },
          {label: 'Continuous power', value: amount(bank.continuousKw, 'kW')},
          {label: 'State of health', value: `${Math.round(bank.soh * 100)}%`},
        ]}
      />

      <div className="border-t border-subtle" />

      {/* State of charge over time — `TrendPanel` held to the one metric this page
          is about, exactly as the solar page holds it to generation. A bank whose
          site has been flipped away from storage cannot reach this page at all, so
          `seed` is only ever missing for an id the router already 404s. */}
      {seed !== undefined && (
        <TrendPanel
          seed={seed}
          role={bank.role}
          gensetIds={[]}
          metrics={['BATTERY']}
          now={now}
          ariaLabel="State of charge"
        />
      )}
    </div>
  );
};
