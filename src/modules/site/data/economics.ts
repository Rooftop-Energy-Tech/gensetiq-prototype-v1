import {spreadBetween} from '@/modules/genset/data/spread';
import {hasBattery} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {hybridPlant, siteEnergy} from './hybrid';
import {SITE_SEED} from './siteSeed';
import type {SiteSeed} from './siteSeed';

/**
 * What the hybrid plant is worth, in ringgit — the case a conversion is actually
 * approved on.
 *
 * ## Why this is a separate module from `hybrid.ts`
 *
 * That one is about **energy**, and every figure in it is physics: irradiance,
 * round-trip efficiency, a fuel curve. This one is about **money**, and every
 * figure in it is a price somebody negotiated. The two ages of those facts are
 * completely different — a fuel curve is good for a decade, a diesel price is good
 * until the next Cabinet meeting — so they are kept apart, and the prices are all
 * in one block at the top of this file where they can be replaced without touching
 * the arithmetic.
 *
 * ## The shape is SolarIQ's, and deliberately
 *
 * SolarIQ answers the same question for a rooftop PV plant against a TNB bill,
 * and it answers it in four figures: what one displaced unit is *actually* worth,
 * savings to date, payback, and ROI to date. That vocabulary is already in front
 * of this group's customers, so it is the vocabulary here, with one substitution:
 * SolarIQ displaces a **bought kilowatt-hour** and this displaces a **burned
 * litre**.
 *
 * The substitution carries SolarIQ's most useful lesson intact. Its point is that
 * the bare tariff understates the saving, because a unit you never buy also avoids
 * the levies charged on it — using 50.68 sen where the real figure is 55.5 sen
 * understated the case by nearly a tenth. The equivalent understatement here is
 * bigger and in the same direction: **a litre of diesel does not cost what it
 * costs at the depot.** It costs that plus getting it up a logging road to Belaga,
 * and a business case built on the pump price is understating a remote site's
 * saving by half.
 *
 * There is a second avoided cost with no SolarIQ counterpart, and it is the reason
 * a *diesel* hybrid pays at all: **an engine that runs a third as many hours needs
 * a third as many services.** Those visits are a van, a fitter and a day, and at
 * the sites where the diesel is dearest the visit is dearest too.
 *
 * ## Every price here is a mock benchmark
 *
 * They are the right order of magnitude and they are not quotations. In a real
 * deployment each one is a contract rate, which is why they sit in a labelled
 * block rather than inline: replacing them is meant to be a five-line edit, not
 * an audit.
 */

// ─── Prices ──────────────────────────────────────────────────────────────────

/** Unsubsidised commercial diesel at the depot, RM per litre. */
const DIESEL_DEPOT_RM = 3.35;

/**
 * What it costs to get one litre from the depot to the site, RM per litre.
 *
 * By region rather than by site, for the reason the sun hours are: it is a
 * haulage fact about a part of the country, and twenty-five copies of six numbers
 * would only wait to disagree. The spread is the whole argument for converting the
 * far sites first — a litre into the Sarawak interior costs more to deliver than
 * it costs to buy.
 */
const DELIVERY_RM: Record<string, number> = {
  central: 0.35,
  northern: 0.45,
  southern: 0.45,
  'east-coast': 0.9,
  sabah: 1.6,
  sarawak: 2.4,
};

/**
 * Engine hours between services.
 *
 * 500 rather than the 250 a standby set's schedule quotes, because these are
 * prime-rated machines on a prime-duty interval. The distinction is worth holding
 * on to: at 250 hours a genset running continuously needs servicing thirty-five
 * times a year, which is a number that makes the hybrid case look better than it
 * is by doubling the term nobody checks. Seventeen visits is the honest figure and
 * still the second-largest line in the saving.
 */
const SERVICE_INTERVAL_HOURS = 500;

/**
 * What one service visit costs, RM — parts, a fitter and the journey.
 *
 * Scaled off the same regional factor the diesel is, because the expensive part of
 * servicing a tower at Belaga is the same thing that makes its diesel expensive:
 * getting there.
 */
const SERVICE_BASE_RM = 900;
const SERVICE_REMOTE_MULTIPLIER = 320;

/** Installed cost of storage, RM per usable kWh. */
const BATTERY_RM_PER_KWH = 1_600;

/** Installed cost of an array, RM per kWp, before the remote uplift. */
const PV_RM_PER_KWP = 3_800;

