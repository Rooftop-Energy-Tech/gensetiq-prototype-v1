import {spreadBetween} from '@/modules/genset/data/spread';
import {
  solarIntraday,
  solarMonths,
  solarRecent,
  solarYear,
  todayFullKwh,
  todaySoFarKwh,
} from '@/modules/site/data/hybrid';
import {siteSeed} from '@/modules/site/data/siteSeed';
import type {SolarMonth, SolarPoint, SolarYear} from '@/modules/site/data/hybrid';
import type {InverterReading} from '../types/reading.type';
import type {SolarSystem} from '../types/system.type';

/**
 * Everything the **system's** page draws that is not one box's readings.
 *
 * The split between this file and `inverterDetail.ts` is the model correction
 * restated as two modules: this holds what the *system* is — its energy, its
 * twelve months against design, its glass — and that holds what a *box* reports.
 * Nothing here is instantaneous, and nothing there survives a comms failure.
 *
 * ## The rule this file obeys
 *
 * **Nothing here invents a quantity `hybrid.ts` already has an opinion about.**
 * Today's energy, the twelve months and the step-down all come from there, so the
 * system page, the site page and the generation report are three readings of one
 * model rather than three datasets that happen to agree today.
 */

export type SystemToday = {
  /** kWh since first light. */
  generatedKwh: number;
  /** What the whole day is on course for, kWh. */
  fullDayKwh: number;
  /** The curve, and the system's own recent normal beside it. */
  points: Array<SolarPoint>;
};

export type SystemDetail = {
  today: SystemToday;
  months: Array<SolarMonth>;
  year: SolarYear;
  /** The last three closed months — the operational window, not the reporting one. */
  recent: SolarYear;
  /** Recent generation over recent design, `0`–`1`+. */
  share: number;
  /**
   * The system's own readings — every one of them this app's arithmetic or a fact
   * about glass, and not one of them an inverter's. That is why they survive a
   * silence when the dials on a box's page do not.
   */
  readings: Array<InverterReading>;
  /** The first of the month the system stepped down, ISO, or `undefined`. */
  onsetAt: string | undefined;
};

/**
 * A wash is due at four months, and the days since one are a fact about the
 * modules rather than about any box under them — which is why this lives here and
 * not on an inverter.
 */
export const daysSinceClean = (systemId: string): number =>
  Math.round(spreadBetween(systemId, 'system/cleaned', 12, 190));

export const systemDetail = (
  system: SolarSystem,
  now: number = Date.now(),
  /**
   * The intraday curve is the expensive part of this call and the register never
   * draws it. Passing `false` there is what keeps a page that is meant not to grow
   * with the estate from integrating a day's shape once per row.
   */
  includeCurve = true,
): SystemDetail | undefined => {
  const seed = siteSeed(system.siteId);
  if (seed === undefined) return undefined;

  const {role} = system;
  const months = solarMonths(seed, role, now);
  const year = solarYear(months);
  const recent = solarRecent(months);
  const share = recent.expectedKwh > 0 ? recent.actualKwh / recent.expectedKwh : 0;

  // A system nobody can hear reported no energy today, and the page says so
  // rather than printing the model's.
  //
  // `hybrid.ts` will happily produce a day's generation for this site, because it
  // models a site's plant and knows nothing about whether anything is listening —
  // the same seam the README names between `history.ts` and `hybrid.ts`, met from
  // the other side. Publishing that under a card reading "nothing has been heard"
  // would be the page arguing with itself in two sentences.
  //
  // Only when **every** box is silent. One quiet inverter in ten does not blank
  // the system's day; it shows up as a hole in `reportingKwp` and an alert with
  // an address.
  const reporting = system.state !== 'OFFLINE';
  const generatedKwh = reporting ? todaySoFarKwh(seed, role, now) : 0;
  const fullDayKwh = reporting ? todayFullKwh(seed, role, now) : 0;

  const curve = includeCurve ? solarIntraday(seed, role, now) : [];
  const cleaned = daysSinceClean(system.id);

  const onset = year.onsetLabel;
  const onsetAt =
    onset === undefined ? undefined : months.find((month) => month.label === onset)?.at;

  return {
    today: {
      generatedKwh,
      fullDayKwh,
      // The curve keeps its `typicalKw` baseline even on a silent system, which is
      // the right picture: here is what this system does on an ordinary day, and
      // here is the nothing we know about today.
      points: reporting ? curve : curve.map((point) => ({...point, kw: null})),
    },
    months,
    year,
    recent,
    share,
    readings: [
      {
        key: 'specific-yield',
        /**
         * kWh per kWp, and deliberately **not a performance ratio**.
         *
         * A PR is today's energy over what the nameplate would make in the day's
         * peak sun hours. Drawn on this estate it comes out near 48%, against a
         * design that assumed 0.8 — and the gap is not a fault. `siteEnergy` caps
         * the design figure *and* the measurement at what the site can absorb
         * ("spill is real at a solar site and counting it would flatter the
         * array"), and `hybridPlant` sizes these systems to two-thirds of a
         * tower's annual energy, so a good part of a clear midday is spilled by
         * construction.
         *
         * So an honest PR and an honest "83% of design" are both right and differ
         * by thirty points, because one is measured against the roof and the other
         * against a design that already knows about the ceiling. Printing them one
         * above the other puts two figures on a page a reader would expect to
         * agree and which cannot, with nothing to say which to trust. kWh/kWp
         * states the same measurement without asserting the comparison.
         */
        label: 'Specific yield, today',
        value: reporting && system.kwp > 0 ? Math.round((fullDayKwh / system.kwp) * 100) / 100 : 0,
        unit: 'kWh/kWp',
        precision: 2,
        kind: 'windowed',
        daylightOnly: false,
      },
      {
        key: 'yield-vs-design',
        label: 'Generated against design, three months',
        value: Math.round(share * 1000) / 10,
        unit: '%',
        precision: 1,
        kind: 'windowed',
        daylightOnly: false,
      },
      {
        key: 'days-since-clean',
        label: 'Days since last clean',
        value: cleaned,
        unit: 'days',
        // A counter that can only go up until somebody resets it with a hose. Its
        // trend is a ramp that says nothing, so it stays off every trace for the
        // same reason `engine-hours` does.
        kind: 'cumulative',
        daylightOnly: false,
      },
    ],
    onsetAt,
  };
};
