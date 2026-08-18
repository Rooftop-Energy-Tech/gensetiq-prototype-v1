import type {SiteKind, SitePowerRole} from '../types/site.type';
import type {CustomerId} from './customers';

/**
 * The seventeen sites, as **given facts about places**.
 *
 * ## Why this file has no imports
 *
 * It is the one thing in the site module that depends on nothing. `sites.ts` needs
 * it (to build summaries) and so does `genset/data/deployment.ts` (to know where a
 * yard is, so attaching a set can move the machine there) — and `sites.ts` imports
 * the fleet, which imports deployment. Leaving the seed inside `sites.ts` would
 * close that loop. Pure data at the bottom of the graph breaks it.
 *
 * ## Why position is seeded rather than derived
 *
 * It used to be derived: a site's placename was its first genset's, and its
 * coordinates were the mean of its members'. That worked exactly as long as
 * membership was fixed, and stopped the moment gensets could be attached and
 * detached. Three things broke at once:
 *
 *  - **an empty site had no location at all.** Zero members meant `'Unknown'` and a
 *    mean of nothing, which lands at 0°, 0° — the Gulf of Guinea.
 *  - **the yard's position depended on attach order.** If the site is wherever its
 *    sets are, the first set to arrive defines the place and the second gets dragged
 *    to it. A site is a customer's yard; it does not move because a lorry did.
 *  - **it was circular.** Deploying a set *moves the machine to the site*, so the
 *    site's position is the input to that operation. Deriving it from the output is
 *    a loop with no fixed point.
 *
 * Every value below is exactly what the old derivation produced, so nothing moved on
 * the map or in the sites list the day this changed.
 *
 * ## Why the load is seeded
 *
 * `loadKw` is what the site's intake meter reads when the grid is carrying — and it
 * is a fact about the **customer**, not about the plant parked outside. A hospital
 * draws what a hospital draws.
 *
 * It used to be scaled off installed genset capacity, which was a convenience that
 * quietly made the load a function of the machinery. Being able to detach a genset
 * made that plainly wrong: strip a site of its sets and it would appear to stop using
 * electricity. Seeding it means **removing a genset does not change what the customer
 * draws**, which is the only defensible behaviour.
 *
 * The figures are each site's *own* current draw, taken from whichever source is
 * feeding it — so a site whose genset carries 205 kW meters 205 kW on the grid too.
 * That also fixed a contradiction the derived version had: `mfg-015` metered 152 kW
 * while its own genset reported carrying 175 kW, which is one load with two numbers.
 *
 * The intended direction of travel is a **metering device installed at the site**,
 * reporting a consumption pattern over time rather than one figure. When that lands
 * this seed becomes the device's reading, and nothing above `SiteSummary.mains` has
 * to change.
 */
export type SiteSeed = {
  id: string;
  /** e.g. `Telco-001` — the label the design puts in the header. */
  name: string;
  kind: SiteKind;
  /** The yard's placename. Gensets deployed here take it as their own. */
  locationLabel: string;
  latitude: number;
  longitude: number;
  /**
   * What the customer draws, kW — the intake meter's reading while the grid carries.
   *
   * Independent of what is standing in the yard, deliberately. See the note above.
   */
  loadKw: number;
  /**
   * Whose yard this is.
   *
   * Seeded here and nowhere else: a genset takes its customer from the site it
   * stands at, so there is one statement of the fact and detaching a set leaves it
   * with no customer rather than with a stale one. See `customers.ts`.
   */
  customer: CustomerId;
  /**
   * How this yard is fed, as a **given about the place** — see `SitePowerRole`.
   *
   * It used to be `STANDBY` for every site, as a constant in `siteConfig.ts`, on the
   * grounds that a reader could flip any one of them. That was fine while the role
   * only chose which diagram to draw, and stopped being fine the moment the fleet
   * summary counted by it: a card reading "Standby 25 · Prime 0" on a fresh load is
   * a card with nothing in it, and the estate it describes does contain yards with
   * no mains incomer.
   *
   * So the fact lives with the other facts about the place, and `siteConfig.ts`
   * keeps its override store — a reader flipping a site still wins, and clearing
   * site data returns to what is written here rather than to a blanket default.
   *
   * Three yards are `PRIME`. Their gensets' activity feeds still read "started on
   * utility outage", because those feeds are the *machines'* history and this
   * setting does not rewrite it — the seam `SitePowerRole` describes, now visible
   * by default rather than only after somebody flips a switch.
   */
  powerRole: SitePowerRole;
};

