import type {BrandDataset} from '../types';

/**
 * The carrier estate: **a mobile operator's own tower network in Borneo**.
 *
 * Twenty-five base stations with a permanent power plant beside each, and thirty
 * machines standing on them. Nothing here is a temporary supply and nothing moves —
 * the genset is bolted to a plinth at the foot of the tower and has been for years,
 * which is the assumption every screen in this build makes.
 *
 * ## Why the estate is in Sabah and Sarawak
 *
 * It used to be a peninsular network with a Borneo tail: eight sites in the Klang
 * Valley, five up the north-west coast, and six across the sea as the interesting
 * exception. That is a fair picture of where a Malaysian carrier's *traffic* is,
 * and the wrong picture of where its **power problem** is. Every screen in this
 * build is about diesel, batteries and arrays at towers a lorry has to reach, and
 * on that estate the sites that had one were the minority.
 *
 * So the estate is now the rollout it is actually about — a Borneo build-out under
 * two programmes, `Jendela SBH` and `Jendela SWK` — with **four peninsular sites
 * kept**, one per remaining region. Those four are deliberate and not leftovers:
 * they are the grid-backed city plant the Borneo sites are being compared against,
 * they keep the region chips from collapsing to two entries, and they are the only
 * sites in the estate filed under **no programme**, which is the state the
 * settings picker has to be able to express.
 *
 * ## Why the data is here and not in the modules
 *
 * The seed rows are the half of a brand that costs something. Every id below is
 * referenced by the fleet, and every genset's `siteId` has to name a site in the
 * same file or the estate contradicts itself — `assertDatasetIntegrity` in
 * `../dataset.ts` checks exactly that on load. Keeping the two arrays side by side
 * is what makes that checkable, and what makes a second estate a new file rather
 * than a second branch.
 *
 * These are mock sites carrying mock figures, the same standing as every other
 * number in this prototype.
 */
const CUSTOMERS = [
  {id: 'sabah', name: 'Sabah Region', shortName: 'Sabah'},
  {id: 'sarawak', name: 'Sarawak Region', shortName: 'Sarawak'},
  {id: 'northern', name: 'Northern Region', shortName: 'Northern'},
  {id: 'central', name: 'Central Region', shortName: 'Central'},
  {id: 'southern', name: 'Southern Region', shortName: 'Southern'},
  {id: 'east-coast', name: 'East Coast Region', shortName: 'East Coast'},
] as const;

/**
 * The two rollout programmes this estate's Borneo sites are filed under.
 *
 * A **grouping the operator draws**, and nothing derives from it — see
 * `BrandProgram` for why region and programme are separate axes rather than one.
 * They happen to line up with the two states here, which is what a state-scoped
 * rollout looks like; the four peninsular sites are in neither, which is the case
 * that stops a reader reading programme as a second name for region.
 */
const PROGRAMS = [
  {
    id: 'jendela-sbh',
    name: 'Jendela Sabah',
    shortName: 'Jendela SBH',
    blurb: 'The Sabah coverage build — interior and island towers, most of them off-grid.',
  },
  {
    id: 'jendela-swk',
    name: 'Jendela Sarawak',
    shortName: 'Jendela SWK',
    blurb: 'The Sarawak coverage build — the Rajang corridor and the highland sites.',
  },
] as const;

/**
 * What kind of network asset a site is.
 *
 * Not decoration: it is the reason a site tolerates an outage or doesn't. A
 * switching centre and a rural coverage site with identical plant are not equally
 * covered by one working genset — one of them carries traffic for a whole state.
 * It also sets the scale a reader should expect the load in: a macro base station
 * is 4–6 kW and a switching centre is a few hundred, so "is 216 kW a lot here" has
 * no answer without this field.
 */
const SITE_KIND_LABELS = {
  CORE: 'Switching centre',
  HUB: 'Aggregation hub',
  MACRO: 'Macro base station',
  RURAL: 'Rural coverage site',
  IBS: 'In-building system',
} as const;

