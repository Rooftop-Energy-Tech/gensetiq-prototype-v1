import type {SiteKind, SitePowerRole} from '../types/site.type';
import type {CustomerId} from './customers';

/**
 * The twenty-five sites, as **given facts about places**.
 *
 * This branch's estate is **the utility's own network**: a mobile genset is
 * deployed where the operator's injection points are — an intake or
 * distribution substation, a feeder under temporary support, a rural
 * mini-grid — never at some customer's premises. The ids, loads and pairings
 * carry the shared seed's tuning; the identities are network assets.
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
  /** e.g. `PPU-001` — the label the design puts in the header. */
  name: string;
  kind: SiteKind;
  /** The yard's placename. Gensets deployed here take it as their own. */
  locationLabel: string;
  latitude: number;
  longitude: number;
  /**
   * What the injection point carries, kW — the intake meter's reading while the
   * grid carries.
   *
   * Independent of what is standing in the yard, deliberately. See the note above.
   */
  loadKw: number;
  /**
   * Whose yard this is — the distribution zone that requested the set.
   *
   * Seeded here and nowhere else: a genset takes its zone from the site it
   * stands at, so there is one statement of the fact and detaching a set leaves it
   * with no zone rather than with a stale one. See `customers.ts`.
   */
  customer: CustomerId;
  /**
   * How this yard is fed, as a **given about the place** — see `SitePowerRole`.
   *
   * The five `PRIME` yards are the rural mini-grids: an isolated island or
   * interior scheme has no incomer at all, and the sets there *are* the supply.
   * Everything on the interconnected grid is `STANDBY` — the set backs up or
   * supplements an injection point that normally carries. Their gensets'
   * activity feeds still read "started on utility outage", because those feeds
   * are the *machines'* history and this setting does not rewrite it.
   * `siteConfig.ts` keeps its override store: a reader flipping a site still
   * wins, and clearing site data returns to what is written here.
   */
  powerRole: SitePowerRole;
};

