import {LITRES_PER_KWH, sfcLitresPerKwh} from '@/modules/genset/data/detail';
import {spread, spreadBetween} from '@/modules/genset/data/spread';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {customer} from './customers';
import {SITE_SEED, siteSeed} from './siteSeed';
import type {SiteSeed} from './siteSeed';

/**
 * The hybrid plant at each site, and what it has done with the last thirty days.
 *
 * ## What this module is for
 *
 * The mobile-fleet build answers one question about power: is the machine
 * turning. That is the whole question when the machine is the only source. On
 * this estate three of the four configurations have something else on the bus, so
 * the question becomes **what carried the load**, and nothing in the genset module
 * can answer it — a controller reports its own output and knows nothing about the
 * array on the roof beside it.
 *
 * ## Everything here is derived from four givens
 *
 * The site's `loadKw`, its `powerRole`, its region's `peakSunHours`, and the
 * genset's own fuel curve. Nothing about the plant is seeded separately, and that
 * is deliberate rather than economical: a seeded PV size and a seeded solar share
 * can disagree, and the first thing a reader does with a hybrid dashboard is check
 * whether the second follows from the first.
 *
 * So the chain runs one way only:
 *
 *   load → daily energy → array size → generation → what the genset still owes →
 *   litres → litres a diesel-only site would have burned → the saving.
 *
 * Every figure on the energy screen is a link in that chain, which is why the
 * screen can show its own working.
 *
 * ## Why the fuel arithmetic reuses the genset's curve
 *
 * `sfcLitresPerKwh` is the module-wide statement that a diesel burns worse the
 * lighter it is loaded, and it is what the run log, the tank ladder and the
 * current-run card all cost their fuel with. The hybrid saving is **that same
 * curve read twice** — once at the loading a genset holds while charging a
 * battery, once at the loading it holds carrying a tower directly — so the saving
 * this module reports and the burn rate a genset's own page shows cannot drift
 * apart. A second constant here would have made the headline number on the demo
 * the one figure in the app that reconciles against nothing.
 *
 * ## The seam, stated rather than hidden
 *
 * This is a **site** model and the run log is a **machine** model, and the two are
 * not reconciled. `history.ts` deals every genset a run log from a hash of its
 * id — it knows nothing about arrays or banks — so a solar-hybrid site's genset
 * has a history in which it ran like any other machine, and the thirty-day
 * figures here say it barely ran at all.
 *
 * Reconciling them properly means the run log becoming a function of the site's
 * configuration, which is the right shape and a larger change than this white
 * label. Until then the rule is that the two never appear on one screen: `/energy`
 * and the site pages read this module, the run log and the tank chart read
 * `history.ts`, and no figure is derived from both.
 *
 * These are **mock sites**, the same standing as every other figure in this
 * prototype. The arithmetic is real; the estate is not.
 */

const HOURS_PER_DAY = 24;
const WINDOW_DAYS = 30;

/**
 * How much of a PV array's nameplate reaches the bus over a year.
 *
 * Soiling, temperature derate, cabling, inverter efficiency. 0.78 is the ordinary
 * design assumption for a fixed rooftop array in this climate, and it is applied
 * once here rather than folded into the sun hours, because the two are different
 * kinds of fact: sun hours are the weather, the ratio is the equipment.
 */
const PERFORMANCE_RATIO = 0.78;

/**
 * Round-trip efficiency of the battery, charge to discharge.
 *
 * Lithium iron phosphate with its own converter, so 0.9 rather than the 0.7 a
 * lead-acid bank would give. It is why generation always exceeds the load: some
 * of every kilowatt-hour is spent getting into and out of storage.
 */
const ROUND_TRIP = 0.9;

/**
 * The share of the load that never goes near the battery.
 *
 * At a solar site the array feeds the tower directly through the middle of the
 * day and only the surplus is stored; at a diesel-hybrid site the genset carries
 * the tower while it charges. Either way roughly a third of the day's energy
 * takes the direct path and pays no storage loss, which is what this fraction is
 * for.
 */
