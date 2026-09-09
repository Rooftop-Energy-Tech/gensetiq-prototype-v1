import {
  BatteryChargingIcon,
  SunMediumIcon,
  ThermometerIcon,
  UtilityPoleIcon,
} from 'lucide-react';

import {DetailBand} from '@/components/global/DetailBand';
import {MetricStrip} from '@/components/global/MetricStrip';
import {Badge} from '@/components/ui/badge';
import {amount} from '@/lib/format';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {cabinetDuty} from '../../types/cabinet.type';
import type {SubrackCabinet} from '../../types/cabinet.type';
import {SubrackShelf} from './SubrackShelf';

/**
 * The cabinet's home page, in the bands the other three asset pages use.
 *
 * 1. **The strip** — what the shelf can pass, what the bus is delivering, how warm
 *    the box is, and the alarm counts.
 * 2. **The state** — which group is converting, the enclosure temperature, and how
 *    much headroom is left, as three badges.
 * 3. **The shelf** — the cabinet drawn front-on, bay by bay, with the selected bay
 *    beside it.
 * 4. **The details** — what the cabinet *is*, in the band all four pages share.
 *
 * ## Why the second band has no dial
 *
 * It had one — a hero `TickGauge` reading `Tower load against shelf capacity`, 5 kW
 * of 24 — and it was removed. Two reasons, and the second is the one that matters.
 *
 * **Every figure in it was already on the page.** The load is the strip's `Bus
 * output` column, the ceiling is its `Rectifier capacity` column, and the ratio is
 * the `79% headroom` badge. A dial earns its band when it puts a needle somewhere on
 * a scale a reader cannot infer; this one put a needle a fifth of the way round two
 * numbers printed an inch above it.
 *
 * **And it was the weakest reading here.** A dial has to point at something, and what
 * this cabinet is passing is nothing for most of the day — the array carries by day
 * and the bank by night — so it was drawn against a hypothetical instead: what the
 * shelf *could* take if the sun went in. That is a genuinely useful question and a
 * badge answers it better than an arc, because an arc looks like a measurement of
 * now. `cabinetDuty` carries the rest of that argument.
 *
 * The headroom itself is worth keeping in words. Six rectifiers at 4 kW against a
 * 5 kW tower is nearer N+4 than the N+1 a telecom plant is specified at: four of the
 * six can be gone before the fifth is in trouble. `79% headroom` says that; a needle
 * sitting low did not.
 *
 * ## What is not here
 *
 * **No chart.** The other three asset pages carry a trend band and this one cannot
 * honestly: `siteTrend` models generation, charge and load for a *site*, and there
 * is no series anywhere in this app for a rectifier shelf's output or an enclosure's
 * temperature. A chart drawn from the site's load would be the site's chart with a
 * cabinet's title on it. The day the gateway's history covers `0x1100`, this is
 * where it goes.
 *
 * **No service band.** A rectifier is swapped, not serviced, and nothing in the
 * model records a swap.
 */