// prettier-ignore
export const SITE_SEED: Array<SiteSeed> = [
  // — Greater Kota Kinabalu — the cluster in the map view.
  {id: 'ppu-001', name: 'PPU-001', kind: 'PPU',       locationLabel: 'Luyang, Kota Kinabalu',      latitude: 5.9560, longitude: 116.0810, loadKw: 205, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'ppu-002', name: 'PPU-002', kind: 'PPU',       locationLabel: 'Sepanggar, Sabah',           latitude: 6.0670, longitude: 116.1330, loadKw: 380, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'pe-003',  name: 'PE-003',  kind: 'PE',        locationLabel: 'Penampang, Sabah',           latitude: 5.9370, longitude: 116.1120, loadKw: 177, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'pe-004',  name: 'PE-004',  kind: 'PE',        locationLabel: 'Inanam, Sabah',              latitude: 5.9800, longitude: 116.1290, loadKw: 233, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'ppu-005', name: 'PPU-005', kind: 'PPU',       locationLabel: 'Kota Kinabalu City Centre',  latitude: 5.9860, longitude: 116.0760, loadKw: 332, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'pe-006',  name: 'PE-006',  kind: 'PE',        locationLabel: 'Bukit Padang, Kota Kinabalu',latitude: 5.9500, longitude: 116.0880, loadKw: 742, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'pe-007',  name: 'PE-007',  kind: 'PE',        locationLabel: 'Telipok, Sabah',             latitude: 6.1230, longitude: 116.1740, loadKw: 102, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'ppu-008', name: 'PPU-008', kind: 'PPU',       locationLabel: 'Tanjung Aru, Kota Kinabalu', latitude: 5.9370, longitude: 116.0510, loadKw: 169, customer: 'west-coast', powerRole: 'STANDBY'},
  // — The west-coast corridor north and south of the city.
  {id: 'ppu-009', name: 'PPU-009', kind: 'PPU',       locationLabel: 'Tuaran, Sabah',              latitude: 6.1770, longitude: 116.2330, loadKw: 313, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'ppu-010', name: 'PPU-010', kind: 'PPU',       locationLabel: 'Kota Belud, Sabah',          latitude: 6.3510, longitude: 116.4300, loadKw: 364, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'pe-011',  name: 'PE-011',  kind: 'PE',        locationLabel: 'Kudat, Sabah',               latitude: 6.8830, longitude: 116.8440, loadKw: 71,  customer: 'kudat',      powerRole: 'STANDBY'},
  {id: 'mg-012',  name: 'MG-012',  kind: 'MINI_GRID', locationLabel: 'Pulau Banggi, Kudat',        latitude: 7.2717, longitude: 117.1782, loadKw: 248, customer: 'kudat',      powerRole: 'PRIME'},
  {id: 'ppu-013', name: 'PPU-013', kind: 'PPU',       locationLabel: 'Keningau, Sabah',            latitude: 5.3380, longitude: 116.1600, loadKw: 242, customer: 'interior',   powerRole: 'STANDBY'},
  {id: 'pe-014',  name: 'PE-014',  kind: 'PE',        locationLabel: 'Victoria, Labuan',           latitude: 5.2767, longitude: 115.2417, loadKw: 218, customer: 'labuan',     powerRole: 'STANDBY'},
  {id: 'pe-015',  name: 'PE-015',  kind: 'PE',        locationLabel: 'Papar, Sabah',               latitude: 5.7330, longitude: 115.9330, loadKw: 175, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'pmu-016', name: 'PMU-016', kind: 'PMU',       locationLabel: 'Sepanggar Bay, Sabah',       latitude: 6.0830, longitude: 116.1080, loadKw: 281, customer: 'west-coast', powerRole: 'STANDBY'},
  {id: 'mg-017',  name: 'MG-017',  kind: 'MINI_GRID', locationLabel: 'Kemabong, Tenom',            latitude: 4.9670, longitude: 115.9640, loadKw: 64,  customer: 'interior',   powerRole: 'PRIME'},
  // — The interior and the east coast — where the mini-grids are.
  //
  // The five `PRIME` yards are isolated schemes: an island off Kudat or an
  // interior settlement past the end of the 11 kV network is fed by its
  // gensets and nothing else, which is the case `SitePowerRole` draws the
  // distinction for. At east-coast distances the drive is most of any
  // intervention, which is what the buckets are for.
  {id: 'pe-018',  name: 'PE-018',  kind: 'PE',        locationLabel: 'Ranau, Sabah',              latitude: 5.9540, longitude: 116.6640, loadKw: 188, customer: 'interior',   powerRole: 'STANDBY'},
  {id: 'mg-019',  name: 'MG-019',  kind: 'MINI_GRID', locationLabel: 'Nabawan, Sabah',            latitude: 5.0620, longitude: 116.4370, loadKw: 42,  customer: 'interior',   powerRole: 'PRIME'},
  {id: 'fdr-020', name: 'FDR-020', kind: 'FEEDER',    locationLabel: 'Sandakan, Sabah',           latitude: 5.8402, longitude: 118.1179, loadKw: 132, customer: 'sandakan',   powerRole: 'STANDBY'},
  {id: 'fdr-021', name: 'FDR-021', kind: 'FEEDER',    locationLabel: 'Lahad Datu, Sabah',         latitude: 5.0269, longitude: 118.3270, loadKw: 58,  customer: 'lahad-datu', powerRole: 'STANDBY'},
  {id: 'ppu-022', name: 'PPU-022', kind: 'PPU',       locationLabel: 'Batu Sapi, Sandakan',       latitude: 5.8560, longitude: 118.0210, loadKw: 296, customer: 'sandakan',   powerRole: 'STANDBY'},
  {id: 'ppu-023', name: 'PPU-023', kind: 'PPU',       locationLabel: 'Tawau, Sabah',              latitude: 4.2450, longitude: 117.8840, loadKw: 415, customer: 'tawau',      powerRole: 'STANDBY'},
  {id: 'mg-024',  name: 'MG-024',  kind: 'MINI_GRID', locationLabel: 'Kalabakan, Tawau',          latitude: 4.4210, longitude: 117.4750, loadKw: 267, customer: 'tawau',      powerRole: 'PRIME'},
  {id: 'mg-025',  name: 'MG-025',  kind: 'MINI_GRID', locationLabel: 'Pulau Larapan, Semporna',   latitude: 4.5340, longitude: 118.6540, loadKw: 37,  customer: 'tawau',      powerRole: 'PRIME'},
];

export const siteSeed = (siteId: string): SiteSeed | undefined =>
  SITE_SEED.find((seed) => seed.id === siteId);

/** `PPU-001`, for the breadcrumb and the document title. */
export const siteLabel = (siteId: string): string => siteSeed(siteId)?.name ?? 'Site';

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  PMU: 'Intake substation',
  PPU: 'Main distribution substation',
  PE: 'Distribution substation',
  FEEDER: 'Feeder injection point',
  MINI_GRID: 'Rural mini-grid',
};

/** The site the design's frame opens on, and this section's default. */
export const DEFAULT_SITE_ID = 'ppu-001';
