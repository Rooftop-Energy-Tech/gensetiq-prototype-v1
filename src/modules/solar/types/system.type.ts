import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * What an inverter is *doing*, and why the list is three long.
 *
 * `RUN_STATES` for a machine with no engine, and the parallel is exact on
 * purpose: `GENERATING` is `RUNNING`, `IDLE` is `IDLE`, `OFFLINE` is a box that
 * has stopped talking to us. An operator who has learned the fleet screen's state
 * column has already learned this one.
 *
 * ## Why there is no `CURTAILED`
 *
 * It was drafted and cut. An off-grid system does spill — `hybrid.ts` caps both
 * the design figure and the measurement at what the site can absorb, and says so
 * — but that cap acts on a *thirty-day energy total*, and nothing in the model
 * resolves spill to a moment. The bank's state of charge is held between 0.42 and
 * 0.88 by construction ("never a full bank"), so there is no instant at which
 * this app can honestly say the system is being held back right now.
 *
 * A state the page could show but not derive would be the fifth kind of lie: the
 * one where the header disagrees with the chart under it.
 *
 * ## Why a fault is not a state
 *
 * An inverter with a string down is still generating, at three-quarters of what
 * it should. Folding that into the state would either hide it — `GENERATING`, as
 * though nothing were wrong — or overstate it, `FAULT` on a box making most of
 * its number. It belongs in the health band, where it can carry the date it
 * started and the energy it has cost since.
 */
export const INVERTER_STATES = ['GENERATING', 'IDLE', 'OFFLINE'] as const;

export type InverterState = (typeof INVERTER_STATES)[number];

/**
 * The mode the inverter's controller is in — the left column of its control pad.
 *
 * The genset pad's two words, meaning the same thing: in `AUTO` the box decides
 * (it tracks the maximum power point, derates itself on a hot afternoon, and
 * retries on its own timer after a fault), and in `MANUAL` an engineer has taken
 * it off that leash to work on it.
 */
export type InverterControlMode = 'AUTO' | 'MANUAL';

/**
 * One inverter — **the only part of a PV system that can talk.**
 *
 * This is the correction at the centre of the model. An array is glass, aluminium
 * and cable: passive, unmetered, and incapable of reporting anything. Every
 * reading a solar monitoring product shows — string current, DC bus voltage,
 * heatsink temperature — is an inverter describing what it sees on its own
 * terminals, and the array is inferred from it.
 *
 * So the inverter is the unit of **instrumentation, alarms, control and
 * maintenance**: it has the serial number, the firmware, the warranty, the comms
 * link, and it is the thing that fails and gets swapped. What it is not is the
 * unit of *reporting* — see `SolarSystem`.
 */
export type Inverter = {
  /** `kdh-0431-inv-01`. */
  id: string;
  /** `Inverter 1`. Numbered within its system, which is how site staff refer to them. */
  label: string;
  systemId: string;
  model: string;
  /** The box's AC rating, kW. */
  ratedKw: number;
  /** The DC behind this box, kWp. Above `ratedKw` — see the DC/AC note in `systems.ts`. */
  kwp: number;
  /** How many strings land on its MPPT inputs. */
  strings: number;
  /** How many of those have stopped delivering, for a reason other than the hour. */
  downStrings: number;
  state: InverterState;
  lastUpdated: string;
  /** What it is putting out at this moment, kW. `0` unless `GENERATING`. */
  outputKw: number;
  controlMode: InverterControlMode;
};

/**
 * One solar system: everything PV at a site, taken together.
 *
 * ## Why this is the register's row and the inverter is not
 *
 * Three reasons, and they are about who is reading.
 *
 *  - **It is the unit people name.** Nobody says "we have twenty-two inverters";
 *    they say "we have a 1.3 MW system". `kwp` is what a quote, a contract and a
 *    commissioning certificate are written against.
 *  - **It is the unit generation is reported at.** The energy model sizes and
 *    runs a site's whole plant, so the monthly series, the day's kWh and the
 *    step-down all attach here. Per-inverter energy means nothing unless a box
 *    happens to map onto one plane, which is a coincidence rather than a rule.
 *  - **It is the unit that survives.** Inverters are implementation: swap one and
 *    the system is the same system, with the same contract and the same history.
 *
 * A flat register of inverters would put twenty-two rows from one site into a
 * portfolio list; a register with no way down to a box would leave nobody able to
 * act on the one that failed. Two levels, which is the arrangement `/sites` and
 * `/gensets` already make between a place and its machines.
 *
 * ## `id` is the site's id, and that is a statement about the model
 *
 * `hybridPlant` gives a site **one system and one bank**, so today a system has no
 * identity of its own to have. Keeping `siteId` beside `id` is what makes that
 * growth a change to `systems.ts` rather than to every caller: the day a site can
 * carry two systems, `id` stops equalling `siteId` and nothing that reads
 * `system.siteId` to link to a site page has to be found.
 */
