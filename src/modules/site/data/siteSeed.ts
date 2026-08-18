import type {SiteKind, SitePowerRole} from '../types/site.type';
import type {CustomerId} from './customers';

/**
 * The twenty-five sites, as **given facts about places**.
 *
 * This branch's estate is **Sabah and Labuan only** — the territory the demo's
 * operator actually serves. The ids, loads, roles and pairings are the same
 * rows the shared seed tunes its buckets against; only the geography moved.
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
 * ## Why the load is seeded
 *
 * `loadKw` is what the site's intake meter reads when the grid is carrying — and it
 * is a fact about the **load**, not about the plant parked outside. A hospital
 * draws what a hospital draws.
 *
 * It used to be scaled off installed genset capacity, which was a convenience that
 * quietly made the load a function of the machinery. Being able to detach a genset
 * made that plainly wrong: strip a site of its sets and it would appear to stop using
 * electricity. Seeding it means **removing a genset does not change what the load
 * draws**, which is the only defensible behaviour.
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
   * What the load draws, kW — the intake meter's reading while the grid carries.
   *
   * Independent of what is standing in the yard, deliberately. See the note above.
   */
  loadKw: number;
  /**
   * Whose yard this is — here, the distribution zone that requested the set.
   *
   * Seeded here and nowhere else: a genset takes its zone from the site it
   * stands at, so there is one statement of the fact and detaching a set leaves it
   * with no zone rather than with a stale one. See `customers.ts`.
   */
  customer: CustomerId;
  /**
   * How this yard is fed, as a **given about the place** — see `SitePowerRole`.
   *
   * Six yards are `PRIME`: an interior exchange or an east-coast tower with no
   * mains incomer is fed by its gensets and nothing else. Their gensets' activity
   * feeds still read "started on utility outage", because those feeds are the
   * *machines'* history and this setting does not rewrite it — the seam
   * `SitePowerRole` describes. `siteConfig.ts` keeps its override store: a reader
   * flipping a site still wins, and clearing site data returns to what is written
   * here rather than to a blanket default.
   */
  powerRole: SitePowerRole;
};