const DIRECT_SHARE = 0.35;

/** Loading a genset holds while charging a battery bank — near its best point. */
const CHARGING_LOAD_FRACTION = 0.78;

/**
 * A poor year as a share of the design year.
 *
 * The P90 is the yield exceeded in nine years out of ten, and 0.9 of the P50 is
 * the ratio this group's own design work uses. It is a **band**, not a second
 * target: an array between the two is having ordinary weather.
 */
const P90_OF_P50 = 0.9;

/**
 * How much of its design yield this array is actually achieving, `0`–`1`+.
 *
 * The one figure here that is **not** derived from anything, because in a real
 * deployment it is not derived either: it is the gap between a simulation and a
 * roof, and every cause of it is site-specific. Soiling nobody has washed off, a
 * string that tripped in March, a tree that has grown, an inverter derating in
 * the heat, or a design that was simply optimistic about the shading.
 *
 * Spread 0.76–1.06 from the site id, so the estate has arrays over their number
 * as well as under it, and two of the four fall below the P90 band. That spread
 * is the whole reason the column is worth having: a page where every array reads
 * 100% of design is a page reporting the design, and the array is what somebody
 * has to go and look at.
 */
const solarPerformance = (seed: SiteSeed, role: SitePowerRole): number =>
  hasSolar(role) ? spreadBetween(seed.id, 'hybrid/array-health', 0.76, 1.06) : 1;

export type HybridPlant = {
  /** PV array nameplate, kWp. `0` where no array is fitted. */
  pvKwp: number;
  /** Usable battery energy, kWh. `0` where no bank is fitted. */
  batteryKwh: number;
  /** Hours the bank alone can carry the site from full. */
  autonomyHours: number;
};

/**
 * What is fitted at this site.
 *
 * ## Why the array is sized to a *share* of the load rather than to all of it
 *
 * An array big enough to carry a tower through the worst week of the monsoon is
 * two to three times the one that carries it through an ordinary week, and the
 * whole of that difference is spilled for most of the year. Nobody builds that.
 * They build for two-thirds to three-quarters of the annual energy and leave the
 * genset to cover the rest, which is precisely why these sites are called hybrids
 * and still have a genset bolted to the plinth.
 *
 * The share varies 0.62–0.78 across the estate, from `spread()` on the site id, so
 * the solar column has a spread to read rather than one repeated number.
 *
 * ## Why the bank is sized in hours
 *
 * Because that is how the network team specifies it. A site is quoted an
 * autonomy — how long the tower stays up with nothing generating — and the
 * kilowatt-hours follow from the load. A diesel hybrid is given 10–14 hours,
 * enough to hold the tower between two charging blocks. A solar hybrid is given
 * 16–20, because it has to cover a night and part of a dull morning.
 */
export const hybridPlant = (seed: SiteSeed, role: SitePowerRole): HybridPlant => {
  if (!hasBattery(role)) return {pvKwp: 0, batteryKwh: 0, autonomyHours: 0};

  const autonomyHours = hasSolar(role)
    ? spreadBetween(seed.id, 'hybrid/autonomy-solar', 16, 20)
    : spreadBetween(seed.id, 'hybrid/autonomy-diesel', 10, 14);

  const batteryKwh = Math.round(seed.loadKw * autonomyHours);

  if (!hasSolar(role)) {
    return {pvKwp: 0, batteryKwh, autonomyHours: Math.round(autonomyHours)};
  }

  const solarShare = spreadBetween(seed.id, 'hybrid/solar-share', 0.62, 0.78);
  const dailyLoadKwh = seed.loadKw * HOURS_PER_DAY;
  const sunHours = customer(seed.customer).peakSunHours;
  const pvKwp = Math.round((dailyLoadKwh * solarShare) / (sunHours * PERFORMANCE_RATIO));

  return {pvKwp, batteryKwh, autonomyHours: Math.round(autonomyHours)};
};