const SITES = [
  // — Sabah (11), all under `Jendela SBH`. The west coast strip is grid-backed
  //   and reads like any city network; everything inland or offshore of it is
  //   not, which is where this estate earns its screens. Sepanggar is the state's
  //   switching centre and the only Borneo site holding a pair of heavy sets.
  {id: 'sbh-1058', name: 'SBH-1058', kind: 'CORE',   locationLabel: 'Sepanggar, Kota Kinabalu',    latitude: 6.0670, longitude: 116.1330, loadKw: 186, customer: 'sabah',      powerRole: 'GRID_BACKUP',   program: 'jendela-sbh'},
  {id: 'sbh-1204', name: 'SBH-1204', kind: 'HUB',    locationLabel: 'Kota Kinabalu, Sabah',        latitude: 5.9804, longitude: 116.0735, loadKw: 22,  customer: 'sabah',      powerRole: 'GRID_BACKUP',   program: 'jendela-sbh'},
  {id: 'sbh-1291', name: 'SBH-1291', kind: 'MACRO',  locationLabel: 'Tuaran, Sabah',               latitude: 6.1770, longitude: 116.2330, loadKw: 6,   customer: 'sabah',      powerRole: 'GRID_BACKUP',   program: 'jendela-sbh'},
  {id: 'sbh-1336', name: 'SBH-1336', kind: 'MACRO',  locationLabel: 'Kota Belud, Sabah',           latitude: 6.3510, longitude: 116.4300, loadKw: 5,   customer: 'sabah',      powerRole: 'DIESEL_PRIME',  program: 'jendela-sbh'},
  {id: 'sbh-1377', name: 'SBH-1377', kind: 'RURAL',  locationLabel: 'Nabawan, Sabah',              latitude: 5.0620, longitude: 116.4370, loadKw: 3,   customer: 'sabah',      powerRole: 'DIESEL_PRIME',  program: 'jendela-sbh'},
  {id: 'sbh-1428', name: 'SBH-1428', kind: 'RURAL',  locationLabel: 'Pensiangan, Sabah',           latitude: 4.5330, longitude: 116.3170, loadKw: 3,   customer: 'sabah',      powerRole: 'DIESEL_PRIME',  program: 'jendela-sbh'},
  {id: 'sbh-1495', name: 'SBH-1495', kind: 'RURAL',  locationLabel: 'Pulau Banggi, Kudat',         latitude: 7.2717, longitude: 117.1782, loadKw: 4,   customer: 'sabah',      powerRole: 'DIESEL_PRIME',  program: 'jendela-sbh'},
  {id: 'sbh-1553', name: 'SBH-1553', kind: 'MACRO',  locationLabel: 'Ranau, Sabah',                latitude: 5.9540, longitude: 116.6640, loadKw: 5,   customer: 'sabah',      powerRole: 'DIESEL_PRIME', program: 'jendela-sbh'},
  {id: 'sbh-1612', name: 'SBH-1612', kind: 'MACRO',  locationLabel: 'Lahad Datu, Sabah',           latitude: 5.0269, longitude: 118.3270, loadKw: 5,   customer: 'sabah',      powerRole: 'DIESEL_PRIME', program: 'jendela-sbh'},
  {id: 'sbh-1704', name: 'SBH-1704', kind: 'HUB',    locationLabel: 'Sandakan, Sabah',             latitude: 5.8402, longitude: 118.1179, loadKw: 24,  customer: 'sabah',      powerRole: 'GRID_BACKUP',   program: 'jendela-sbh'},
  {id: 'sbh-1788', name: 'SBH-1788', kind: 'IBS',    locationLabel: 'Tawau, Sabah',                latitude: 4.2450, longitude: 117.8840, loadKw: 11,  customer: 'sabah',      powerRole: 'GRID_BACKUP',   program: 'jendela-sbh'},

  // — Sarawak (10), all under `Jendela SWK`. Kuching, Sibu, Bintulu and Miri are
  //   the coastal towns and have an incomer; the Rajang sites above Kapit and the
  //   highland site at Ba'kelalan are where the diesel goes upriver by longboat,
  //   which is why a tank running down matters more here than anywhere else.
  {id: 'swk-0412', name: 'SWK-0412', kind: 'HUB',    locationLabel: 'Kuching, Sarawak',            latitude: 1.5533, longitude: 110.3592, loadKw: 27,  customer: 'sarawak',    powerRole: 'GRID_BACKUP',   program: 'jendela-swk'},
  {id: 'swk-0487', name: 'SWK-0487', kind: 'MACRO',  locationLabel: 'Serian, Sarawak',             latitude: 1.1670, longitude: 110.5670, loadKw: 5,   customer: 'sarawak',    powerRole: 'GRID_BACKUP',   program: 'jendela-swk'},
  {id: 'swk-0559', name: 'SWK-0559', kind: 'MACRO',  locationLabel: 'Sri Aman, Sarawak',           latitude: 1.2370, longitude: 111.4630, loadKw: 5,   customer: 'sarawak',    powerRole: 'DIESEL_PRIME',  program: 'jendela-swk'},
  {id: 'swk-0663', name: 'SWK-0663', kind: 'RURAL',  locationLabel: 'Kapit, Sarawak',              latitude: 2.0170, longitude: 112.9330, loadKw: 3,   customer: 'sarawak',    powerRole: 'DIESEL_PRIME',  program: 'jendela-swk'},
  {id: 'swk-0721', name: 'SWK-0721', kind: 'MACRO',  locationLabel: 'Sibu, Sarawak',               latitude: 2.2870, longitude: 111.8310, loadKw: 6,   customer: 'sarawak',    powerRole: 'GRID_BACKUP',   program: 'jendela-swk'},
  {id: 'swk-0794', name: 'SWK-0794', kind: 'RURAL',  locationLabel: 'Song, Sarawak',               latitude: 2.0170, longitude: 112.5420, loadKw: 3,   customer: 'sarawak',    powerRole: 'DIESEL_PRIME', program: 'jendela-swk'},
  {id: 'swk-0851', name: 'SWK-0851', kind: 'RURAL',  locationLabel: 'Belaga, Sarawak',             latitude: 2.7000, longitude: 113.7830, loadKw: 4,   customer: 'sarawak',    powerRole: 'DIESEL_PRIME',  program: 'jendela-swk'},
  {id: 'swk-0918', name: 'SWK-0918', kind: 'HUB',    locationLabel: 'Bintulu, Sarawak',            latitude: 3.1700, longitude: 113.0410, loadKw: 24,  customer: 'sarawak',    powerRole: 'GRID_BACKUP',   program: 'jendela-swk'},
  {id: 'swk-1027', name: 'SWK-1027', kind: 'MACRO',  locationLabel: 'Miri, Sarawak',               latitude: 4.3990, longitude: 113.9910, loadKw: 6,   customer: 'sarawak',    powerRole: 'GRID_BACKUP',   program: 'jendela-swk'},
  {id: 'swk-1163', name: 'SWK-1163', kind: 'RURAL',  locationLabel: "Ba'kelalan, Sarawak",         latitude: 3.9670, longitude: 115.6170, loadKw: 4,   customer: 'sarawak',    powerRole: 'DIESEL_PRIME',  program: 'jendela-swk'},

  // — The peninsula (4), one per remaining region and **in no programme**. The
  //   two switching centres are here, which is where a carrier's heavy plant
  //   actually is, and they are the estate's baseline: a pair of 1000 kVA sets
  //   behind a healthy incomer, against which a 15 kVA set on the Rajang is the
  //   thing this product has something to say about.
  {id: 'wpkl-0207', name: 'WPKL-0207', kind: 'CORE',  locationLabel: 'Bangsar South, Kuala Lumpur',  latitude: 3.1109, longitude: 101.6640, loadKw: 205, customer: 'central',    powerRole: 'GRID_BACKUP'},
  {id: 'jhr-0907',  name: 'JHR-0907',  kind: 'CORE',  locationLabel: 'Johor Bahru, Johor',           latitude: 1.4927, longitude: 103.7414, loadKw: 168, customer: 'southern',   powerRole: 'GRID_BACKUP'},
  {id: 'png-0255',  name: 'PNG-0255',  kind: 'HUB',   locationLabel: 'Bayan Lepas, Penang',          latitude: 5.2945, longitude: 100.2760, loadKw: 24,  customer: 'northern',   powerRole: 'GRID_BACKUP'},
  {id: 'trg-0512',  name: 'TRG-0512',  kind: 'MACRO', locationLabel: 'Kuala Terengganu, Terengganu', latitude: 5.3302, longitude: 103.1408, loadKw: 6,   customer: 'east-coast', powerRole: 'GRID_BACKUP'},
] as const;