// prettier-ignore
export const SITE_SEED: Array<SiteSeed> = [
  // — Greater Kota Kinabalu — the cluster in the map view.
  {id: 'telco-001',   name: 'Telco-001',   kind: 'TELCO',         locationLabel: 'Luyang, Kota Kinabalu',      latitude: 5.9560, longitude: 116.0810, loadKw: 205, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'data-002',    name: 'Data-002',    kind: 'DATA',          locationLabel: 'Sepanggar, Sabah',           latitude: 6.0670, longitude: 116.1330, loadKw: 380, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'telco-003',   name: 'Telco-003',   kind: 'TELCO',         locationLabel: 'Penampang, Sabah',           latitude: 5.9370, longitude: 116.1120, loadKw: 177, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'mfg-004',     name: 'Mfg-004',     kind: 'MANUFACTURING', locationLabel: 'Inanam, Sabah',              latitude: 5.9800, longitude: 116.1290, loadKw: 233, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'tower-005',   name: 'Tower-005',   kind: 'TOWER',         locationLabel: 'Kota Kinabalu City Centre',  latitude: 5.9860, longitude: 116.0760, loadKw: 332, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'hosp-006',    name: 'Hosp-006',    kind: 'HOSPITAL',      locationLabel: 'Bukit Padang, Kota Kinabalu',latitude: 5.9500, longitude: 116.0880, loadKw: 742, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'mfg-007',     name: 'Mfg-007',     kind: 'MANUFACTURING', locationLabel: 'Telipok, Sabah',             latitude: 6.1230, longitude: 116.1740, loadKw: 102, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'airport-008', name: 'Airport-008', kind: 'AIRPORT',       locationLabel: 'Tanjung Aru, Kota Kinabalu', latitude: 5.9370, longitude: 116.0510, loadKw: 169, customer: 'west-coast', powerRole: 'STANDBY'},
  // — The west-coast corridor north and south of the city.
  {id: 'mfg-009',     name: 'Mfg-009',     kind: 'MANUFACTURING', locationLabel: 'Tuaran, Sabah',              latitude: 6.1770, longitude: 116.2330, loadKw: 313, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'telco-010',   name: 'Telco-010',   kind: 'TELCO',         locationLabel: 'Kota Belud, Sabah',          latitude: 6.3510, longitude: 116.4300, loadKw: 364, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'retail-011',  name: 'Retail-011',  kind: 'RETAIL',        locationLabel: 'Kudat, Sabah',               latitude: 6.8830, longitude: 116.8440, loadKw: 71,  customer: 'kudat',      powerRole: 'STANDBY'},
  {id: 'telco-012',   name: 'Telco-012',   kind: 'TELCO',         locationLabel: 'Kota Marudu, Sabah',         latitude: 6.5040, longitude: 116.7440, loadKw: 248, customer: 'kudat',      powerRole: 'PRIME'},
  {id: 'data-013',    name: 'Subst-013',   kind: 'SUBSTATION',    locationLabel: 'Keningau, Sabah',            latitude: 5.3380, longitude: 116.1600, loadKw: 242, customer: 'interior',   powerRole: 'STANDBY'},
  {id: 'retail-014',  name: 'Retail-014',  kind: 'RETAIL',        locationLabel: 'Victoria, Labuan',           latitude: 5.2767, longitude: 115.2417, loadKw: 218, customer: 'labuan',     powerRole: 'STANDBY'},
  {id: 'mfg-015',     name: 'Mfg-015',     kind: 'MANUFACTURING', locationLabel: 'Papar, Sabah',               latitude: 5.7330, longitude: 115.9330, loadKw: 175, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'port-016',    name: 'Port-016',    kind: 'PORT',          locationLabel: 'Sepanggar Bay, Sabah',       latitude: 6.0830, longitude: 116.1080, loadKw: 281, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'telco-017',   name: 'Telco-017',   kind: 'TELCO',         locationLabel: 'Tenom, Sabah',               latitude: 5.1330, longitude: 115.9500, loadKw: 64,  customer: 'interior',   powerRole: 'PRIME'},
  // — The interior and the east coast — where the prime yards are.
  //
  // Six of these have no mains incomer at all: a Nabawan exchange or a Semporna
  // tower is fed by its gensets and nothing else, which is the case
  // `SitePowerRole` draws the distinction for. At east-coast distances the drive
  // is most of any intervention, which is what the overview's buckets are for.
  {id: 'telco-018',  name: 'Telco-018',  kind: 'TELCO',        locationLabel: 'Ranau, Sabah',              latitude: 5.9540, longitude: 116.6640, loadKw: 188, customer: 'interior',   powerRole: 'STANDBY'},
  {id: 'telco-019',  name: 'Telco-019',  kind: 'TELCO',        locationLabel: 'Nabawan, Sabah',            latitude: 5.0620, longitude: 116.4370, loadKw: 42,  customer: 'interior',   powerRole: 'PRIME'},
  {id: 'telco-020',  name: 'Telco-020',  kind: 'TELCO',        locationLabel: 'Sandakan, Sabah',           latitude: 5.8402, longitude: 118.1179, loadKw: 132, customer: 'sandakan',   powerRole: 'STANDBY'},
  {id: 'tower-021',  name: 'Tower-021',  kind: 'TOWER',        locationLabel: 'Lahad Datu, Sabah',         latitude: 5.0269, longitude: 118.3270, loadKw: 58,  customer: 'lahad-datu', powerRole: 'PRIME'},
  {id: 'data-022',   name: 'Subst-022',  kind: 'SUBSTATION',   locationLabel: 'Batu Sapi, Sandakan',       latitude: 5.8560, longitude: 118.0210, loadKw: 296, customer: 'sandakan',   powerRole: 'STANDBY'},
  {id: 'port-023',   name: 'Port-023',   kind: 'PORT',         locationLabel: 'Tawau, Sabah',              latitude: 4.2450, longitude: 117.8840, loadKw: 415, customer: 'tawau',      powerRole: 'STANDBY'},
  {id: 'mfg-024',    name: 'Mfg-024',    kind: 'MANUFACTURING',locationLabel: 'POIC Lahad Datu, Sabah',    latitude: 5.0480, longitude: 118.3990, loadKw: 267, customer: 'lahad-datu', powerRole: 'PRIME'},
  {id: 'telco-025',  name: 'Telco-025',  kind: 'TELCO',        locationLabel: 'Semporna, Sabah',           latitude: 4.4770, longitude: 118.6110, loadKw: 37,  customer: 'tawau',      powerRole: 'PRIME'},
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
  SUBSTATION: 'Substation',
};

/** The site the design's frame opens on, and this section's default. */
export const DEFAULT_SITE_ID = 'telco-001';