export type SolarSystem = {
  id: string;
  siteId: string;
  /** The site's own name — `WPKL-0207`. */
  siteName: string;
  locationLabel: string;
  role: SitePowerRole;
  /** System capacity, kWp DC — the number the system is named and sold by. */
  kwp: number;
  /** The inverters' combined AC rating, kW. */
  acKw: number;
  inverters: Array<Inverter>;
  /** Strings across every inverter. */
  strings: number;
  /**
   * How many modules are on the roof, and what each is rated at.
   *
   * The design's home page asks for `Number of panels`, and nothing in the model
   * answered it — so it is derived here from `kwp` at one module rating, exactly as
   * `strings` is derived from the DC behind each box. It is not seeded: a module
   * count stated independently of the capacity is a number that can disagree with
   * the thing it is a count of, and this estate's arithmetic is built so that
   * cannot happen.
   *
   * `moduleWatts` travels with it so a page can say *248 × 580 W* rather than
   * quoting a bare count a reader has no way to check.
   */
  modules: number;
  moduleWatts: number;
  /** How many of those are dark, for a reason other than the hour. */
  downStrings: number;
  commissionedAt: string;
  /** The most recent contact across every inverter. */
  lastUpdated: string;
  /** Rolled up from the boxes — see `systemState`. */
  state: InverterState;
  /** What the system is putting out now, kW — summed over the boxes we can hear. */
  outputKw: number;
  /**
   * The DC capacity currently reporting, kWp.
   *
   * Below `kwp` whenever an inverter has gone quiet, and the page prints both. A
   * system with one silent box out of twenty-two is not an offline system — it is
   * a system four percent of which we cannot see, and those are different jobs.
   */
  reportingKwp: number;
};

/**
 * The system's state, rolled up from its boxes.
 *
 * `OFFLINE` only when **every** inverter is silent, which is the whole reason the
 * roll-up is a function rather than a field copied off the first box. One quiet
 * inverter in twenty-two does not make a plant offline; it makes an alert, and
 * `reportingKwp` carries how much of the plant it costs us.
 *
 * `GENERATING` wins over `IDLE` for the same kind of reason in the other
 * direction: if any part of the system is delivering, the system is delivering.
 */
export const systemState = (inverters: Array<Inverter>): InverterState => {
  if (inverters.length === 0) return 'OFFLINE';
  if (inverters.every((one) => one.state === 'OFFLINE')) return 'OFFLINE';
  return inverters.some((one) => one.state === 'GENERATING') ? 'GENERATING' : 'IDLE';
};

export const reportingInverters = (system: SolarSystem): Array<Inverter> =>
  system.inverters.filter((one) => one.state !== 'OFFLINE');

export const silentInverters = (system: SolarSystem): Array<Inverter> =>
  system.inverters.filter((one) => one.state === 'OFFLINE');

export const inverterById = (
  system: SolarSystem,
  inverterId: string,
): Inverter | undefined => system.inverters.find((one) => one.id === inverterId);

/**
 * `WPKL-0207 | 42 kWp` — the header, the breadcrumb and the document title.
 *
 * Built the way `gensetName` is, from the two facts that identify a unit to
 * somebody who works on them: *which one* and *how big*. A genset's second half
 * is its model, because two sets at one site are told apart by what they are; a
 * system's is its capacity, because there is one per site and the size is what a
 * reader needs before any figure on the page means anything.
 */
export const systemName = (system: SolarSystem): string =>
  `${system.siteName} | ${system.kwp} kWp`;

/** Sort key within a condition: something silent first, then working, then dark. */
export const INVERTER_STATE_ORDER: Record<InverterState, number> = {
  OFFLINE: 0,
  GENERATING: 1,
  IDLE: 2,
};
