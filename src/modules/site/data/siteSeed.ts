import type {SiteKind, SitePowerRole} from '../types/site.type';
import type {CustomerId} from './customers';

/**
 * The twenty-five sites, as **given facts about places**.
 *
 * This branch's estate is **a mobile carrier's own tower network**: every site is
 * a base station with a permanent power plant beside it. Nothing here is a
 * temporary supply and nothing moves — the genset is bolted to a plinth at the
 * foot of the tower and has been for years, which is the assumption the whole
 * white-label is built on. The ids, loads and pairings carry the shared seed's
 * tuning; the identities are network assets.
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
 *    to it. A substation does not move because a lorry did.
 *  - **it was circular.** Deploying a set *moves the machine to the site*, so the
 *    site's position is the input to that operation. Deriving it from the output is
 *    a loop with no fixed point.
 *
 * ## Why the load is seeded
 *
 * `loadKw` is what the injection point carries — a fact about the **network**,
 * not about the plant parked beside it. A feeder draws what its area draws.
 *
 * It used to be scaled off installed genset capacity, which was a convenience that
 * quietly made the load a function of the machinery. Being able to detach a genset
 * made that plainly wrong: strip a site of its sets and it would appear to stop
 * carrying load. Seeding it means **removing a genset does not change what the
 * point draws**, which is the only defensible behaviour.
 *
 * The intended direction of travel is a **metering device installed at the site**,
 * reporting a consumption pattern over time rather than one figure. When that lands
 * this seed becomes the device's reading, and nothing above `SiteSummary.mains` has
 * to change.
 */
export type SiteSeed = {
  id: string;
  /** e.g. `WPKL-0207` — the label the design puts in the header. */
  name: string;
  kind: SiteKind;
  /** The yard's placename. Gensets deployed here take it as their own. */
  locationLabel: string;
  latitude: number;
  longitude: number;
  /**
   * What the site draws, kW — the load meter's reading.
   *
   * A **telco load**, which is the number most likely to be got wrong here: a
   * macro base station is 4–6 kW, not the tens of kilowatts a substation carries.
   * The estate's range runs from a 3 kW rural site to a 205 kW switching centre,
   * and the gap between those two ends is the reason a single "genset site" figure
   * would say nothing.
   *
   * Independent of what is standing at the site, deliberately. See the note above.
   */
  loadKw: number;
  /**
   * Which network region this site belongs to.
   *
   * Seeded here and nowhere else: a genset takes its region from the site it
   * stands at, so there is one statement of the fact and detaching a set leaves it
   * with no region rather than with a stale one. The region also carries the peak
   * sun hours every solar figure at this site is built from. See `customers.ts`.
   */
  customer: CustomerId;
  /**
   * How this site is powered, as a **given about the place** — see `SitePowerRole`.
   *
   * The estate is deliberately a **mix**, because that is what a carrier's real
   * one is and because a demo of hybrid plant is worth nothing without the sites
   * it is being compared against. Grid-backed sites are the town and city ones.
   * The off-grid sites split three ways: the ones still on diesel prime, the ones
   * converted to diesel hybrid, and the ones that got an array as well. A reader
   * filtering the sites list by configuration is reading the conversion
   * programme's progress.
   *
   * Their gensets' activity feeds still read "started on utility outage", because
   * those feeds are the *machines'* history and this setting does not rewrite it.
   * `siteConfig.ts` keeps its override store: a reader flipping a site still wins,
   * and clearing site data returns to what is written here.
   */
  powerRole: SitePowerRole;
};