/** Converter, controller, switchgear, civils and commissioning, RM per site. */
const BALANCE_OF_PLANT_RM = 28_000;

/**
 * How much dearer plant is at a site the crew has to reach.
 *
 * Same regional factor again, applied to the capex rather than to a litre: the
 * remote sites cost more to *build* as well as more to feed, and a case that
 * loaded only one side of that would be flattering itself.
 */
const remoteFactor = (seed: SiteSeed): number => DELIVERY_RM[seed.customer] ?? 0.45;

// ─── Derived rates ───────────────────────────────────────────────────────────

/**
 * What one displaced litre is actually worth at this site, RM.
 *
 * The figure the whole case rests on, and the one most likely to be quoted wrong.
 * SolarIQ's rate card is the model: state the build-up, do not quote the headline.
 */
export const deliveredDieselRm = (seed: SiteSeed): number =>
  DIESEL_DEPOT_RM + (DELIVERY_RM[seed.customer] ?? 0.45);

/** What one service visit costs at this site, RM. */
export const serviceVisitRm = (seed: SiteSeed): number =>
  Math.round(SERVICE_BASE_RM + remoteFactor(seed) * SERVICE_REMOTE_MULTIPLIER);

export type SiteEconomics = {
  /** RM per displaced litre, delivered — the rate the saving is struck at. */
  dieselRm: number;
  /** What the plant cost to build, RM. `0` at a site with none. */
  capexRm: number;
  /** Litres the plant saves in a year. */
  litresPerYear: number;
  /** The diesel half of the annual saving, RM. */
  dieselSavingRm: number;
  /** The servicing half, RM — fewer engine hours, fewer visits. */
  serviceSavingRm: number;
  /** Both halves. */
  annualSavingRm: number;
  /** Years to pay the plant back at that rate. `null` where there is no saving. */
  paybackYears: number | null;
  /** How long the plant has been running, years. `0` where none is fitted. */
  ageYears: number;
  /** Saving banked since it was commissioned, RM. */
  savingToDateRm: number;
  /** That saving as a share of what it cost, `0`–`1`+. */
  roiToDate: number;
  /** Engine-hour reduction against running the site on diesel alone, `0`–`1`. */
  hoursAvoidedShare: number;
};

/**
 * How long ago this site was converted, years.
 *
 * Seeded from the site id like everything else, 0.8–3.4 years, so the estate shows
 * a *programme* rather than a switch thrown one morning — and so ROI to date has a
 * spread down the column instead of one repeated number. A site still on diesel
 * has no plant and no age.
 */
const plantAgeYears = (seed: SiteSeed, role: SitePowerRole): number =>
  hasBattery(role) ? spreadBetween(seed.id, 'econ/plant-age', 0.8, 3.4) : 0;

/**
 * The case for one site.
 *
 * Reads `siteEnergy` rather than restating any of it, so the litres in the money
 * and the litres on the energy screen are the same litres. That is the same rule
 * `hybrid.ts` follows about the fuel curve, one level up: the business case is
 * derived from the engineering, never alongside it.
 *
 * ## The counterfactual, for a site that has not been converted yet
 *
 * A diesel-prime site is costed as though the plant it *would* get were already
 * there — the same sizing rules `hybridPlant` applies to a converted one, on the
 * same load. That is what makes the bottom of the energy table useful rather than
 * a list of sites with nothing to report: the row says what converting this one
 * would cost and what it would pay back, which is the decision actually in front
 * of somebody reading it.
 */
