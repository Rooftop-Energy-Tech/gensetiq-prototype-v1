import {MetricStrip} from '@/components/global/MetricStrip';
import {amount} from '@/lib/format';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import {useSitePowerRole} from '@/modules/site/data/siteConfig';
import type {SubrackCabinet} from '../../types/cabinet.type';
import {SubrackShelf} from './SubrackShelf';

/**
 * The cabinet's home page, in the bands the other three asset pages use.
 *
 * 1. **The strip** — what the shelf can pass, what the bus is delivering, how warm
 *    the box is, and the alarm counts.
 * 2. **The shelf** — the cabinet drawn front-on, bay by bay, with the selected bay
 *    beside it. The centrepiece, and the reason the page exists.
 *
 * ## Two bands, because the details band restated the page
 *
 * This page carried the `DetailBand` all four asset pages share, with six rows under
 * the shelf. Five of them were already on the screen:
 *
 * - `Rectifier capacity` is the strip's own first column, an inch above.
 * - `Rectifiers — 6 × 4 kW` and `Solar Supply Units — 4` are the shelf band's
 *   caption, which reads `6 rectifiers of 4 kW · 4 Solar Supply Units`.
 * - `Monitoring unit` and `Modbus slave` are the Monitoring unit bay's own panel — its
 *   identity line and its `Slave 32` badge — one click into the drawing above.
 *
 * So it was a third statement of facts the strip and the caption already make, sitting
 * below the drawing that is the reason to open the page. The divider above it went with
 * it: a rule that separates nothing is just a line.
 *
 * ## The sixth row, which did not have another home
 *
 * `Shelf make-up` — `Counted on site` against `Sized from the plant` — and it is worth
 * being exact rather than claiming a clean removal. It said whether the module counts
 * came off a device or out of `shelf.ts`, and `SubrackCabinet.shelf` argues that a
 * reader must be told that *before* acting on a count.
 *
 * It is not lost today because it was a constant: all four cabinets in this estate are
 * `READ`, so the row printed `Counted on site` on every page that could show it. The
 * `Sized from the plant, not counted` wording still exists on the SMU bay's panel, but
 * only in the branch where no unit is fitted, and `CabinetDetailShell` states it only
 * inside the rail's tooltip.
 *
 * **The day a sized cabinet is drawn, that needs a visible home** — the shelf band's
 * caption is the natural one, beside the counts it qualifies. `shelfLayoutFits` no
 * longer requires `shelf === 'READ'`, so a sized cabinet reaching the elevation is a
 * change away rather than impossible; it is only the estate that makes it moot.
 *
 * ## The middle band used to be two
 *
 * There was a hero `TickGauge` between the strip and the shelf, reading `Tower load
 * against shelf capacity` — 5 kW of 24. Then there were three badges where the dial
 * had been: which group was carrying, the enclosure temperature, and `79% headroom`.
 * Both are gone, and the shelf moved up into the space.
 *
 * **Almost everything they said was already in the strip an inch above.** The dial's
 * load is the `Bus output` column and its ceiling is `Rectifier capacity`, so the
 * needle sat a fifth of the way round two numbers already printed. The temperature
 * badge repeated the `Enclosure` column outright. The headroom was the ratio of the
 * strip's first two columns — genuinely useful phrased as a percentage, and still one
 * division away from a reader who wants it.
 *
 * **The dial was also pointing at a hypothetical.** A dial has to point at something,
 * and what this cabinet is passing is nothing for most of the day — the array carries
 * by day and the bank by night — so it was drawn against *what the shelf could take
 * if the sun went in*. An arc looks like a measurement of now, which that was not.
 *
 * **One thing they said had no other home**, and it is the first question anybody
 * opens this page with: which of the three sources is actually feeding the tower. A
 * bus output of 5 kW does not say. That clause now leads the shelf band's own
 * caption, which is where it belonged — it is a fact about the shelf, and the bays
 * drawn under it agree with it to the kilowatt. See `CABINET_CARRYING_LABEL`.
 *
 * What is left is a page whose middle is the cabinet itself, at the size a drawing
 * needs to be read against the open door, rather than a dial and three chips in front
 * of it.
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

      <SubrackShelf cabinet={cabinet} />
    </div>
  );
};