// prettier-ignore
export const SITE_SEED: Array<SiteSeed> = [
  // — Klang Valley — the cluster in the map view, and where the grid-backed
  //   sites are. A tower on a rooftop in the city has an incomer; the genset
  //   beside it has run eleven hours this year.
  {id: 'wpkl-0142', name: 'WPKL-0142', kind: 'MACRO',  locationLabel: 'Bukit Bintang, Kuala Lumpur',  latitude: 3.1466, longitude: 101.7108, loadKw: 6,   customer: 'central',    powerRole: 'GRID_BACKUP'},
  {id: 'wpkl-0207', name: 'WPKL-0207', kind: 'CORE',   locationLabel: 'Bangsar South, Kuala Lumpur',  latitude: 3.1109, longitude: 101.6640, loadKw: 205, customer: 'central',    powerRole: 'GRID_BACKUP'},
  {id: 'wpkl-0355', name: 'WPKL-0355', kind: 'IBS',    locationLabel: 'KLCC, Kuala Lumpur',           latitude: 3.1578, longitude: 101.7117, loadKw: 11,  customer: 'central',    powerRole: 'GRID_BACKUP'},
  {id: 'sel-0318',  name: 'SEL-0318',  kind: 'HUB',    locationLabel: 'Shah Alam, Selangor',          latitude: 3.0733, longitude: 101.5185, loadKw: 27,  customer: 'central',    powerRole: 'GRID_BACKUP'},
  {id: 'sel-0491',  name: 'SEL-0491',  kind: 'MACRO',  locationLabel: 'Puchong, Selangor',            latitude: 3.0319, longitude: 101.6169, loadKw: 5,   customer: 'central',    powerRole: 'GRID_BACKUP'},
  {id: 'sel-0664',  name: 'SEL-0664',  kind: 'MACRO',  locationLabel: 'Rawang, Selangor',             latitude: 3.3210, longitude: 101.5770, loadKw: 5,   customer: 'central',    powerRole: 'GRID_BACKUP'},
  {id: 'sel-0812',  name: 'SEL-0812',  kind: 'RURAL',  locationLabel: 'Hulu Langat, Selangor',        latitude: 3.1590, longitude: 101.8710, loadKw: 4,   customer: 'central',    powerRole: 'SOLAR_HYBRID'},
  {id: 'sel-0977',  name: 'SEL-0977',  kind: 'MACRO',  locationLabel: 'Sepang, Selangor',             latitude: 2.7150, longitude: 101.7060, loadKw: 6,   customer: 'central',    powerRole: 'DIESEL_HYBRID'},
  // — Northern — the best sun on the estate, which is why three of the five
  //   converted sites are here rather than spread evenly.
  {id: 'png-0255',  name: 'PNG-0255',  kind: 'HUB',    locationLabel: 'Bayan Lepas, Penang',          latitude: 5.2945, longitude: 100.2760, loadKw: 24,  customer: 'northern',   powerRole: 'GRID_BACKUP'},
  {id: 'kdh-0431',  name: 'KDH-0431',  kind: 'MACRO',  locationLabel: 'Sungai Petani, Kedah',         latitude: 5.6470, longitude: 100.4870, loadKw: 5,   customer: 'northern',   powerRole: 'SOLAR_HYBRID'},
  {id: 'kdh-0588',  name: 'KDH-0588',  kind: 'RURAL',  locationLabel: 'Sik, Kedah',                   latitude: 5.8210, longitude: 100.7420, loadKw: 4,   customer: 'northern',   powerRole: 'SOLAR_HYBRID'},
  {id: 'prk-0713',  name: 'PRK-0713',  kind: 'MACRO',  locationLabel: 'Ipoh, Perak',                  latitude: 4.5975, longitude: 101.0901, loadKw: 6,   customer: 'northern',   powerRole: 'GRID_BACKUP'},
  {id: 'prk-0846',  name: 'PRK-0846',  kind: 'RURAL',  locationLabel: 'Grik, Perak',                  latitude: 5.4290, longitude: 101.1290, loadKw: 4,   customer: 'northern',   powerRole: 'DIESEL_HYBRID'},
  // — Southern and East Coast.
  {id: 'jhr-0907',  name: 'JHR-0907',  kind: 'CORE',   locationLabel: 'Johor Bahru, Johor',           latitude: 1.4927, longitude: 103.7414, loadKw: 168, customer: 'southern',   powerRole: 'GRID_BACKUP'},
  {id: 'jhr-1064',  name: 'JHR-1064',  kind: 'MACRO',  locationLabel: 'Kluang, Johor',                latitude: 2.0250, longitude: 103.3180, loadKw: 5,   customer: 'southern',   powerRole: 'DIESEL_HYBRID'},
  {id: 'nsn-0492',  name: 'NSN-0492',  kind: 'MACRO',  locationLabel: 'Seremban, Negeri Sembilan',    latitude: 2.7297, longitude: 101.9381, loadKw: 5,   customer: 'southern',   powerRole: 'GRID_BACKUP'},
  {id: 'phg-0788',  name: 'PHG-0788',  kind: 'RURAL',  locationLabel: 'Cameron Highlands, Pahang',    latitude: 4.4710, longitude: 101.3770, loadKw: 4,   customer: 'east-coast', powerRole: 'DIESEL_PRIME'},
  {id: 'trg-0512',  name: 'TRG-0512',  kind: 'MACRO',  locationLabel: 'Kuala Terengganu, Terengganu', latitude: 5.3302, longitude: 103.1408, loadKw: 6,   customer: 'east-coast', powerRole: 'GRID_BACKUP'},
  {id: 'kel-0339',  name: 'KEL-0339',  kind: 'RURAL',  locationLabel: 'Gua Musang, Kelantan',         latitude: 4.8820, longitude: 101.9670, loadKw: 4,   customer: 'east-coast', powerRole: 'DIESEL_PRIME'},
  // — Sabah and Sarawak — the interior sites, where the diesel is trucked and
  //   the case for converting one is strongest. Four of the six diesel sites on
  //   the estate are here.
  {id: 'sbh-1204',  name: 'SBH-1204',  kind: 'HUB',    locationLabel: 'Kota Kinabalu, Sabah',         latitude: 5.9804, longitude: 116.0735, loadKw: 22,  customer: 'sabah',      powerRole: 'GRID_BACKUP'},
  {id: 'sbh-1377',  name: 'SBH-1377',  kind: 'RURAL',  locationLabel: 'Nabawan, Sabah',              latitude: 5.0620, longitude: 116.4370, loadKw: 3,   customer: 'sabah',      powerRole: 'DIESEL_PRIME'},
  {id: 'sbh-1495',  name: 'SBH-1495',  kind: 'RURAL',  locationLabel: 'Pulau Banggi, Kudat',         latitude: 7.2717, longitude: 117.1782, loadKw: 4,   customer: 'sabah',      powerRole: 'SOLAR_HYBRID'},
  {id: 'sbh-1612',  name: 'SBH-1612',  kind: 'MACRO',  locationLabel: 'Lahad Datu, Sabah',           latitude: 5.0269, longitude: 118.3270, loadKw: 5,   customer: 'sabah',      powerRole: 'DIESEL_HYBRID'},
  {id: 'swk-0663',  name: 'SWK-0663',  kind: 'RURAL',  locationLabel: 'Kapit, Sarawak',              latitude: 2.0170, longitude: 112.9330, loadKw: 3,   customer: 'sarawak',    powerRole: 'DIESEL_PRIME'},
  {id: 'swk-0851',  name: 'SWK-0851',  kind: 'RURAL',  locationLabel: 'Belaga, Sarawak',             latitude: 2.7000, longitude: 113.7830, loadKw: 4,   customer: 'sarawak',    powerRole: 'DIESEL_PRIME'},
];

export const siteSeed = (siteId: string): SiteSeed | undefined =>
  SITE_SEED.find((seed) => seed.id === siteId);

/** `WPKL-0142`, for the breadcrumb and the document title. */
export const siteLabel = (siteId: string): string => siteSeed(siteId)?.name ?? 'Site';

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  CORE: 'Switching centre',
  HUB: 'Aggregation hub',
  MACRO: 'Macro base station',
  RURAL: 'Rural coverage site',
  IBS: 'In-building system',
};

/**
 * The site the app opens on, and this section's default.
 *
 * A solar hybrid rather than the first row, deliberately: it is the configuration
 * the whole white-label is about, and the one whose site page has every band on
 * it. Landing on a grid-backed rooftop would open the app on the one page that
 * shows none of what is new.
 */
export const DEFAULT_SITE_ID = 'kdh-0431';