/**
 * What the plant is doing right now — the figures the site diagram puts under
 * its solar and battery nodes.
 *
 * The hour of day is the only input that is not a given about the site, and it is
 * read once per call rather than held, so the page shows the estate at the moment
 * it was opened. A solar site at 03:00 correctly shows an array making nothing and
 * a bank carrying the tower, which is the state most of a demo's audience has
 * never seen drawn.
 */
export type HybridState = {
  /** What the array is making, kW. `0` at night and at sites with no array. */
  solarKw: number;
  /** State of charge, `0`–`1`. */
  soc: number;
  /** Positive while the bank discharges into the bus, negative while charging. */
  batteryKw: number;
};

/**
 * A day's solar profile as a fraction of nameplate, by hour.
 *
 * A half-sine between first and last light rather than a bell curve fitted to
 * anything: the point is that the shape is *right* — nothing before 07:00,
 * nothing after 19:00, a peak near one o'clock — not that the 14:00 value is
 * accurate to a percent. Integrated across the day it comes to roughly the peak
 * sun hours the region is quoted, which is the only property the rest of this
 * module depends on.
 */
const solarFractionAt = (hour: number): number => {
  const FIRST_LIGHT = 7;
  const LAST_LIGHT = 19;
  if (hour < FIRST_LIGHT || hour > LAST_LIGHT) return 0;
  return Math.sin(((hour - FIRST_LIGHT) / (LAST_LIGHT - FIRST_LIGHT)) * Math.PI);
};

export const hybridState = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): HybridState => {
  const plant = hybridPlant(seed, role);
  if (plant.batteryKwh === 0) return {solarKw: 0, soc: 0, batteryKw: 0};

  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  // Peak output is the array's nameplate taken down by the same performance ratio
  // the annual figures use, so the instantaneous reading and the monthly total
  // cannot disagree about what the same array is capable of.
  const solarKw =
    Math.round(plant.pvKwp * PERFORMANCE_RATIO * solarFractionAt(hour) * 10) / 10;

  // Charge follows the day at a solar site and the charging block at a diesel
  // hybrid. Both are shaped rather than dealt, because a state of charge that
  // jumped on reload would be the one figure on the page a reader could catch
  // lying. The site's own offset spreads the estate out so the bank levels are
  // not all in step.
  const offset = spread(seed.id, 'hybrid/soc-offset') * 4;
  const cycle = hasSolar(role)
    ? // Lowest just before first light, highest in the late afternoon.
      0.5 - 0.5 * Math.cos(((hour - 6 + offset) / 24) * 2 * Math.PI)
    : // Two charging blocks a day, so two peaks.
      0.5 - 0.5 * Math.cos(((hour + offset) / 12) * 2 * Math.PI);

  // Never a full bank and never an empty one: a lithium bank is held inside its
  // window, and a demo that showed 100% would be showing a system with nowhere to
  // put the next kilowatt-hour.
  const soc = 0.42 + cycle * 0.46;

  const batteryKw =
    solarKw > seed.loadKw
      ? // Surplus above the tower's draw goes into the bank.
        -Math.round((solarKw - seed.loadKw) * 10) / 10
      : Math.round((seed.loadKw - solarKw) * 10) / 10;

  return {solarKw, soc, batteryKw};
};

/**
 * Thirty days of energy at one site, and the diesel it did or did not cost.
 *
 * `solarKwh` and `gensetKwh` are **generation**, not what served the load. They
 * add up to more than the load did, and the difference is the storage loss —
 * which is the honest way to draw it: a battery is not a source, it is a delay.
 * An earlier sketch of this reported a three-way "solar / battery / diesel" split
 * of the load, and it double-counted every kilowatt-hour that passed through the
 * bank.
 */
