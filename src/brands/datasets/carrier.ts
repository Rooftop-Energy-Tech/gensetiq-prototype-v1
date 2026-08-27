import type {BrandDataset} from '../types';

/**
 * The carrier estate: **a mobile operator's own tower network**.
 *
 * Twenty-five base stations with a permanent power plant beside each, and
 * twenty-nine machines standing on them. Nothing here is a temporary supply and
 * nothing moves — the genset is bolted to a plinth at the foot of the tower and
 * has been for years, which is the assumption every screen in this build makes.
 *
 * Lifted verbatim from `site/data/siteSeed.ts` and `genset/data/fleet.ts`, where
 * it was the only estate the app could have. Values are unchanged; the comments
 * explaining each cluster came with it.
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
  {id: 'northern', name: 'Northern Region', shortName: 'Northern', peakSunHours: 3.7},
  {id: 'central', name: 'Central Region', shortName: 'Central', peakSunHours: 3.5},
  {id: 'southern', name: 'Southern Region', shortName: 'Southern', peakSunHours: 3.5},
  {id: 'east-coast', name: 'East Coast Region', shortName: 'East Coast', peakSunHours: 3.4},
  {id: 'sabah', name: 'Sabah Region', shortName: 'Sabah', peakSunHours: 3.4},
  {id: 'sarawak', name: 'Sarawak Region', shortName: 'Sarawak', peakSunHours: 3.3},
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
] as const;

/**
 * The machines, and which plinth each one stands on.
 *
 * Grouped by what the site is, because the plant follows from it: a switching
 * centre holds a pair of 1000 kVA sets and a rural tower holds one 20 kVA.
 */
