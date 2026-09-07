import type {CustomerId} from '@/modules/site/data/customers';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * One battery bank: the storage at a site, taken together.
 *
 * ## Why the bank and not the rack
 *
 * The same unit argument `system.type.ts` makes about a solar system. Nobody at
 * this operator says "we have four hundred and twelve battery modules"; they say
 * "SBH-1495 has sixteen hours of autonomy". The bank is what is specified, what is
 * quoted, what is commissioned and what fails — a module is a part inside it, and a
 * register with a row per module would be a stores list rather than an estate.
 *
 * Solar used to go one level deeper, because a PV system with inverters has
 * independently addressable boxes: one reported on its own, could be silent while
 * its neighbours were not, and had its own page. A telco array has none — it feeds
 * a −48 V DC bus and there is no AC stage to invert to — so a system is the leaf
 * there now, exactly as a bank is here. A rack in a bank has no such life in this
 * model either: there is one BMS, one converter and one state of charge, so the
 * bank is the leaf, and `modules` below is a count rather than a list of things
 * with identities.
 *
 * ## Everything here is derived
 *
 * Nothing about a bank is seeded. `hybridPlant` sizes it from the site's load and
 * the autonomy its configuration is specified at, `hybridState` says where its
 * charge stands, and the two nameplate extras below follow from the capacity. That
 * is the estate's rule and it is what stops the diagram's `88% charged`, the site
 * page's device row and this page from being three numbers that can disagree.
 */
export type BatteryBank = {
  /** The bank's id, which is its site's — one bank per site in this model. */
  id: string;
  siteId: string;
  /** The site's own name — `SBH-1495`. */
  siteName: string;
  locationLabel: string;
  /**
   * Where the bank is, and which division owns it.
   *
   * All three are the **site's**, copied down rather than derived: there is one bank
   * per site in this model, so its position is that place's position and its region is
   * that place's region. They are here because the register now has a map and a region
   * filter, and both need the fact on the row rather than a `siteSeed` lookup per
   * cell — the same reason `locationLabel` above was already copied down.
   *
   * A reader can move a site's pin or change its region from its Settings tab, and
   * `banks.ts` reads the seeds live, so these follow.
   */
  latitude: number;
  longitude: number;
  customer: CustomerId;
  role: SitePowerRole;
  /** Usable energy, kWh. */
  kwh: number;
  /** Hours the bank alone can carry the site from full. */
  autonomyHours: number;
  /**
   * State of health, `0`–`1` — what the bank still holds against its nameplate.
   *
   * The bank's *second* percentage, and the one a reader is most likely to take
   * for a version of the first. `soc` below is where the level sits inside the
   * tank right now; this is how big the tank has become after some years of
   * cycling. A bank can read `100%` charged and `81%` healthy at the same time and
   * both are true, which is why the two are never printed side by side.
   *
   * `kwh` above is the **specified** capacity and is not discounted by this — see
   * `HybridPlant.soh` for why. The pair is what makes fade visible instead of it
   * quietly shrinking every other figure on the page.
   */
  soh: number;
  /** How many modules make it up, and what each holds. See `banks.ts`. */
  modules: number;
  moduleKwh: number;
  /** What the converter can pass, kW — the bank's power rating as against its energy. */
  continuousKw: number;
  /** State of charge, `0`–`1`. */
  soc: number;
  /**
   * Hours the bank would carry its site from here, to the point load is shed.
   *
   * `autonomyHours` above is the specification and assumes a full, healthy bank;
   * this is what is actually left. The two are deliberately both on the page — the
   * gap between them is the bank's condition stated in the only unit an operator
   * acts on. See `HybridState.hoursLeft` for what goes into it.
   */
  hoursLeft: number;
  /**
   * Which way the energy is going and at what, kW.
   *
   * `hybridState`'s sign convention, unchanged: **positive while the bank
   * discharges** into the bus, negative while it charges. Carried signed rather
   * than as a magnitude plus a direction flag, for the reason the site module
   * gives about `siteFeed` — two fields can be assembled into a state that cannot
   * happen, and one signed number cannot.
   */
  powerKw: number;
};

/** Charging, discharging, or sitting at rest — what the sign of `powerKw` means. */
export type BankFlow = 'CHARGING' | 'DISCHARGING' | 'IDLE';

/**
 * Below this the bank is called idle rather than given a direction.
 *
 * A bank floating on a bus is never at exactly zero, and a page that read
 * `Discharging | 0.0 kW` at three in the afternoon would be reporting noise as an
 * event. 0.1 kW is under a percent of the smallest converter on this estate.
 */
const REST_KW = 0.1;

export const bankFlow = (bank: BatteryBank): BankFlow => {
  if (Math.abs(bank.powerKw) < REST_KW) return 'IDLE';
  return bank.powerKw < 0 ? 'CHARGING' : 'DISCHARGING';
};

export const BANK_FLOW_LABEL: Record<BankFlow, string> = {
  CHARGING: 'Charging',
  DISCHARGING: 'Discharging',
  IDLE: 'At rest',
};

/** `SBH-1495 | 96 kWh` — what the rail, the breadcrumb and the register all print. */
export const bankName = (bank: BatteryBank): string =>
  `${bank.siteName} | ${Math.round(bank.kwh).toLocaleString('en-MY')} kWh`;