export type SiteEnergy = {
  /** What the tower drew, kWh. */
  loadKwh: number;
  /** Generation that had to be raised to serve it, load plus storage losses. */
  generationKwh: number;
  /**
   * What the design says this array should make in the window — the **P50**.
   *
   * The benchmark, and the reason it is a separate field from `solarKwh` below.
   * An array's output on its own says nothing: 8,700 kWh is excellent from a
   * 24 kWp array in Kedah and poor from a 40 kWp one. The figure only becomes a
   * judgement beside the yield the array was bought on, which is the design
   * simulation's — the same P50 an EPC's PVSyst report quotes and the same one
   * SolarIQ benchmarks a rooftop against.
   *
   * Monthly rather than hourly, deliberately: a design yield is a monthly figure
   * and quoting one by the hour claims a resolution the simulation never had.
   */
  expectedSolarKwh: number;
  /**
   * The same design, in a poor year — **P90**, taken as 0.9 of the P50.
   *
   * Carried because an array running below its P50 is only a fault if it is also
   * below this. One dull month inside the P50–P90 band is weather; below P90 is
   * something on the roof.
   */
  p90SolarKwh: number;
  /** What the array actually made, kWh — the meter, not the design. */
  solarKwh: number;
  /** `(actual − P50) ÷ P50`. Negative is a shortfall. */
  solarVariance: number;
  gensetKwh: number;
  /** Grid import, kWh — only ever non-zero at a grid-backed site. */
  mainsKwh: number;
  /** Diesel the genset actually burned, litres. */
  litres: number;
  /**
   * Diesel this site would have burned as a plain diesel-prime site, litres.
   *
   * The comparison the whole hybrid case rests on, and it is not simply "more
   * litres for more kilowatt-hours". A prime genset runs continuously at whatever
   * a tower happens to draw, which on a 20 kVA set against a 5 kW tower is about a
   * third of nameplate — well down the part-load curve. A hybrid's genset runs in
   * blocks near its best point. So the same energy costs materially different
   * diesel, and most of the saving at a *diesel* hybrid comes from that rather
   * than from generating less.
   */
  baselineLitres: number;
  /** Solar's share of generation, `0`–`1`. */
  solarShare: number;
  /** Engine hours over the window. */
  gensetHours: number;
};

/**
 * The loading a genset holds at this site while it is running.
 *
 * At a hybrid it is charging, so it sits near its best point by design. At a
 * prime or grid-backed site it carries the tower and takes whatever loading that
 * happens to be — which is the number the saving is argued from, so it is derived
 * from the two real figures rather than assumed.
 */
const runningLoadFraction = (seed: SiteSeed, role: SitePowerRole, ratedKw: number): number => {
  if (hasBattery(role)) return CHARGING_LOAD_FRACTION;
  return ratedKw > 0 ? Math.min(1, seed.loadKw / ratedKw) : CHARGING_LOAD_FRACTION;
};

/**
 * @param ratedKw Nameplate of the plant standing at this site, from the fleet.
 *   Passed in rather than read here, because this module knows about places and
 *   the fleet knows about machines — and a site with nothing fitted has to be
 *   able to report its energy anyway.
 */