// prettier-ignore
export const SITE_SEED: Array<SiteSeed> = [
  {id: 'telco-001',   name: 'Telco-001',   kind: 'TELCO',         locationLabel: 'Petaling Jaya, Selangor',    latitude: 3.1077, longitude: 101.6073, loadKw: 205, customer: 'maxis',             powerRole: 'STANDBY'},
  {id: 'data-002',    name: 'Data-002',    kind: 'DATA',          locationLabel: 'Cyberjaya, Selangor',        latitude: 2.9217, longitude: 101.6565, loadKw: 380, customer: 'tm',                powerRole: 'STANDBY'},
  {id: 'telco-003',   name: 'Telco-003',   kind: 'TELCO',         locationLabel: 'Subang Jaya, Selangor',      latitude: 3.0567, longitude: 101.5851, loadKw: 177, customer: 'maxis',             powerRole: 'STANDBY'},
  {id: 'mfg-004',     name: 'Mfg-004',     kind: 'MANUFACTURING', locationLabel: 'Shah Alam, Selangor',        latitude: 3.0737, longitude: 101.5191, loadKw: 233, customer: 'sapura',            powerRole: 'STANDBY'},
  {id: 'tower-005',   name: 'Tower-005',   kind: 'TOWER',         locationLabel: 'Kuala Lumpur City Centre',   latitude: 3.1578, longitude: 101.7119, loadKw: 332, customer: 'maxis',             powerRole: 'STANDBY'},
  {id: 'hosp-006',    name: 'Hosp-006',    kind: 'HOSPITAL',      locationLabel: 'Cheras, Kuala Lumpur',       latitude: 3.0837, longitude: 101.7506, loadKw: 742, customer: 'kpj',               powerRole: 'STANDBY'},
  {id: 'mfg-007',     name: 'Mfg-007',     kind: 'MANUFACTURING', locationLabel: 'Rawang, Selangor',           latitude: 3.3212, longitude: 101.5769, loadKw: 102, customer: 'sapura',            powerRole: 'STANDBY'},
  {id: 'airport-008', name: 'Airport-008', kind: 'AIRPORT',       locationLabel: 'Sepang, Selangor',           latitude: 2.7456, longitude: 101.7072, loadKw: 169, customer: 'malaysia-airports', powerRole: 'STANDBY'},
  {id: 'mfg-009',     name: 'Mfg-009',     kind: 'MANUFACTURING', locationLabel: 'Ipoh, Perak',                latitude: 4.5979, longitude: 101.0907, loadKw: 313, customer: 'sapura',            powerRole: 'STANDBY'},
  {id: 'telco-010',   name: 'Telco-010',   kind: 'TELCO',         locationLabel: 'George Town, Penang',        latitude: 5.4145, longitude: 100.3294, loadKw: 364, customer: 'redtone',           powerRole: 'STANDBY'},
  {id: 'retail-011',  name: 'Retail-011',  kind: 'RETAIL',        locationLabel: 'Sungai Petani, Kedah',       latitude: 5.6470, longitude: 100.4870, loadKw: 71,  customer: 'lotuss',            powerRole: 'STANDBY'},
  {id: 'telco-012',   name: 'Telco-012',   kind: 'TELCO',         locationLabel: 'Alor Setar, Kedah',          latitude: 6.1248, longitude: 100.3678, loadKw: 248, customer: 'redtone',           powerRole: 'PRIME'},
  {id: 'data-013',    name: 'Data-013',    kind: 'DATA',          locationLabel: 'Senai, Johor',               latitude: 1.6019, longitude: 103.6656, loadKw: 242, customer: 'tm',                powerRole: 'STANDBY'},
  {id: 'retail-014',  name: 'Retail-014',  kind: 'RETAIL',        locationLabel: 'Melaka Tengah, Melaka',      latitude: 2.1896, longitude: 102.2501, loadKw: 218, customer: 'lotuss',            powerRole: 'STANDBY'},
  {id: 'mfg-015',     name: 'Mfg-015',     kind: 'MANUFACTURING', locationLabel: 'Seremban, Negeri Sembilan',  latitude: 2.7258, longitude: 101.9424, loadKw: 175, customer: 'sapura',            powerRole: 'STANDBY'},
  {id: 'port-016',    name: 'Port-016',    kind: 'PORT',          locationLabel: 'Kuantan, Pahang',            latitude: 3.8077, longitude: 103.3260, loadKw: 281, customer: 'sapura',            powerRole: 'PRIME'},
  {id: 'telco-017',   name: 'Telco-017',   kind: 'TELCO',         locationLabel: 'Kota Bharu, Kelantan',       latitude: 6.1254, longitude: 102.2381, loadKw: 64,  customer: 'redtone',           powerRole: 'PRIME'},
];

export const siteSeed = (siteId: string): SiteSeed | undefined =>
  SITE_SEED.find((seed) => seed.id === siteId);

/** `Telco-001`, for the breadcrumb and the document title. */
export const siteLabel = (siteId: string): string => siteSeed(siteId)?.name ?? 'Site';

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  TELCO: 'Telecoms exchange',
  DATA: 'Data centre',
  HOSPITAL: 'Hospital',
  MANUFACTURING: 'Manufacturing plant',
  RETAIL: 'Retail',
  PORT: 'Port terminal',
  AIRPORT: 'Airport',
  TOWER: 'Commercial tower',
};

/** The site the design's frame opens on, and this section's default. */
export const DEFAULT_SITE_ID = 'telco-001';
