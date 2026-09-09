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
/**
 * The run from a panel to the cabinet, as surveyed at SBH-1336 (Jeff, 2026-09-09).
 *
 * ```
 * 30 panels @ 540 W
 *   ├─ 15 strings          2 panels in series
 *   ├─ 4 junction boxes    4 strings each, the last one short
 *   └─ PVDU80A             one DC distribution unit
 *        └─ 4 SSUs → −48 V bus
 * ```
 *
 * The ratios are the standard and the counts follow the array's capacity, which is
 * how it is applied at the other three: two panels to a string and four strings to a
 * box, every time, with the last box short wherever the division does not come out
 * even. That is not a modelling convenience — SBH-1336's own 15 strings fill three
 * boxes and leave three strings in a fourth.
 */
export type ArrayWiring = {
  /** Panels in series in one string. */
  panelsPerString: number;
  /** Strings landing in one junction box. */
  stringsPerBox: number;
  /**
   * How many boxes that comes to, the last one short where the strings do not divide.
   *
   * ⚠️ **This is not the number of `PV N Array Fault` rows.** The poll table generates
   * one per conversion unit — four at every site that has a unit — and at the
   * *modelled* capacity this count runs to six, seven or eight. So three or four boxes
   * on each roof have no row watching them, which is the "nothing watching read as
   * nothing wrong" case this app is built to state rather than hide.
   *
   * At the **surveyed** capacity the two agree exactly: 16.2 kWp is 30 panels, 15
   * strings, 4 boxes, 4 rows. The gap is produced entirely by keeping `kwp` at the
   * modelled 28 rather than the measured 16.2 — which is a decision recorded in
   * `systems.ts`, not an error here.
   */
  junctionBoxes: number;
  /** What the boxes combine into, on the way to the cabinet's conversion units. */
  feedsInto: string;
};

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
  /**
   * How the array is actually wired, where anybody has said — and `null` where nobody
   * has surveyed it.
   *
   * Panels in series make a string, strings land in a junction box, the boxes
   * combine into one DC distribution unit and that feeds the cabinet's conversion
   * units. `strings` above is a count; this is the shape it is a count of.
   *
   * ## Why it is nullable rather than a constant
   *
   * Because it is a **survey**, and the sites that have one are the four with a
   * monitoring unit — the same split `monitoringUnit.ts` draws, for the same reason.
   * A wiring standard asserted at a site nobody has visited is a claim about screws
   * on a roof, and this app's rule is that an unmeasured thing says so rather than
   * borrowing a measured one's numbers.
   *
   * On today's estate that makes this **never null in practice**: an array is only
   * fitted at a `SOLAR_HYBRID` site, and all four of those have a unit. The null
   * branch is reachable the moment somebody flips a fifth site to solar hybrid on its
   * settings tab — which is a thing the app lets a reader do — so it is a live path
   * rather than dead code, and it is the reason `stringsOn` and the 580 W module
   * constant are still here.
   *
   * ⚠️ **The two wiring models are not compatible.** A surveyed array runs 1.08 kWp
   * strings — two 540 W panels — and an unsurveyed one runs 6–10 kWp strings out of
   * `stringsOn`'s spread. Both cannot be one procurement standard. The surveyed number
   * is the real one; the fallback keeps its own only because nothing has replaced it,
   * and the day a second site is surveyed it should go.
   */
  wiring: ArrayWiring | null;
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
 * `Solar | WPKL-0207` — the header, the breadcrumb and the document title.
 *
 * Built the way `bankName`, `gensetName` and `cabinetName` are, and see the first
 * of those for why the asset leads and its code follows. A system's code is its
 * site's, because there is one array per site here — the day that stops being true
 * `id` stops equalling `siteId` and this is the line that has to change with it.
 *
 * The capacity this used to carry is on the page: `kWp` heads the nameplate band
 * under the chart, and the rail's info glyph states the module count and string
 * count beside it. It was never what told two arrays apart.
 */
export const systemName = (system: SolarSystem): string => `Solar | ${system.siteName}`;