export const siteEnergy = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
): SiteEnergy => {
  const loadKwh = seed.loadKw * HOURS_PER_DAY * WINDOW_DAYS;

  // Generation has to cover the load plus whatever the stored share loses on the
  // way through. A site with no bank loses nothing, which is why this collapses to
  // the load itself at a prime or grid-backed site.
  const storedShare = hasBattery(role) ? 1 - DIRECT_SHARE : 0;
  const generationKwh = Math.round(
    loadKwh * (1 - storedShare) + (loadKwh * storedShare) / ROUND_TRIP,
  );

  const plant = hybridPlant(seed, role);
  const sunHours = customer(seed.customer).peakSunHours;

  // The design's own number: nameplate × sun hours × performance ratio × days.
  // Capped at what the site can actually use, because spill is real at a solar
  // site and counting it would flatter the array — this is energy the tower could
  // take, not energy that fell on the roof.
  const expectedSolarKwh = Math.min(
    generationKwh,
    Math.round(plant.pvKwp * sunHours * PERFORMANCE_RATIO * WINDOW_DAYS),
  );

  // What it actually made. `solarPerformance` is the gap between a design and a
  // roof — see its own note — and the genset below picks up whatever the array
  // did not, so an underperforming site burns more diesel and its payback moves.
  // That chain is the point of measuring against a benchmark at all.
  // Clamped at the generation the site can absorb, for the same reason the design
  // figure above it is: an array beating its number at a site with no headroom is
  // spilling the difference, and counting spill would report generation no meter
  // downstream of it ever saw.
  const solarKwh =
    expectedSolarKwh === 0
      ? 0
      : Math.min(
          generationKwh,
          Math.round(expectedSolarKwh * solarPerformance(seed, role)),
        );

  // The grid carries a backed-up site apart from the few hours a year it doesn't.
  // 0.4% is roughly a day and a half of outage across a month, which is the order
  // of a Malaysian distribution feeder in a bad month.
  const mainsKwh = role === 'GRID_BACKUP' ? Math.round(generationKwh * 0.996) : 0;
  const gensetKwh = Math.max(0, generationKwh - solarKwh - mainsKwh);

  const loadFraction = runningLoadFraction(seed, role, ratedKw);
  const litres = Math.round(gensetKwh * sfcLitresPerKwh(loadFraction));

  // The baseline is this site as a diesel-prime one: the genset carries the tower
  // continuously, at the loading the tower actually imposes on it, with no bank to
  // let it run anywhere better. Where no plant is fitted the fallback is the flat
  // curve — a figure that is honest about knowing nothing rather than one that
  // quietly assumes the worst case and inflates the saving.
  const baselineFraction = ratedKw > 0 ? Math.min(1, seed.loadKw / ratedKw) : 0.75;
  const baselineLitres =
    role === 'GRID_BACKUP'
      ? litres
      : Math.round(loadKwh * (ratedKw > 0 ? sfcLitresPerKwh(baselineFraction) : LITRES_PER_KWH));

  // Engine hours follow from the energy and the loading, which is the only way
  // they can agree with the litres above them.
  const gensetHours =
    ratedKw > 0 && loadFraction > 0
      ? Math.round(gensetKwh / (ratedKw * loadFraction))
      : 0;

  return {
    loadKwh: Math.round(loadKwh),
    generationKwh,
    expectedSolarKwh,
    p90SolarKwh: Math.round(expectedSolarKwh * P90_OF_P50),
    solarKwh,
    solarVariance:
      expectedSolarKwh === 0 ? 0 : (solarKwh - expectedSolarKwh) / expectedSolarKwh,
    gensetKwh,
    mainsKwh,
    litres,
    baselineLitres,
    solarShare: generationKwh > 0 ? solarKwh / generationKwh : 0,
    gensetHours,
  };
};

export type EstateEnergy = {
  /** Sites with a battery — the ones this screen has anything to say about. */
  hybridSites: number;
  solarSites: number;
  dieselSites: number;
  solarKwh: number;
  /** The design yield those arrays were bought on, over the same window. */
  expectedSolarKwh: number;
  /** Actual against design, `0`–`1`+. Below 0.9 is below the P90 band. */
  solarYield: number;
  gensetKwh: number;
  litres: number;
  baselineLitres: number;
  /** Litres the hybrid plant did not burn, over the window. */
  displacedLitres: number;
  /** Solar's share of off-grid generation, `0`–`1`. */
  solarShare: number;
};

/**
 * The same arithmetic across the estate, for the overview's energy band.
 *
 * **Grid-backed sites are excluded from every figure here.** They burn almost no
 * diesel and generate almost nothing, so including them would divide a real
 * saving by a pile of sites the programme was never about and report a number
 * that falls every time the carrier builds a tower in a town.
 */
