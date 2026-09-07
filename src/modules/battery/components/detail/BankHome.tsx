import {BatteryChargingIcon} from 'lucide-react';

import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {TankGlyph} from '@/components/global/TankGlyph';
import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {CHARGE_VIEW, TrendPanel} from '@/modules/site/components/TrendPanel';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {siteSummary} from '@/modules/site/data/sites';
import {BANK_FLOW_LABEL, bankFlow} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';
import {ModuleRack} from './ModuleRack';

/**
 * A bank's home page, in the bands the solar page uses — because it is the same
 * design, over the other half of the hybrid.
 *
 * 1. **The strip** — how big the bank is, how long it would carry the site, and
 *    the alarm counts.
 * 2. **The charge** — the bank drawn as a battery, and beside it the rack of
 *    modules it is built from, each with its own level.
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
 * ## The reading is charge, not power
 *
 * The solar page's dial is generation, because what an array is *doing* is the
 * question. A bank's is state of charge, because what a bank is *holding* is: an
 * operator deciding whether to send a genset out tonight needs the level, and the
 * direction and rate are the caption under it. Charge is also the one reading with
 * a natural full scale — 0 to 100% — where a converter's throughput has only a
 * nameplate.
 *
 * ## Why it is a battery now and not a dial
 *
 * It was `TickGauge` at `hero` size, the same lit arc the solar and genset pages
 * draw, and the design has since specified this band as a **tank**: the 46 × 60
 * segmented battery the fuel panel has always used for diesel, in the storage blue,
 * with the figure set beside it rather than inside the arc.
 *
 * That is the better shape for this particular reading, and for a reason the dial
 * could not have. A tick ring is built to show a needle sitting somewhere on a scale
 * — engine speed *at* 1500, holding — and it is neutral about which end is good. A
 * battery is a container, and every reader already knows a full one is better than
 * an empty one and which way it drains. The page is asking "will this last the
 * night", so the glyph that answers it should be the one that reads as a level.
 *
 * It also makes the rack beside it possible. Twelve small dials would be twelve
 * scales to read; twelve small batteries are the same picture twelve times, which
 * is the entire mechanism `ModuleRack` works by.
 */
export const BankHome = ({bank, now}: {bank: BatteryBank; now: number}) => {
  const flow = bankFlow(bank);
  const seed = siteSeed(bank.siteId);
  /**
   * Nameplate across the sets in this bank's yard, which is what sizes the genset
   * band of the charge mix — see `gensetDay`.
   *
   * Read off the site summary rather than carried on `BatteryBank`: a bank has no
   * business knowing what engines stand beside it, and this page is already the
   * place that asks the site about itself. `0` at a yard with no set, which is the
   * honest answer — a solar hybrid with nothing fitted charges off the roof alone,
   * and the mix then has one band.
   */
  const ratedKw = siteSummary(bank.siteId)?.ratedKw ?? 0;

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

      {/* A container query rather than a breakpoint, for `DetailBand`'s reason: this
          band sits inside the app's rail and the section's, which take 334px between
          them, so the viewport width says nothing about how much room the rack
          actually has. The pack and the rack stack until the band itself is wide
          enough to set them side by side. */}
      <section aria-label="Charge now" className="@container py-6">
        <div className="flex flex-col items-center gap-8 @2xl:flex-row @2xl:items-start @2xl:gap-12">
          {/* The pack: one battery, its figure, and what it is doing. Left-aligned
              once the rack is beside it, because the two are read left to right —
              the pack's answer, then whether its modules agree with it. */}
          <div className="flex shrink-0 flex-col items-center gap-3 px-6">
            <div className="flex items-center gap-3">
              <TankGlyph fraction={bank.soc} tone="battery" />

              {/* The figure beside the glyph rather than under it, which is the
                  design's arrangement and the one that reads as a caption to the
                  battery rather than as a second thing to look at. `sr-only` because
                  "61 %" on its own is a number with no subject — the dial this
                  replaced carried its label in the arc's `aria-label`. */}
              <p className="flex items-center gap-0.5">
                <span className="sr-only">State of charge</span>
                <span className="text-lg leading-7 font-semibold text-primary">
                  {Math.round(bank.soc * 100)}
                </span>
                <span className="text-xs font-medium text-primary">%</span>
              </p>
            </div>

            {/* The direction, under the level. Which way the energy is going is a
                fact about the same instant the battery draws, and separating them
                into two bands would make a reader hold one while they went looking
                for the other. `At rest` is a real third state, not a rounding of the
                two — a bank floating on a bus is neither charging nor carrying.

                Stacked rather than wrapped in a row: the design sets them one above
                the other, and with the rack now taking the width beside them a row
                of two pills would have been the widest thing in this column. */}
            <div className="flex flex-col items-center gap-2">
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
                  was optimistic twice over: it spent the quarter of the pack the plant
                  sheds at, and it spent it out of a nameplate the bank no longer holds.
                  At SWK-0794 that read six hours where the site had under two. It now
                  comes from `hybridState`, so the badge, the site page's strip and the
                  register are one number rather than three implementations of it. */}
              <Badge variant="secondary">
                {amount(bank.hoursLeft, 'h', 1)} left at this load
              </Badge>
            </div>
          </div>

          {/* The same battery, once per module — see `ModuleRack` for why it is here
              and not in a band of its own. */}
          <ModuleRack bank={bank} />
        </div>
      </section>

      <div className="border-t border-subtle" />

      {/* The bank over time, in the two views a bank has.

          `Charge mix` leads, and it is the newer of the two: **where the charge
          came from**, stacked by source. A bank that spent the night on diesel and
          a bank that filled off the roof hold the same percentage, and which of
          those two a site is doing is the entire argument for a solar hybrid — so
          it is what this page should open on. `Battery level` behind it is the
          state of charge this page has always drawn, and it is still the answer to
          "will it last the night".

          A bank whose site has been flipped away from storage cannot reach this
          page at all, so `seed` is only ever missing for an id the router already
          404s. */}
      {seed !== undefined && (
        <TrendPanel
          seed={seed}
          role={bank.role}
          gensetIds={[]}
          metrics={[CHARGE_VIEW, 'BATTERY']}
          ratedKw={ratedKw}
          now={now}
          ariaLabel="Bank history"
        />
      )}

      <div className="border-t border-subtle" />

      {/* What the bank is, in the `DetailBand` all four detail pages share.
          The first two are the bank's nameplates — how much it holds and how fast it
          can move it — which is the storage equivalent of a system's kWp beside its
          AC rating, and the pair a reader needs to know whether this bank can
          actually absorb the array above it at noon.

          Health belongs with them rather than beside the dial, and it matters that
          this band is nowhere near it. Two percentages side by side read as one
          quantity at two precisions, and a reader who took 81% health for a worse
          81% charge would have the wrong fact entirely: the dial moves every hour
          and this moves over years. Down here, among the nameplates and under the
          chart, health reads as what it is — how much of that specification is
          still there.

          Under the chart because nothing in the band is live. The dial and the
          trend are what this page is opened for; these three are what a reader
          consults once they have read them, which is the order all four detail
          pages now keep. */}
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
    </div>
  );
};