const GENSETS = [
  // — The two switching centres (4) — the estate's heavy plant, and the only
  //   sites here that hold a pair. `BRF9540` and its twin are the Figma frame's
  //   two identical genset cards, one running and one faulted.
  {tag: 'BRF9540', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'wpkl-0207', locationLabel: 'Bangsar South, Kuala Lumpur',  latitude: 3.1105, longitude: 101.6634, fuelLitres: 1763, fuelCapacityLitres: 2450, staleMinutes: 57},
  {tag: 'KLN3355', model: 'Cummins 1000 kVa',    runState: 'FAULT',   siteId: 'wpkl-0207', locationLabel: 'Bangsar South, Kuala Lumpur',  latitude: 3.1113, longitude: 101.6646, fuelLitres: 214,  fuelCapacityLitres: 2450, staleMinutes: 45},
  {tag: 'JHB5503', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'jhr-0907',  locationLabel: 'Johor Bahru, Johor',           latitude: 1.4923, longitude: 103.7408, fuelLitres: 1088, fuelCapacityLitres: 1200, staleMinutes: 3},
  {tag: 'JHB5744', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'jhr-0907',  locationLabel: 'Johor Bahru, Johor',           latitude: 1.4931, longitude: 103.7420, fuelLitres: 936,  fuelCapacityLitres: 1200, staleMinutes: 8},

  // — The aggregation hubs (3) — 60 kVA against a 22–27 kW load.
  {tag: 'SHA7731', model: 'Perkins 60 kVa',      runState: 'IDLE',    siteId: 'sel-0318',  locationLabel: 'Shah Alam, Selangor',          latitude: 3.0733, longitude: 101.5185, fuelLitres: 612,  fuelCapacityLitres: 900,  staleMinutes: 12},
  {tag: 'PNG6015', model: 'Perkins 60 kVa',      runState: 'IDLE',    siteId: 'png-0255',  locationLabel: 'Bayan Lepas, Penang',          latitude: 5.2945, longitude: 100.2760, fuelLitres: 774,  fuelCapacityLitres: 900,  staleMinutes: 2},
  {tag: 'KKB8856', model: 'Perkins 60 kVa',      runState: 'RUNNING', siteId: 'sbh-1204',  locationLabel: 'Kota Kinabalu, Sabah',         latitude: 5.9804, longitude: 116.0735, fuelLitres: 220,  fuelCapacityLitres: 900,  staleMinutes: 12},

  // — The grid-backed towers (7) — 20 kVA on a plinth, idle most of the year.
  //   `SPG2093` is one of the two sets pinned to a test exercise: turning beside
  //   a perfectly healthy incomer, which is the case that distinction exists for.
  {tag: 'KLC1027', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'wpkl-0142', locationLabel: 'Bukit Bintang, Kuala Lumpur',  latitude: 3.1466, longitude: 101.7108, fuelLitres: 288,  fuelCapacityLitres: 400,  staleMinutes: 3},
  {tag: 'KLG2214', model: 'FG Wilson 30 kVa',    runState: 'IDLE',    siteId: 'wpkl-0355', locationLabel: 'KLCC, Kuala Lumpur',           latitude: 3.1578, longitude: 101.7117, fuelLitres: 430,  fuelCapacityLitres: 600,  staleMinutes: 4},
  {tag: 'SPG2093', model: 'FG Wilson 20 kVa',    runState: 'RUNNING', siteId: 'sel-0491',  locationLabel: 'Puchong, Selangor',            latitude: 3.0319, longitude: 101.6169, fuelLitres: 364,  fuelCapacityLitres: 400,  staleMinutes: 5,  startReason: 'TEST'},
  {tag: 'RWG3471', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sel-0664',  locationLabel: 'Rawang, Selangor',             latitude: 3.3210, longitude: 101.5770, fuelLitres: 141,  fuelCapacityLitres: 400,  staleMinutes: 8},
  {tag: 'IPH7724', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'prk-0713',  locationLabel: 'Ipoh, Perak',                  latitude: 4.5975, longitude: 101.0901, fuelLitres: 352,  fuelCapacityLitres: 400,  staleMinutes: 7},
  {tag: 'SRB6644', model: 'FG Wilson 20 kVa',    runState: 'RUNNING', siteId: 'nsn-0492',  locationLabel: 'Seremban, Negeri Sembilan',    latitude: 2.7297, longitude: 101.9381, fuelLitres: 305,  fuelCapacityLitres: 400,  staleMinutes: 4,  startReason: 'TEST'},
  {tag: 'KTN1970', model: 'FG Wilson 20 kVa',    runState: 'OFFLINE', siteId: 'trg-0512',  locationLabel: 'Kuala Terengganu, Terengganu', latitude: 5.3302, longitude: 103.1408, fuelLitres: 96,   fuelCapacityLitres: 400,  staleMinutes: 2_890},

  // — The diesel-prime sites (4) — no incomer, no storage, a duty set and a
  //   spare, and the machines that have burned the most diesel on the estate.
  //   The two dry tanks are here, which is the point: a prime site's tank is the
  //   only thing between the tower and silence.
  {tag: 'CAM4471', model: 'Denyo 15 kVa',        runState: 'RUNNING', siteId: 'phg-0788',  locationLabel: 'Cameron Highlands, Pahang',    latitude: 4.4710, longitude: 101.3770, fuelLitres: 108,  fuelCapacityLitres: 800,  staleMinutes: 9},
  {tag: 'CAM4629', model: 'Denyo 15 kVa',        runState: 'IDLE',    siteId: 'phg-0788',  locationLabel: 'Cameron Highlands, Pahang',    latitude: 4.4716, longitude: 101.3778, fuelLitres: 546,  fuelCapacityLitres: 800,  staleMinutes: 26},
  {tag: 'GMS2218', model: 'Denyo 15 kVa',        runState: 'RUNNING', siteId: 'kel-0339',  locationLabel: 'Gua Musang, Kelantan',         latitude: 4.8820, longitude: 101.9670, fuelLitres: 402,  fuelCapacityLitres: 800,  staleMinutes: 11},
  {tag: 'GMS2404', model: 'Denyo 15 kVa',        runState: 'FAULT',   siteId: 'kel-0339',  locationLabel: 'Gua Musang, Kelantan',         latitude: 4.8826, longitude: 101.9678, fuelLitres: 511,  fuelCapacityLitres: 800,  staleMinutes: 95},
  {tag: 'NBW7756', model: 'Denyo 15 kVa',        runState: 'RUNNING', siteId: 'sbh-1377',  locationLabel: 'Nabawan, Sabah',               latitude: 5.0620, longitude: 116.4370, fuelLitres: 168,  fuelCapacityLitres: 800,  staleMinutes: 38},
  {tag: 'KPT8033', model: 'Denyo 15 kVa',        runState: 'RUNNING', siteId: 'swk-0663',  locationLabel: 'Kapit, Sarawak',               latitude: 2.0170, longitude: 112.9330, fuelLitres: 96,   fuelCapacityLitres: 800,  staleMinutes: 27},
  {tag: 'BLG4884', model: 'Denyo 15 kVa',        runState: 'OFFLINE', siteId: 'swk-0851',  locationLabel: 'Belaga, Sarawak',              latitude: 2.7000, longitude: 113.7830, fuelLitres: 172,  fuelCapacityLitres: 800,  staleMinutes: 1_615},

  // — The diesel-hybrid sites (4) — the same 20 kVA machine, running in blocks
  //   to recharge a battery instead of idling all day at what a tower draws.
  //   Their tanks are the fullest on the estate for exactly that reason.
  {tag: 'SPG7712', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sel-0977',  locationLabel: 'Sepang, Selangor',             latitude: 2.7150, longitude: 101.7060, fuelLitres: 348,  fuelCapacityLitres: 400,  staleMinutes: 16},
  {tag: 'GRK0846', model: 'FG Wilson 20 kVa',    runState: 'RUNNING', siteId: 'prk-0846',  locationLabel: 'Grik, Perak',                  latitude: 5.4290, longitude: 101.1290, fuelLitres: 502,  fuelCapacityLitres: 600,  staleMinutes: 6},
  {tag: 'KLG1064', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'jhr-1064',  locationLabel: 'Kluang, Johor',                latitude: 2.0250, longitude: 103.3180, fuelLitres: 331,  fuelCapacityLitres: 400,  staleMinutes: 44},
  {tag: 'LDU7588', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sbh-1612',  locationLabel: 'Lahad Datu, Sabah',            latitude: 5.0269, longitude: 118.3270, fuelLitres: 488,  fuelCapacityLitres: 600,  staleMinutes: 21},

  // — The solar-hybrid sites (4) — the same set again, and the least-used
  //   machines on the estate. A full tank on one of these is not neglect; it is
  //   the array having carried the site since the last delivery.
  {tag: 'HLG0812', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sel-0812',  locationLabel: 'Hulu Langat, Selangor',        latitude: 3.1590, longitude: 101.8710, fuelLitres: 392,  fuelCapacityLitres: 400,  staleMinutes: 31},
  {tag: 'SGP0431', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'kdh-0431',  locationLabel: 'Sungai Petani, Kedah',         latitude: 5.6470, longitude: 100.4870, fuelLitres: 566,  fuelCapacityLitres: 600,  staleMinutes: 2},
  {tag: 'SIK0588', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'kdh-0588',  locationLabel: 'Sik, Kedah',                   latitude: 5.8210, longitude: 100.7420, fuelLitres: 448,  fuelCapacityLitres: 600,  staleMinutes: 73},
  {tag: 'BGI1495', model: 'FG Wilson 20 kVa',    runState: 'IDLE',    siteId: 'sbh-1495',  locationLabel: 'Pulau Banggi, Kudat',          latitude: 7.2717, longitude: 117.1782, fuelLitres: 588,  fuelCapacityLitres: 600,  staleMinutes: 5},
] as const;

export const CARRIER_DATASET: BrandDataset = {
  id: 'carrier',
  label: 'Carrier tower network',
  groupingLabel: 'By region',
  customers: CUSTOMERS,
  siteKindLabels: SITE_KIND_LABELS,
  sites: SITES,
  gensets: GENSETS,
  // A solar hybrid rather than the first row: it is the configuration this estate
  // is about, and the one whose site page has every band on it.
  defaultSiteId: 'kdh-0431',
  defaultGensetId: 'brf9540',
};