export const estateEnergy = (
  roles: Record<string, SitePowerRole>,
  ratedKwBySite: Record<string, number>,
): EstateEnergy => {
  let solarKwh = 0;
  let expectedSolarKwh = 0;
  let gensetKwh = 0;
  let litres = 0;
  let baselineLitres = 0;
  let hybridSites = 0;
  let solarSites = 0;
  let dieselSites = 0;

  for (const seed of SITE_SEED) {
    const role = roles[seed.id] ?? seed.powerRole;
    if (role === 'GRID_BACKUP') continue;

    if (hasSolar(role)) solarSites += 1;
    if (hasBattery(role)) hybridSites += 1;
    else dieselSites += 1;

    const energy = siteEnergy(seed, role, ratedKwBySite[seed.id] ?? 0);
    solarKwh += energy.solarKwh;
    expectedSolarKwh += energy.expectedSolarKwh;
    gensetKwh += energy.gensetKwh;
    litres += energy.litres;
    baselineLitres += energy.baselineLitres;
  }

  const generation = solarKwh + gensetKwh;

  return {
    hybridSites,
    solarSites,
    dieselSites,
    solarKwh,
    expectedSolarKwh,
    solarYield: expectedSolarKwh > 0 ? solarKwh / expectedSolarKwh : 0,
    gensetKwh,
    litres,
    baselineLitres,
    displacedLitres: Math.max(0, baselineLitres - litres),
    solarShare: generation > 0 ? solarKwh / generation : 0,
  };
};

// ─── The benchmark chart's series ────────────────────────────────────────────

/**
 * How much of a year's irradiance falls in each month, as a multiple of the
 * annual average.
 *
 * Malaysia's seasonality is mild and it is real: the north-east monsoon takes
 * November and December down about a tenth, and February and March are the best
 * months of the year. A design simulation reports its P50 **month by month** for
 * exactly this reason, and a benchmark drawn as one flat line across the year
 * would put every site under its number every December and over it every March.
 *
 * The twelve factors sum to 12, so a year of them comes to the same total as
 * twelve months at the annual-average rate. That is what keeps the chart's yearly
 * figure and the thirty-day one on the tiles above it talking about the same
 * array.
 */
const MONTH_FACTOR = [0.98, 1.06, 1.07, 1.03, 1.01, 1.02, 1.03, 1.02, 0.99, 0.97, 0.92, 0.9];

const DAYS_IN_MONTH = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

export type SolarMonth = {
  /** First of the month, ISO — the key, and what a tooltip stamps. */
  at: string;
  /** `Mar`, and `Mar 26` in January so a twelve-month axis reads unambiguously. */
  label: string;
  /** The design's P50 for this month. */
  expectedKwh: number;
  /** What the array made. Partial in the running month. */
  actualKwh: number;
  /**
   * This month is still running.
   *
   * Carried rather than inferred by the chart, because **an in-progress month must
   * not enter a benchmark comparison**: a month that is eleven days old has made
   * eleven days of energy against a whole month of design, and reporting that as a
   * 64% shortfall is a chart lying about a plant that is fine. It is drawn, hatched,
   * and left out of every total.
   */
  inProgress: boolean;
};

/**
 * When this array's output stepped down, as a month index into the series, or
 * `null` for one that never did.
 *
 * The reason the chart is worth drawing rather than tabulating. An array that has
 * been at 84% of design all year is a commissioning problem; one that was at 100%
 * until May and 70% since is a fault with a date on it, and somebody can go and
 * look at what happened that month. The two are the same annual figure and
 * completely different jobs, and only the series tells them apart.
 *
 * Sites within a few points of their design never stepped: their variance is
 * weather, and inventing an event for it would put a date on noise.
 */
const healthOnsetMonth = (seed: SiteSeed, health: number): number | null =>
  health > 0.95 ? null : 3 + Math.floor(spread(seed.id, 'hybrid/onset') * 6);