/**
 * The machines, and which plinth each one stands on.
 *
 * Grouped by what the site is, because the plant follows from it: a switching
 * centre holds a pair of 1000 kVA sets and a rural tower holds one 20 kVA.
 */
const GENSETS = [
  // — The switching centres (6) — the estate's heavy plant, and the only sites
  //   here that hold a pair. `BRF9540` and its twin are the Figma frame's two
  //   identical genset cards, one running and one on standby, and `BRF9540` is
  //   pinned by name in `genset/data/detail.ts` — it does not move.
  {tag: 'CUM-739893', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'wpkl-0207', locationLabel: 'Bangsar South, Kuala Lumpur',  latitude: 3.1105, longitude: 101.6634, fuelLitres: 1763, fuelCapacityLitres: 2450, staleMinutes: 57, plateNumber: 'SAC 5385 D'},
  {tag: 'CUM-303952', model: 'Cummins 1000 kVa',    runState: 'IDLE',    siteId: 'wpkl-0207', locationLabel: 'Bangsar South, Kuala Lumpur',  latitude: 3.1113, longitude: 101.6646, fuelLitres: 214,  fuelCapacityLitres: 2450, staleMinutes: 45, plateNumber: 'SA 4562 D'},
  {tag: 'CUM-408590', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'jhr-0907',  locationLabel: 'Johor Bahru, Johor',           latitude: 1.4923, longitude: 103.7408, fuelLitres: 1088, fuelCapacityLitres: 1200, staleMinutes: 3, plateNumber: 'SAC 1975 A'},
  {tag: 'CUM-142482', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'jhr-0907',  locationLabel: 'Johor Bahru, Johor',           latitude: 1.4931, longitude: 103.7420, fuelLitres: 936,  fuelCapacityLitres: 1200, staleMinutes: 8, plateNumber: 'SAB 3969 B'},
  {tag: 'CUM-222728', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'sbh-1058',  locationLabel: 'Sepanggar, Kota Kinabalu',     latitude: 6.0664, longitude: 116.1324, fuelLitres: 977,  fuelCapacityLitres: 1200, staleMinutes: 6, plateNumber: 'ST 2648 W'},
  {tag: 'CUM-953459', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'sbh-1058',  locationLabel: 'Sepanggar, Kota Kinabalu',     latitude: 6.0676, longitude: 116.1338, fuelLitres: 742,  fuelCapacityLitres: 1200, staleMinutes: 19, plateNumber: 'SB 1812 H'},

  // — The aggregation hubs (5) — 60 kVA against a 22–27 kW load.
  {tag: 'PRK-882799', model: 'Perkins 60 kVa',      runState: 'RUNNING', siteId: 'sbh-1204',  locationLabel: 'Kota Kinabalu, Sabah',         latitude: 5.9804, longitude: 116.0735, fuelLitres: 220,  fuelCapacityLitres: 900,  staleMinutes: 12, plateNumber: 'QS 8279 H'},
  {tag: 'PRK-279322', model: 'Perkins 60 kVa',      runState: 'IDLE',    siteId: 'sbh-1704',  locationLabel: 'Sandakan, Sabah',              latitude: 5.8402, longitude: 118.1179, fuelLitres: 693,  fuelCapacityLitres: 900,  staleMinutes: 9, plateNumber: 'QA 1204 P'},
  {tag: 'PRK-243887', model: 'Perkins 60 kVa',      runState: 'IDLE',    siteId: 'swk-0412',  locationLabel: 'Kuching, Sarawak',             latitude: 1.5533, longitude: 110.3592, fuelLitres: 612,  fuelCapacityLitres: 900,  staleMinutes: 12, plateNumber: 'SAB 2877 W'},
  {tag: 'PRK-606662', model: 'Perkins 60 kVa',      runState: 'IDLE',    siteId: 'swk-0918',  locationLabel: 'Bintulu, Sarawak',             latitude: 3.1700, longitude: 113.0410, fuelLitres: 781,  fuelCapacityLitres: 900,  staleMinutes: 4, plateNumber: 'ST 7155 W'},
  {tag: 'PRK-930666', model: 'Perkins 60 kVa',      runState: 'IDLE',    siteId: 'png-0255',  locationLabel: 'Bayan Lepas, Penang',          latitude: 5.2945, longitude: 100.2760, fuelLitres: 774,  fuelCapacityLitres: 900,  staleMinutes: 2, plateNumber: 'QS 7644 H'},

  // — The grid-backed towers (7) — 20 kVA on a plinth, idle most of the year.
  //   `TUA2910` and `SER4870` are the two sets pinned to a test exercise: turning
  //   beside a perfectly healthy incomer, which is the case that distinction
  //   exists for. `KTN1970` is the estate's silent unit — nothing heard in two
  //   days, at the one east-coast site.
  {tag: 'FGW-431307', model: 'FG Wilson 30 kVa',    runState: 'IDLE',    siteId: 'sbh-1788',  locationLabel: 'Tawau, Sabah',                 latitude: 4.2450, longitude: 117.8840, fuelLitres: 430,  fuelCapacityLitres: 600,  staleMinutes: 4, plateNumber: 'QM 6462 S'},
  {tag: 'FGW-467022', model: 'FG Wilson 20 kVa',    runState: 'RUNNING', siteId: 'sbh-1291',  locationLabel: 'Tuaran, Sabah',                latitude: 6.1770, longitude: 116.2330, fuelLitres: 364,  fuelCapacityLitres: 400,  staleMinutes: 5,  startReason: 'TEST', plateNumber: 'SA 7918 S'},
  {tag: 'FGW-428760', model: 'FG Wilson 20 kVa',    runState: 'RUNNING', siteId: 'swk-0487',  locationLabel: 'Serian, Sarawak',              latitude: 1.1670, longitude: 110.5670, fuelLitres: 305,  fuelCapacityLitres: 400,  staleMinutes: 4,  startReason: 'TEST', plateNumber: 'SD 9478 E'},
  {tag: 'FGW-948756', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'swk-0721',  locationLabel: 'Sibu, Sarawak',                latitude: 2.2870, longitude: 111.8310, fuelLitres: 288,  fuelCapacityLitres: 400,  staleMinutes: 3, plateNumber: 'SA 8908 H'},
  {tag: 'FGW-501869', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'swk-1027',  locationLabel: 'Miri, Sarawak',                latitude: 4.3990, longitude: 113.9910, fuelLitres: 352,  fuelCapacityLitres: 400,  staleMinutes: 7, plateNumber: 'QM 9841 R'},
  {tag: 'FGW-954710', model: 'FG Wilson 20 kVa',    runState: 'OFFLINE', siteId: 'trg-0512',  locationLabel: 'Kuala Terengganu, Terengganu', latitude: 5.3302, longitude: 103.1408, fuelLitres: 96,   fuelCapacityLitres: 400,  staleMinutes: 2_890, plateNumber: 'SAB 1169 H'},

  // — The diesel-prime sites (6) — no incomer, no storage, a duty set and a
  //   spare at the two worst-served, and the machines that have burned the most
  //   diesel on the estate. The two dry tanks are here, which is the point: a
  //   prime site's tank is the only thing between the tower and silence, and both
  //   of these are at the far end of a river or a logging road.
  {tag: 'DNY-486711', model: 'Denyo 15 kVa',        runState: 'RUNNING', siteId: 'sbh-1377',  locationLabel: 'Nabawan, Sabah',               latitude: 5.0620, longitude: 116.4370, fuelLitres: 168,  fuelCapacityLitres: 800,  staleMinutes: 38, plateNumber: 'SB 2287 W'},
  {tag: 'DNY-368567', model: 'Denyo 15 kVa',        runState: 'IDLE',    siteId: 'sbh-1377',  locationLabel: 'Nabawan, Sabah',               latitude: 5.0626, longitude: 116.4378, fuelLitres: 546,  fuelCapacityLitres: 800,  staleMinutes: 26, plateNumber: 'SAB 8995 B'},
  {tag: 'DNY-367119', model: 'Denyo 15 kVa',        runState: 'RUNNING', siteId: 'sbh-1428',  locationLabel: 'Pensiangan, Sabah',            latitude: 4.5330, longitude: 116.3170, fuelLitres: 108,  fuelCapacityLitres: 800,  staleMinutes: 9, plateNumber: 'SA 6948 T'},
  {tag: 'DNY-619585', model: 'Denyo 15 kVa',        runState: 'RUNNING', siteId: 'swk-0663',  locationLabel: 'Kapit, Sarawak',               latitude: 2.0170, longitude: 112.9330, fuelLitres: 96,   fuelCapacityLitres: 800,  staleMinutes: 27, plateNumber: 'SAB 9831 L'},
  {tag: 'DNY-215418', model: 'Denyo 15 kVa',        runState: 'IDLE',    siteId: 'swk-0663',  locationLabel: 'Kapit, Sarawak',               latitude: 2.0176, longitude: 112.9338, fuelLitres: 511,  fuelCapacityLitres: 800,  staleMinutes: 95, plateNumber: 'SAA 3131 H'},
  {tag: 'DNY-758670', model: 'Denyo 15 kVa',        runState: 'OFFLINE', siteId: 'swk-0851',  locationLabel: 'Belaga, Sarawak',              latitude: 2.7000, longitude: 113.7830, fuelLitres: 172,  fuelCapacityLitres: 800,  staleMinutes: 1_615, plateNumber: 'SAA 4956 W'},

  // — The diesel-hybrid sites (3) — the same 20 kVA machine, running in blocks
  //   to recharge a battery instead of idling all day at what a tower draws.
  //   Their tanks are the fullest on the estate for exactly that reason.
  {tag: 'FGW-135607', model: 'FG Wilson 20 kVa',    runState: 'RUNNING', siteId: 'sbh-1553',  locationLabel: 'Ranau, Sabah',                 latitude: 5.9540, longitude: 116.6640, fuelLitres: 502,  fuelCapacityLitres: 600,  staleMinutes: 6, plateNumber: 'SAC 1492 D'},
  {tag: 'FGW-359597', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sbh-1612',  locationLabel: 'Lahad Datu, Sabah',            latitude: 5.0269, longitude: 118.3270, fuelLitres: 488,  fuelCapacityLitres: 600,  staleMinutes: 21, plateNumber: 'QA 8401 L'},
  {tag: 'FGW-287781', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'swk-0794',  locationLabel: 'Song, Sarawak',                latitude: 2.0170, longitude: 112.5420, fuelLitres: 331,  fuelCapacityLitres: 400,  staleMinutes: 44, plateNumber: 'ST 4461 G'},

  // — The solar-hybrid sites (4) — the same set again, and the least-used
  //   machines on the estate. A full tank on one of these is not neglect; it is
  //   the array having carried the site since the last delivery.
  {tag: 'FGW-497643', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sbh-1336',  locationLabel: 'Kota Belud, Sabah',            latitude: 6.3510, longitude: 116.4300, fuelLitres: 566,  fuelCapacityLitres: 600,  staleMinutes: 2, plateNumber: 'QS 9224 T'},
  {tag: 'FGW-140106', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sbh-1495',  locationLabel: 'Pulau Banggi, Kudat',          latitude: 7.2717, longitude: 117.1782, fuelLitres: 588,  fuelCapacityLitres: 600,  staleMinutes: 5, plateNumber: 'SAC 1255 R'},
  {tag: 'FGW-344581', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'swk-0559',  locationLabel: 'Sri Aman, Sarawak',            latitude: 1.2370, longitude: 111.4630, fuelLitres: 392,  fuelCapacityLitres: 400,  staleMinutes: 31, plateNumber: 'SB 5161 S'},
  {tag: 'FGW-645179', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'swk-1163',  locationLabel: "Ba'kelalan, Sarawak",          latitude: 3.9670, longitude: 115.6170, fuelLitres: 448,  fuelCapacityLitres: 600,  staleMinutes: 73, plateNumber: 'SA 1671 S'},
] as const;

export const CARRIER_DATASET: BrandDataset = {
  id: 'carrier',
  label: 'Carrier tower network',
  groupingLabel: 'By region',
  // Bolted to a plinth at the foot of a tower, which is the assumption every
  // screen on this estate makes. The rail keeps Sites.
  plant: 'stationary',
  customers: CUSTOMERS,
  programs: PROGRAMS,
  siteKindLabels: SITE_KIND_LABELS,
  sites: SITES,
  gensets: GENSETS,
  // A solar hybrid rather than the first row: it is the configuration this estate
  // is about, and the one whose site page has every band on it. Ba'kelalan is the
  // furthest site from a road on the estate, which is the case for the array.
  defaultSiteId: 'swk-1163',
  defaultGensetId: 'cum-739893',
};
