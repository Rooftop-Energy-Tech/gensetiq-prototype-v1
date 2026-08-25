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
  solarKwh: number;
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
  // Capped at what the site can actually use. Spill is real at a solar site and
  // reporting it as generation would flatter the array — this is energy served,
  // not energy that fell on the roof.
  const solarKwh = Math.min(
    generationKwh,
    Math.round(plant.pvKwp * sunHours * PERFORMANCE_RATIO * WINDOW_DAYS),
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
    solarKwh,
    gensetKwh,
    mainsKwh,
    litres,
    baselineLitres,
    solarShare: generationKwh > 0 ? solarKwh / generationKwh : 0,
    gensetHours,
  };
};

export type EstateEnergy = {
  /** Sites carrying a battery — the ones this screen has anything to say about. */
  hybridSites: number;
  solarSites: number;
  dieselSites: number;
  solarKwh: number;
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
    gensetKwh,
    litres,
    baselineLitres,
    displacedLitres: Math.max(0, baselineLitres - litres),
    solarShare: generation > 0 ? solarKwh / generation : 0,
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