/**
 * Twelve months of design against measurement, oldest first.
 *
 * Monthly and no finer. That is the design's own maximum fidelity — a P50 is
 * simulated month by month and a daily benchmark line is a resolution the report
 * never had — and it is the rule SolarIQ settled on after trying to draw one.
 */
export const solarMonths = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): Array<SolarMonth> => {
  const plant = hybridPlant(seed, role);
  if (plant.pvKwp === 0) return [];

  const sunHours = customer(seed.customer).peakSunHours;
  const health = solarPerformance(seed, role);
  const onset = healthOnsetMonth(seed, health);

  const today = new Date(now);
  const months: Array<SolarMonth> = [];

  for (let index = 0; index < 12; index += 1) {
    // Walk back from the running month, so the series always ends on today.
    const cursor = new Date(today.getFullYear(), today.getMonth() - (11 - index), 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const days = DAYS_IN_MONTH(year, month);
    const inProgress = index === 11;

    const expectedKwh = Math.round(
      plant.pvKwp * sunHours * PERFORMANCE_RATIO * days * MONTH_FACTOR[month],
    );

    // Weather on top of the design, and health underneath it. The two are
    // deliberately separate multipliers: one is a month that was cloudier than the
    // simulation assumed, the other is the array itself, and a chart that folded
    // them together could not answer the only question it is asked.
    const weather = spreadBetween(seed.id, `hybrid/weather-${year}-${month}`, 0.93, 1.07);
    const healthNow = onset === null || index < onset ? 1 : health;

    // The running month is prorated to the days it has actually had. It is the one
    // bar on the chart that is not comparable to the one beside it, which is why
    // `inProgress` travels with it.
    const elapsed = inProgress ? today.getDate() / days : 1;

    months.push({
      at: cursor.toISOString(),
      label:
        month === 0
          ? `${cursor.toLocaleDateString('en-MY', {month: 'short'})} ${String(year).slice(2)}`
          : cursor.toLocaleDateString('en-MY', {month: 'short'}),
      expectedKwh,
      actualKwh: Math.round(expectedKwh * weather * healthNow * elapsed),
      inProgress,
    });
  }

  return months;
};

export type SolarYear = {
  expectedKwh: number;
  actualKwh: number;
  /** `(actual − expected) ÷ expected` across the closed months. */
  variance: number;
  /** The month the array stepped down, or `undefined` where it never did. */
  onsetLabel: string | undefined;
};

/**
 * The twelve-month position, over **closed months only**.
 *
 * The running month is excluded from both totals rather than from one of them.
 * Dropping its actual and keeping its design would report a shortfall the size of
 * the month so far, which is the specific way this comparison goes wrong.
 */
export const solarYear = (months: Array<SolarMonth>): SolarYear => {
  const closed = months.filter((month) => !month.inProgress);
  const expectedKwh = closed.reduce((sum, month) => sum + month.expectedKwh, 0);
  const actualKwh = closed.reduce((sum, month) => sum + month.actualKwh, 0);

  // The first month that fell more than a tenth short and never recovered — the
  // step, read back off the series rather than off the seed that produced it, so
  // the label and the bars cannot disagree.
  const onset = closed.findIndex(
    (month, index) =>
      month.actualKwh < month.expectedKwh * 0.9 &&
      closed.slice(index).every((later) => later.actualKwh < later.expectedKwh * 0.95),
  );

  return {
    expectedKwh,
    actualKwh,
    variance: expectedKwh > 0 ? (actualKwh - expectedKwh) / expectedKwh : 0,
    onsetLabel: onset > 0 ? closed[onset].label : undefined,
  };
};

/** One site's energy by id, for callers holding only the id. */
export const siteEnergyById = (
  siteId: string,
  role: SitePowerRole,
  ratedKw: number,
): SiteEnergy | undefined => {
  const seed = siteSeed(siteId);
  return seed === undefined ? undefined : siteEnergy(seed, role, ratedKw);
};