export const siteEconomics = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
): SiteEconomics => {
  const dieselRm = deliveredDieselRm(seed);

  // The plant this site has, or — where it has none — the plant it would be given.
  // `SOLAR_HYBRID` is the proposed configuration for an unconverted site, because
  // it is what the programme is actually installing.
  const proposedRole: SitePowerRole = hasBattery(role) ? role : 'SOLAR_HYBRID';
  const plant = hybridPlant(seed, proposedRole);

  const capexRm = Math.round(
    plant.batteryKwh * BATTERY_RM_PER_KWH +
      plant.pvKwp * PV_RM_PER_KWP * (1 + remoteFactor(seed) * 0.08) +
      BALANCE_OF_PLANT_RM,
  );

  // Thirty days on the plant, against thirty days on diesel alone. `siteEnergy`
  // already returns both — the second is its `baselineLitres` — so the saving is
  // the difference rather than a second model of the same site.
  const withPlant = siteEnergy(seed, proposedRole, ratedKw);
  const asDiesel = siteEnergy(seed, 'DIESEL_PRIME', ratedKw);

  const YEAR_OVER_WINDOW = 365 / 30;
  const litresPerYear = Math.round((asDiesel.litres - withPlant.litres) * YEAR_OVER_WINDOW);
  const dieselSavingRm = Math.round(litresPerYear * dieselRm);

  const hoursAvoided = Math.max(0, asDiesel.gensetHours - withPlant.gensetHours);
  const serviceSavingRm = Math.round(
    ((hoursAvoided * YEAR_OVER_WINDOW) / SERVICE_INTERVAL_HOURS) * serviceVisitRm(seed),
  );

  const annualSavingRm = dieselSavingRm + serviceSavingRm;
  const ageYears = plantAgeYears(seed, role);
  const savingToDateRm = Math.round(annualSavingRm * ageYears);

  return {
    dieselRm,
    // A site with no plant reports the capex of the plant it would get, which is
    // the point of the row. The distinction a reader needs is carried by the
    // configuration column beside it, not by zeroing a figure they came for.
    capexRm,
    litresPerYear,
    dieselSavingRm,
    serviceSavingRm,
    annualSavingRm,
    paybackYears: annualSavingRm > 0 ? capexRm / annualSavingRm : null,
    ageYears,
    savingToDateRm,
    roiToDate: capexRm > 0 ? savingToDateRm / capexRm : 0,
    hoursAvoidedShare: asDiesel.gensetHours > 0 ? hoursAvoided / asDiesel.gensetHours : 0,
  };
};

export type EstateEconomics = {
  /** Capex committed to plant that is actually built, RM. */
  capexDeployedRm: number;
  /** What the built plant saves in a year, RM. */
  annualSavingRm: number;
  /** Banked since each site was commissioned, RM. */
  savingToDateRm: number;
  /** Capex ÷ annual saving across the built plant, years. */
  paybackYears: number | null;
  /** Saving to date ÷ capex deployed. */
  roiToDate: number;
  /** What converting every remaining diesel site would cost, RM. */
  pipelineCapexRm: number;
  /** And what it would save each year, RM. */
  pipelineSavingRm: number;
  pipelineSites: number;
};

/**
 * The estate's case, split between **what is built** and **what is left**.
 *
 * The split is the whole design of this type. One blended payback across built and
 * unbuilt plant answers a question nobody asked: the reader is either reporting on
 * the sites that are running, or asking for money for the ones that are not, and
 * a single number serves neither. So the return carries both, and the screen keeps
 * them in separate bands.
 */
export const estateEconomics = (
  roles: Record<string, SitePowerRole>,
  ratedKwBySite: Record<string, number>,
): EstateEconomics => {
  let capexDeployedRm = 0;
  let annualSavingRm = 0;
  let savingToDateRm = 0;
  let pipelineCapexRm = 0;
  let pipelineSavingRm = 0;
  let pipelineSites = 0;

  for (const seed of SITE_SEED) {
    const role = roles[seed.id] ?? seed.powerRole;
    if (role === 'GRID_BACKUP') continue;

    const economics = siteEconomics(seed, role, ratedKwBySite[seed.id] ?? 0);

    if (hasBattery(role)) {
      capexDeployedRm += economics.capexRm;
      annualSavingRm += economics.annualSavingRm;
      savingToDateRm += economics.savingToDateRm;
    } else {
      pipelineCapexRm += economics.capexRm;
      pipelineSavingRm += economics.annualSavingRm;
      pipelineSites += 1;
    }
  }

  return {
    capexDeployedRm,
    annualSavingRm,
    savingToDateRm,
    paybackYears: annualSavingRm > 0 ? capexDeployedRm / annualSavingRm : null,
    roiToDate: capexDeployedRm > 0 ? savingToDateRm / capexDeployedRm : 0,
    pipelineCapexRm,
    pipelineSavingRm,
    pipelineSites,
  };
};

/** `RM 1.2m`, `RM 84,300` — the scale a reader compares at, without the noise. */
export const ringgit = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 10_000) return `RM ${Math.round(value / 1_000)}k`;
  return `RM ${Math.round(value).toLocaleString('en-MY')}`;
};

/** `4.2 yr`, or the word for a site that never pays back. */
export const payback = (years: number | null): string =>
  years === null ? 'never' : `${years.toFixed(1)} yr`;
