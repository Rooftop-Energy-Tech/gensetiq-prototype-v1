import type {CustomerId} from '@/modules/site/data/customers';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * What a solar system is *doing*, and why the list is three long.
 *
 * `RUN_STATES` for a plant with no engine, and the parallel is exact on purpose:
 * `GENERATING` is `RUNNING`, `IDLE` is `IDLE`, `OFFLINE` is a plant that has
 * stopped talking to us. An operator who has learned the fleet screen's state
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
 * A system with a string down is still generating, at three-quarters of what it
 * should. Folding that into the state would either hide it — `GENERATING`, as
 * though nothing were wrong — or overstate it, `FAULT` on a plant making most of
 * its number. It belongs in the health band, where it can carry the date it
 * started and the energy it has cost since.
 */
export const SYSTEM_STATES = ['GENERATING', 'IDLE', 'OFFLINE'] as const;

export type SystemState = (typeof SYSTEM_STATES)[number];

/**
 * One solar system: everything PV at a site, taken together — **and the only
 * level this module has.**
 *
 * ## Why there is no device below it
 *
 * There was, and it was an inverter: a box with a serial number, a comms link, a
 * control pad and a page of its own, carrying the strings that landed on its MPPT
 * inputs. It is gone, because these are telco sites. A tower runs a −48 V DC bus
 * and its loads are DC, so the array feeds the bus directly; there is no AC stage
 * anywhere on the site for an inverter to make, and a page describing one was
 * describing a box that is not in the cabinet.
 *
 * What went with it is worth stating plainly, because it is a real loss and not a
 * tidy-up: per-box state, so a plant is now reporting or silent as a whole rather
 * than four-fifths visible; the string bars and the per-box control pad; and the
 * insulation-resistance rule, which was an earth-leakage interlock reading and so
 * had nothing left to measure it.
 *
 * What stays is everything the array itself is. **Strings survive the boxes** —
 * a string is modules in series, a physical run on the roof, and it is a fact
 * about the array whatever it terminates in. That is why `string-out` is still a
 * health rule and still the most useful thing this module says.
 *
 * ## Why this is the register's row
 *
 * Three reasons, and they are about who is reading.
 *
 *  - **It is the unit people name.** Nobody says "we have twenty-two strings";
 *    they say "we have a 1.3 MW system". `kwp` is what a quote, a contract and a
 *    commissioning certificate are written against.
 *  - **It is the unit generation is reported at.** The energy model sizes and
 *    runs a site's whole plant, so the monthly series, the day's kWh and the
 *    step-down all attach here.
 *  - **It is the unit that survives.** Plant is implementation: replace it and
 *    the system is the same system, with the same contract and the same history.
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
  /**
   * Where the system is, and which division owns it.
   *
   * All three are the **site's**, copied down rather than derived: a system is
   * everything PV at one place, so its position is that place's position and its
   * region is that place's region. They are here because the register now has a map
   * and a region filter, and both need the fact on the row rather than a `siteSeed`
   * lookup per cell — the same reason `locationLabel` above was already copied down.
   *
   * A reader can move a site's pin or change its region from its Settings tab, and
   * `systems.ts` reads the seeds live, so these follow.
   */
  latitude: number;
  longitude: number;
  customer: CustomerId;
  role: SitePowerRole;
  /** System capacity, kWp DC — the number the system is named and sold by. */
  kwp: number;
  /** How many strings the array is wired in. */
  strings: number;
  /**
   * How many modules are on the roof, and what each is rated at.
   *
   * The design's home page asks for `Number of panels`, and nothing in the model
   * answered it — so it is derived here from `kwp` at one module rating, exactly as
   * `strings` is. It is not seeded: a module count stated independently of the
   * capacity is a number that can disagree with the thing it is a count of, and
   * this estate's arithmetic is built so that cannot happen.
   *
   * `moduleWatts` travels with it so a page can say *248 × 580 W* rather than
   * quoting a bare count a reader has no way to check.
   */
  modules: number;
  moduleWatts: number;
  /** How many of those strings are dark, for a reason other than the hour. */
  downStrings: number;
  commissionedAt: string;
  /** When this system was last heard from. */
  lastUpdated: string;
  state: SystemState;
  /** What the system is putting out now, kW. `0` on a system nobody can hear. */
  outputKw: number;
};

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
