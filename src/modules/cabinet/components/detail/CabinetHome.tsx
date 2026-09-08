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
import {TickGauge} from '@/modules/genset/components/detail/TickGauge';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import {cabinetDuty} from '../../types/cabinet.type';
import type {SubrackCabinet} from '../../types/cabinet.type';
import {SubrackRack} from './SubrackRack';

/**
 * The cabinet's home page, in the bands the other three asset pages use.
 *
 * 1. **The strip** — what the shelf can pass, what the bus is delivering, how warm
 *    the box is, and the alarm counts.
 * 2. **The load** — the tower's draw against the shelf's ceiling, as a dial, with
 *    what is actually converting under it.
 * 3. **The shelf** — one card per module, rectifiers then SSUs.
 * 4. **The details** — what the cabinet *is*, in the band all four pages share.
 *
 * ## Why the dial reads a fifth of full scale, and why that is right
 *
 * Six rectifiers at 4 kW against a 5 kW tower. A telecom plant is specified N+1 and
 * this one is nearer N+4: four of the six can be gone before the fifth is in
 * trouble. So the needle sits low and the honest picture of this cabinet is a lot of
 * headroom — which is the reading `Low Rectifier Capacity` keys off, and the reason
 * the source document expects that alarm essentially never to fire here.
 *
 * ⚠️ **The dial is a headroom question, not a throughput one.** It draws the tower's
 * load against the shelf's ceiling whether or not the shelf is the thing carrying —
 * which at this site it usually is not, because the array carries by day and the
 * bank by night. `cabinetDuty` carries that argument; the badge under the dial and
 * every module card are what say whether the shelf is converting right now.
 *
 * A dial rather than the bank's tank, and the choice is the opposite of the one that
 * page made. A tank is a container and every reader knows a full one is better; a
 * shelf's load is a rate, it has no level, and *full* is the bad end. A tick ring is
 * neutral about which end is good, which is exactly what this reading needs.
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

      <section aria-label="Load now" className="flex justify-center py-6">
        <div className="flex flex-col items-center gap-3 px-6">
          <TickGauge
            size="hero"
            reading={{
              key: 'cabinet-load',
              // Not "load on the shelf" — the shelf is usually passing none of it.
              // The dial asks whether it *could*; see `cabinetDuty`.
              label: 'Tower load against shelf capacity',
              value: cabinet.loadKw ?? 0,
              unit: 'kW',
              precision: 1,
              min: 0,
              max: cabinet.capacityKw,
            }}
          />

          {/* What is actually holding the tower up, under the reading — the same
              arrangement the bank puts its charge direction in, and the same reason:
              it is a fact about the instant the dial is drawn, and separating them
              into two bands would make a reader hold one while they hunted the
              other.

              It is also what stops the dial being misread. The dial is a headroom
              question and stays lit while the shelf idles; this badge is the one
              element that says whether the shelf is converting right now, and the
              module cards below agree with it to the kilowatt. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
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

            {/* The headroom stated in words, because a dial sitting a sixth of the
                way round does not say how many modules that is — and how many can be
                lost is the question a plant engineer is actually asking. */}
            <Badge variant="secondary">
              {Math.round((1 - duty) * 100)}% headroom
            </Badge>
          </div>
        </div>
      </section>

      <div className="border-t border-subtle" />

      <SubrackRack cabinet={cabinet} />

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
          {label: 'Monitoring unit', value: cabinet.deviceName},
          {label: 'Modbus slave', value: `${cabinet.slaveId}`},
        ]}
      />
    </div>
  );
};
