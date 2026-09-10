import type {LinkProps} from '@tanstack/react-router';
import {BatteryChargingIcon} from 'lucide-react';

import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {BatteryGlyph} from '@/components/global/BatteryGlyph';
import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {TrendPanel} from '@/modules/site/components/TrendPanel';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {siteSummary} from '@/modules/site/data/sites';
import {keepFrom} from '@/modules/site/types/fromSearch.type';
import {BANK_FLOW_LABEL, BANK_RESERVE_LABEL, bankFlow} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';
import {ModuleCabinets} from './ModuleCabinets';

/**
 * A bank's home page, in the bands the solar page uses — because it is the same
 * design, over the other half of the hybrid.
 *
 * 1. **The strip** — how big the bank is, how long it would carry the site *from
 *    here*, and the alarm counts.
 * 2. **The charge** — the bank drawn as a battery, with what it is doing under it.
 * 3. **The modules** — the rack it is built from, one card per module, each with
 *    its own charge, health, temperature and stored energy.
 * 4. **The chart** — state of charge, with a day stepper and a period control.
 * 5. **The details** — what the bank *is*, in a narrow block between two rules.
 *
 * ## Why there are five bands and not seven
 *
 * Because a bank has no boxes to list, no alert rules and no activity to feed —
 * see below. The bands that exist are the design's, in the design's order, and the
 * three that are missing are missing because the *model* is, not because the page
 * chose to drop them. Each has a section of its own in the rail saying what it will
 * hold, which is the same way `/solar` was stood up before it had a register.
 *
 * ## The alarm column, and why it no longer always reads zero
 *
 * It used to read three hard-coded zeros everywhere, with a comment explaining that
 * nothing in this app raised a battery alarm — no cell imbalance, no
 * over-temperature, no low-charge rule, no BMS fault — and that a truthful zero beat
 * an invented count.
 *
 * That is still the answer at twenty-four of the twenty-five sites. At the one with
 * a **monitoring unit** on its DC plant it is not: twenty-eight of that unit's
 * fifty-eight registers are about the battery, and the rail's `Alarms` row now lists
 * the ones it is asserting.
 *
 * So the column is read from the same function that page's Standing table is —
 * `plantAlarmQueue` — rather than counted again here. Two numbers about one bank on
 * two adjacent pages is precisely the pair that drifts, and an honest zero that has
 * quietly become a wrong number is worse than either. **Cleared alarms are not in
 * it**, so clearing a row on the tab drops the count here, which is the first thing
 * a reader will check.
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
 * It also makes the rack below it possible. A dozen small dials would be a dozen
 * scales to read; a dozen small batteries are the same picture a dozen times, which
 * is the entire mechanism `ModuleRack` works by.
 */
export const BankHome = ({bank, now}: {bank: BatteryBank; now: number}) => {
  const flow = bankFlow(bank);
  const seed = siteSeed(bank.siteId);

  /**
   * The alarm column, live.
   *
   * Subscribed rather than read once, so acknowledging or clearing a row on the
   * Alarms tab is reflected here without a reload — the two pages are one asset and
   * a reader will move straight between them to check exactly that.
   *
   * The bank's id *is* its site's, so no lookup is needed to reach the unit on the
   * wall beside it. `useSitePowerRole` is what makes the count follow a reader
   * flipping the site's configuration on its settings tab.
   */
  const handling = useAlarmHandling();
  const role = useSitePowerRole(bank.id);
  const counts = countBySeverity(plantAlarmQueue(bank.id, role, 'BATTERY', handling).standing);
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
          /* What the bank would carry **from here**, not from full.

             This column was `Autonomy from full` — the specification, and the wrong
             figure for the top of a page somebody opens to decide whether to send a
             genset out tonight. SBH-1336 is rated 19 hours from full and has six
             from where it actually sits, because it is at 57% charge on 93% health
             carrying a live load. The nineteen was answering a question about a bank
             this one no longer is, and answering it three times too generously.

             The specification has not been dropped, it has gone to where nameplates
             belong: the rail's details tooltip beside the converter rating, and the
             register's `Autonomy` column.

             The site page's battery card makes exactly this swap, in those words,
             for exactly this reason. */
          {label: BANK_RESERVE_LABEL, value: amount(bank.hoursLeft, 'h', 1)},
        ]}
        // Standing only, and from the Alarms tab's own reading of it. Still three
        // zeros at every bank with nothing watching it — see the note above.
        counts={counts}
        /* The pill opens this asset's own Alarms tab — the tab the count is read
           from, so the figure and the queue behind it cannot be two lists.
           `keepFrom` carries `from` across, which is what keeps a bank
           opened from a site crumbing back to that site rather than springing to
           its register. See `fromSearch.type.ts`. */
        alarmLink={{
          to: '/battery/$bankId/alarms',
          params: {bankId: bank.id},
          search: keepFrom as unknown as LinkProps['search'],
        }}
      />

      {/* The pack, centred, and nothing else in the band.

          The rack of modules used to sit to the right of this glyph in a container
          query — the two side by side were one statement, the pack's answer and then
          whether its modules agreed with it. A module is four figures now rather than
          one, and four figures do not fit in the column that was left over. So the
          rack is its own band directly below, and `ModuleRack` carries the argument
          about what that trade cost and what buys it back — it is now the fallback
          under `ModuleCabinets`, which draws the same modules in their cabinets. */}
      <section aria-label="Charge now" className="flex justify-center py-6">
        <div className="flex flex-col items-center gap-3 px-6">
          <div className="flex items-center gap-3">
            {/* `charging` off the same `flow` the badge below reads, so the bolt and
                the word cannot disagree — see `bankFlow`. */}
            <BatteryGlyph fraction={bank.soc} charging={flow === 'CHARGING'} />

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

              One badge, where there were two. The second was
              `5.9 h left at this load`, and it is gone because that figure is now
              the strip's second column at the top of the page. Keeping both would
              have printed one number twice on one screen, six hundred pixels apart —
              which is not merely redundant: two copies of a live figure are two
              things to keep in step, and the pair that drifts is always the pair
              nobody remembers is a pair.

              The strip is the right home for it of the two. It is a figure a reader
              scans for before deciding whether to read anything else, and the strip
              is the band this page puts those in; down here it was a caption to the
              glyph, which is what the direction is. */}
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
        </div>
      </section>

      <div className="border-t border-subtle" />

      {/* The same battery, once per module — drawn in the cabinets the modules stand
          in, with whichever slot is selected beside them. `ModuleCabinets` falls back
          to the wrapping grid of cards where a line-up of `ESC330`s is not a credible
          claim about the bank; it carries both arguments. */}
      <ModuleCabinets bank={bank} />

      <div className="border-t border-subtle" />

      {/* The bank over time: `Battery SoC`, the state of charge this page has
          always drawn — the answer to "will it last the night".

          `Charge mix` — where the charge came from, stacked by source — is parked
          rather than deleted: `CHARGE_VIEW` and `siteChargeMix` still answer for
          it, so returning it is re-adding it to `metrics` here.

          A bank whose site has been flipped away from storage cannot reach this
          page at all, so `seed` is only ever missing for an id the router already
          404s. */}
      {seed !== undefined && (
        <TrendPanel
          seed={seed}
          role={bank.role}
          gensetIds={[]}
          metrics={['BATTERY']}
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