export const CabinetHome = ({cabinet}: {cabinet: SubrackCabinet}) => {
  /**
   * The alarm column, live and read from the Alarms tab's own function.
   *
   * The category id is `SITE` — see `PLANT_ALARM_CATEGORY_LABEL` on why the word and
   * the id differ — and all seventeen of its rows are this cabinet's. Subscribed
   * rather than read once, so acknowledging or clearing a row on the tab drops this
   * count without a reload, which is the first thing a reader checks.
   */
  const handling = useAlarmHandling();
  const role = useSitePowerRole(cabinet.siteId);
  const counts = countBySeverity(
    plantAlarmQueue(cabinet.siteId, role, 'SITE', handling).standing,
  );

  const duty = cabinetDuty(cabinet);
  const converting = cabinet.carrying === 'RECTIFIERS' || cabinet.carrying === 'SSUS';
  const CarryingIcon = cabinet.carrying === 'SSUS' ? SunMediumIcon : UtilityPoleIcon;

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-3 pb-24 md:pb-6">
      <MetricStrip
        ariaLabel="Cabinet summary"
        metrics={[
          {label: 'Rectifier capacity', value: amount(cabinet.capacityKw, 'kW')},
          {
            /**
             * The bus, in one column with the bracket the site page's own strip uses:
             * a tower's DC plant has one bus and these are one measurement written
             * three ways. `Not served` rather than `0 kW`, which would read as a load
             * that had gone away rather than a tower nobody is serving.
             */
            label: 'Bus output',
            value:
              cabinet.loadKw === null ? (
                'Not served'
              ) : (
                <>
                  {amount(cabinet.loadKw, 'kW')}
                  {cabinet.busVolts !== null && cabinet.busAmps !== null && (
                    <span className="text-sm font-medium whitespace-nowrap text-secondary">
                      {' '}
                      ({amount(cabinet.busVolts, 'V', 1)} · {amount(cabinet.busAmps, 'A')})
                    </span>
                  )}
                </>
              ),
          },
          {label: 'Enclosure', value: `${cabinet.tempC.toFixed(1)} °C`},
        ]}
        counts={counts}
      />

      {/* What is holding the tower up, how warm the box is, and how much room the
          shelf has left. Three badges, where there used to be a dial above them —
          see `Why the second band has no dial` above.

          They stay because none of the three is redundant with the strip.
          `Bank carrying | shelf on standby` is the only element on the page that says
          which group is converting, and the bays in the figure below agree with it to
          the kilowatt. */}
      <section aria-label="What the shelf is carrying" className="flex justify-center pt-1 pb-5">
        <div className="flex flex-wrap items-center justify-center gap-2 px-6">
          {converting ? (
            <Badge variant="secondary" className="whitespace-pre">
              <CarryingIcon
                className={cabinet.carrying === 'SSUS' ? 'text-solar' : 'text-teal'}
                aria-hidden="true"
              />
              {cabinet.carrying === 'SSUS' ? 'Solar units carrying' : 'Rectifiers carrying'}
              <span className="text-secondary"> | </span>
              {amount(cabinet.loadKw ?? 0, 'kW')}
            </Badge>
          ) : (
            // Two states, two sentences. A bank carrying is a solar hybrid doing
            // exactly what it was bought for and happens every night here; an
            // unserved tower is an outage. Both leave this cabinet converting
            // nothing, and saying so in one neutral phrase would flatten the
            // difference a reader most needs.
            <Badge variant="secondary" className="whitespace-pre">
              <BatteryChargingIcon
                className={cabinet.carrying === 'BATTERY' ? 'text-battery' : 'text-tertiary'}
                aria-hidden="true"
              />
              {cabinet.carrying === 'BATTERY'
                ? 'Bank carrying | shelf on standby'
                : 'Nothing served | shelf idle'}
            </Badge>
          )}

          <Badge variant="secondary" className="whitespace-pre">
            <ThermometerIcon className="text-tertiary" aria-hidden="true" />
            {cabinet.tempC.toFixed(1)} °C
          </Badge>

          {/* The headroom in words, which is the whole of what the dial above this
              used to be for and says it better. `79% headroom` against a shelf of
              six 4 kW modules is four of the six gone before the fifth is in
              trouble — a telecom plant is specified N+1 and this one is nearer
              N+4. An arc could not have said that, and how many can be lost is the
              question a plant engineer is actually asking. */}
          <Badge variant="secondary">{Math.round((1 - duty) * 100)}% headroom</Badge>
        </div>
      </section>

      <div className="border-t border-subtle" />

      <SubrackShelf cabinet={cabinet} />

      <div className="border-t border-subtle" />

      {/* What the cabinet is. The shelf's make-up first — the pair that decides
          whether it can carry the tower without the sun — then the box on its wall
          that reports all of this, which is the one fact a reader needs before
          trusting any of the rest. */}
      <DetailBand
        ariaLabel="Cabinet details"
        rows={[
          {
            label: 'Rectifiers',
            value: `${cabinet.rectifiers} × ${amount(cabinet.rectifierKw, 'kW')}`,
          },
          {label: 'Solar conversion units', value: `${cabinet.ssus}`},
          {label: 'Rectifier capacity', value: amount(cabinet.capacityKw, 'kW')},
          // What the three figures above are worth. `Counted` is the unit's own
          // hardware; `Sized` says a model put them there, and the row exists so the
          // reader is told before they act on a module count rather than after. See
          // `SubrackCabinet.shelf`.
          {
            label: 'Shelf make-up',
            value: cabinet.shelf === 'READ' ? 'Counted on site' : 'Sized from the plant',
          },
          // The two device rows only where there is a device. A `Monitoring unit —`
          // row would be the "0 is ambiguous three ways" mistake in a details band:
          // an em-dash where a name goes reads as a unit whose name nobody recorded,
          // when the fact is that no unit is fitted. That is the sentence the row
          // above already carries, so these simply go.
          ...(cabinet.deviceName === null
            ? []
            : [{label: 'Monitoring unit', value: cabinet.deviceName}]),
          ...(cabinet.slaveId === null
            ? []
            : [{label: 'Modbus slave', value: `${cabinet.slaveId}`}]),
        ]}
      />
    </div>
  );
};
