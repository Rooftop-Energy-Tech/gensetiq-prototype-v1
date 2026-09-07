import type {BrandDataset} from '../types';

/**
 * The utility estate: **a state distribution licensee's own injection points**.
 *
 * Twenty-five substations, feeder points and rural mini-grids across Sabah and
 * Labuan, with thirty-seven machines standing on them. Recovered from
 * `feat/sesb-demo`, which is where it was stranded — the branch predates the
 * hybrid plant, the generation series and the energy screen, and every one of
 * those was invisible on it.
 *
 * ## Why the power roles are re-expressed rather than restored
 *
 * The SESB branch shipped a two-entry vocabulary: `STANDBY` (a mains incomer, a
 * genset behind it) and `PRIME` (the genset *is* the supply). The CelcomDigi
 * branch replaced it with four, splitting prime into `DIESEL_PRIME`,
 * `DIESEL_HYBRID` and `SOLAR_HYBRID`, because a battery and an array had to be
 * nameable before anything could be drawn for them.
 *
 * Restoring the old two would have made this dataset a second product model
 * wearing a brand's name, and every hybrid screen would be dark on it. So the
 * mapping is:
 *
 *  - `STANDBY` → `GRID_BACKUP`, unchanged in meaning. Twenty of the twenty-five.
 *  - `PRIME` → one of the three no-incomer configurations, per site.
 *
 * The five mini-grids are where that second line is a judgement, and it is worth
 * stating rather than hiding. They were all `PRIME`, and a rural island grid
 * running trucked diesel is precisely the site a hybrid conversion is proposed
 * for, so three now carry an array, one carries storage alone, and **Kalabakan
 * stays pure diesel prime on purpose** — a demo that converted everything would
 * have nothing left to compare a conversion against. That is a plausible estate,
 * not a recorded one, and nobody should quote these five roles back to SESB as
 * their own plan.
 *
 * These are mock sites carrying mock figures, the same standing as every other
 * number in this prototype.
 */

/**
 * Distribution zones, and the sun each one gets.
 *
 * The zone list is SESB's own operating divisions, in the order a control room
 * reads the state — west coast first, then the northern tip, the interior, and
 * down the east coast. `peakSunHours` is new here: the branch this came from had
 * no solar in it at all, so the figures are Sabah regional irradiance estimates, pulled
 * back in the interior where the highlands hold cloud and pushed up on the two
 * island-facing zones.
 */
const CUSTOMERS = [
  {id: 'west-coast', name: 'West Coast Distribution', shortName: 'West Coast', peakSunHours: 3.4},
  {id: 'kudat', name: 'Kudat Distribution', shortName: 'Kudat', peakSunHours: 3.5},
  {id: 'interior', name: 'Interior Distribution', shortName: 'Interior', peakSunHours: 3.2},
  {id: 'sandakan', name: 'Sandakan Distribution', shortName: 'Sandakan', peakSunHours: 3.3},
  {id: 'lahad-datu', name: 'Lahad Datu Distribution', shortName: 'Lahad Datu', peakSunHours: 3.4},
  {id: 'tawau', name: 'Tawau Distribution', shortName: 'Tawau', peakSunHours: 3.4},
  {id: 'labuan', name: 'Labuan Distribution', shortName: 'Labuan', peakSunHours: 3.5},
] as const;

/**
 * The capital programmes this estate's sites are filed under.
 *
 * Two, and **most sites are in neither** — which is the honest shape of a utility's
 * capital plan and the reason `program` is optional. A distribution substation that
 * has been standing in Luyang for thirty years is not part of a programme; it is
 * just the network. The programmes are the work being *done to* the estate, and
 * filing every row under one to avoid a blank would make the grouping useless the
 * moment somebody filtered by it.
 */
const PROGRAMS = [
  {
    id: 'rural-electrification',
    name: 'Rural Electrification Programme',
    shortName: 'Rural Electrification',
    blurb: 'The off-grid mini-grids — island and interior supply, and the diesel behind it.',
  },
  {
    id: 'east-coast-reinforcement',
    name: 'East Coast Reinforcement',
    shortName: 'East Coast Reinforcement',
    blurb: 'The Sandakan, Lahad Datu and Tawau injection points being reinforced.',
  },
] as const;

/**
 * What kind of node on the network a site is.
 *
 * The utility equivalent of the carrier's tower classes, and it does the same job:
 * it sets the load scale a reader should expect. An intake substation is a few
 * hundred kilowatts and a rural mini-grid is tens, so the same figure means
 * opposite things at two rows of the same table.
 */
const SITE_KIND_LABELS = {
  PMU: 'Intake substation',
  PPU: 'Main distribution substation',
  PE: 'Distribution substation',
  FEEDER: 'Feeder injection point',
  MINI_GRID: 'Rural mini-grid',
} as const;

const SITES = [
  // — Greater Kota Kinabalu — the cluster in the map view.
  {id: 'ppu-001', name: 'PPU-001', kind: 'PPU',       locationLabel: 'Luyang, Kota Kinabalu',      latitude: 5.9560, longitude: 116.0810, loadKw: 205, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'ppu-002', name: 'PPU-002', kind: 'PPU',       locationLabel: 'Sepanggar, Sabah',           latitude: 6.0670, longitude: 116.1330, loadKw: 380, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'pe-003',  name: 'PE-003',  kind: 'PE',        locationLabel: 'Penampang, Sabah',           latitude: 5.9370, longitude: 116.1120, loadKw: 177, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'pe-004',  name: 'PE-004',  kind: 'PE',        locationLabel: 'Inanam, Sabah',              latitude: 5.9800, longitude: 116.1290, loadKw: 233, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'ppu-005', name: 'PPU-005', kind: 'PPU',       locationLabel: 'Kota Kinabalu City Centre',  latitude: 5.9860, longitude: 116.0760, loadKw: 332, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'pe-006',  name: 'PE-006',  kind: 'PE',        locationLabel: 'Bukit Padang, Kota Kinabalu',latitude: 5.9500, longitude: 116.0880, loadKw: 742, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'pe-007',  name: 'PE-007',  kind: 'PE',        locationLabel: 'Telipok, Sabah',             latitude: 6.1230, longitude: 116.1740, loadKw: 102, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'ppu-008', name: 'PPU-008', kind: 'PPU',       locationLabel: 'Tanjung Aru, Kota Kinabalu', latitude: 5.9370, longitude: 116.0510, loadKw: 169, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  // — The west-coast corridor north and south of the city.
  {id: 'ppu-009', name: 'PPU-009', kind: 'PPU',       locationLabel: 'Tuaran, Sabah',              latitude: 6.1770, longitude: 116.2330, loadKw: 313, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'ppu-010', name: 'PPU-010', kind: 'PPU',       locationLabel: 'Kota Belud, Sabah',          latitude: 6.3510, longitude: 116.4300, loadKw: 364, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'pe-011',  name: 'PE-011',  kind: 'PE',        locationLabel: 'Kudat, Sabah',               latitude: 6.8830, longitude: 116.8440, loadKw: 71,  customer: 'kudat',      powerRole: 'GRID_BACKUP'},
  {id: 'mg-012',  name: 'MG-012',  kind: 'MINI_GRID', locationLabel: 'Pulau Banggi, Kudat',        latitude: 7.2717, longitude: 117.1782, loadKw: 248, customer: 'kudat',      powerRole: 'SOLAR_HYBRID', program: 'rural-electrification'},
  {id: 'ppu-013', name: 'PPU-013', kind: 'PPU',       locationLabel: 'Keningau, Sabah',            latitude: 5.3380, longitude: 116.1600, loadKw: 242, customer: 'interior',   powerRole: 'GRID_BACKUP'},
  {id: 'pe-014',  name: 'PE-014',  kind: 'PE',        locationLabel: 'Victoria, Labuan',           latitude: 5.2767, longitude: 115.2417, loadKw: 218, customer: 'labuan',     powerRole: 'GRID_BACKUP'},
  {id: 'pe-015',  name: 'PE-015',  kind: 'PE',        locationLabel: 'Papar, Sabah',               latitude: 5.7330, longitude: 115.9330, loadKw: 175, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'pmu-016', name: 'PMU-016', kind: 'PMU',       locationLabel: 'Sepanggar Bay, Sabah',       latitude: 6.0830, longitude: 116.1080, loadKw: 281, customer: 'west-coast', powerRole: 'GRID_BACKUP'},
  {id: 'mg-017',  name: 'MG-017',  kind: 'MINI_GRID', locationLabel: 'Kemabong, Tenom',            latitude: 4.9670, longitude: 115.9640, loadKw: 64,  customer: 'interior',   powerRole: 'DIESEL_HYBRID', program: 'rural-electrification'},
  // — The interior and the east coast — where the mini-grids are.
  //
  // The five `PRIME` yards are isolated schemes: an island off Kudat or an
  // interior settlement past the end of the 11 kV network is fed by its
  // gensets and nothing else, which is the case `SitePowerRole` draws the
  // distinction for. At east-coast distances the drive is most of any
  // intervention, which is what the buckets are for.
  {id: 'pe-018',  name: 'PE-018',  kind: 'PE',        locationLabel: 'Ranau, Sabah',              latitude: 5.9540, longitude: 116.6640, loadKw: 188, customer: 'interior',   powerRole: 'GRID_BACKUP'},
  {id: 'mg-019',  name: 'MG-019',  kind: 'MINI_GRID', locationLabel: 'Nabawan, Sabah',            latitude: 5.0620, longitude: 116.4370, loadKw: 42,  customer: 'interior',   powerRole: 'SOLAR_HYBRID', program: 'rural-electrification'},
  {id: 'fdr-020', name: 'FDR-020', kind: 'FEEDER',    locationLabel: 'Sandakan, Sabah',           latitude: 5.8402, longitude: 118.1179, loadKw: 132, customer: 'sandakan',   powerRole: 'GRID_BACKUP', program: 'east-coast-reinforcement'},
  {id: 'fdr-021', name: 'FDR-021', kind: 'FEEDER',    locationLabel: 'Lahad Datu, Sabah',         latitude: 5.0269, longitude: 118.3270, loadKw: 58,  customer: 'lahad-datu', powerRole: 'GRID_BACKUP', program: 'east-coast-reinforcement'},
  {id: 'ppu-022', name: 'PPU-022', kind: 'PPU',       locationLabel: 'Batu Sapi, Sandakan',       latitude: 5.8560, longitude: 118.0210, loadKw: 296, customer: 'sandakan',   powerRole: 'GRID_BACKUP', program: 'east-coast-reinforcement'},
  {id: 'ppu-023', name: 'PPU-023', kind: 'PPU',       locationLabel: 'Tawau, Sabah',              latitude: 4.2450, longitude: 117.8840, loadKw: 415, customer: 'tawau',      powerRole: 'GRID_BACKUP', program: 'east-coast-reinforcement'},
  {id: 'mg-024',  name: 'MG-024',  kind: 'MINI_GRID', locationLabel: 'Kalabakan, Tawau',          latitude: 4.4210, longitude: 117.4750, loadKw: 267, customer: 'tawau',      powerRole: 'DIESEL_PRIME', program: 'rural-electrification'},
  {id: 'mg-025',  name: 'MG-025',  kind: 'MINI_GRID', locationLabel: 'Pulau Larapan, Semporna',   latitude: 4.5340, longitude: 118.6540, loadKw: 37,  customer: 'tawau',      powerRole: 'SOLAR_HYBRID', program: 'rural-electrification'},
] as const;

/**
 * The machines. Thirty-seven, against the carrier estate's twenty-nine — a
 * utility's substations hold pairs and triples far more often than a tower does.
 */
const GENSETS = [
  // — Greater Kota Kinabalu (12) — the cluster in the map view.
  {tag: 'BRF9540', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'ppu-001',   locationLabel: 'Luyang, Kota Kinabalu',      latitude: 5.9556, longitude: 116.0804, fuelLitres: 1763, fuelCapacityLitres: 2450, staleMinutes: 57},
  {tag: 'KLN3355', model: 'Cummins 1000 kVa',    runState: 'IDLE',    siteId: 'ppu-001',   locationLabel: 'Luyang, Kota Kinabalu',      latitude: 5.9564, longitude: 116.0816, fuelLitres: 214,  fuelCapacityLitres: 2450, staleMinutes: 45},
  {tag: 'CYB6602', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'ppu-002',    locationLabel: 'Sepanggar, Sabah',           latitude: 6.0666, longitude: 116.1324, fuelLitres: 2810, fuelCapacityLitres: 3000, staleMinutes: 1},
  {tag: 'KJG9048', model: 'Denyo 250 kVa',       runState: 'OFFLINE', siteId: 'ppu-002',    locationLabel: 'Sepanggar, Sabah',           latitude: 6.0674, longitude: 116.1336, fuelLitres: 96,   fuelCapacityLitres: 600,  staleMinutes: 2_890, plateNumber: 'SB 3190 T'},
  {tag: 'KLG2214', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'pe-003',   locationLabel: 'Penampang, Sabah',           latitude: 5.9370, longitude: 116.1120, fuelLitres: 940,  fuelCapacityLitres: 1200, staleMinutes: 4},
  {tag: 'SHA7731', model: 'Perkins 800 kVa',     runState: 'IDLE',    siteId: 'pe-004',     locationLabel: 'Inanam, Sabah',              latitude: 5.9796, longitude: 116.1284, fuelLitres: 612,  fuelCapacityLitres: 1800, staleMinutes: 12},
  {tag: 'PCH4180', model: 'FG Wilson 650 kVa',   runState: 'RUNNING', siteId: 'pe-004',     locationLabel: 'Inanam, Sabah',              latitude: 5.9804, longitude: 116.1296, fuelLitres: 1338, fuelCapacityLitres: 1600, staleMinutes: 2},
  {tag: 'KLC1027', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'ppu-005',   locationLabel: 'Kota Kinabalu City Centre',  latitude: 5.9860, longitude: 116.0760, fuelLitres: 2255, fuelCapacityLitres: 3000, staleMinutes: 3},
  {tag: 'CHR5162', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'pe-006',    locationLabel: 'Bukit Padang, Kota Kinabalu',latitude: 5.9496, longitude: 116.0874, fuelLitres: 1102, fuelCapacityLitres: 1800, staleMinutes: 6},
  {tag: 'AMP8890', model: 'Kohler 400 kVa',      runState: 'IDLE',    siteId: 'pe-006',    locationLabel: 'Bukit Padang, Kota Kinabalu',latitude: 5.9504, longitude: 116.0886, fuelLitres: 448,  fuelCapacityLitres: 900,  staleMinutes: 31},
  {tag: 'RWG3471', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'pe-007',     locationLabel: 'Telipok, Sabah',             latitude: 6.1230, longitude: 116.1740, fuelLitres: 733,  fuelCapacityLitres: 1200, staleMinutes: 8},
  {tag: 'SPG2093', model: 'FG Wilson 650 kVa',   runState: 'RUNNING', siteId: 'ppu-008', locationLabel: 'Tanjung Aru, Kota Kinabalu', latitude: 5.9370, longitude: 116.0510, fuelLitres: 1455, fuelCapacityLitres: 1600, staleMinutes: 5,  startReason: 'TEST'},

  // — The west-coast corridor (6): Tuaran up to Kota Marudu.
  {tag: 'IPH7724', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'ppu-009',     locationLabel: 'Tuaran, Sabah',            latitude: 6.1766, longitude: 116.2324, fuelLitres: 1520, fuelCapacityLitres: 1800, staleMinutes: 7},
  {tag: 'TPG1188', model: 'Kohler 400 kVa',      runState: 'IDLE',    siteId: 'ppu-009',     locationLabel: 'Tuaran, Sabah',            latitude: 6.1774, longitude: 116.2336, fuelLitres: 305,  fuelCapacityLitres: 900,  staleMinutes: 44},
  {tag: 'PNG6015', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'ppu-010',   locationLabel: 'Kota Belud, Sabah',        latitude: 6.3506, longitude: 116.4294, fuelLitres: 2004, fuelCapacityLitres: 2450, staleMinutes: 2},
  {tag: 'BKM4409', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'ppu-010',   locationLabel: 'Kota Belud, Sabah',        latitude: 6.3514, longitude: 116.4306, fuelLitres: 511,  fuelCapacityLitres: 1200, staleMinutes: 95},
  {tag: 'SGP7756', model: 'Denyo 250 kVa',       runState: 'RUNNING', siteId: 'pe-011',  locationLabel: 'Kudat, Sabah',             latitude: 6.8830, longitude: 116.8440, fuelLitres: 402,  fuelCapacityLitres: 600,  staleMinutes: 11},
  {tag: 'ASR2260', model: 'Perkins 800 kVa',     runState: 'OFFLINE', siteId: 'mg-012',   locationLabel: 'Pulau Banggi, Kudat',      latitude: 7.2717, longitude: 117.1782, fuelLitres: 880,  fuelCapacityLitres: 1800, staleMinutes: 1_615},

  // — Interior, Labuan and the south-west (6).
  {tag: 'JHB5503', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'ppu-013',    locationLabel: 'Keningau, Sabah',          latitude: 5.3376, longitude: 116.1594, fuelLitres: 2640, fuelCapacityLitres: 3000, staleMinutes: 3},
  {tag: 'PSG8817', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'ppu-013',    locationLabel: 'Keningau, Sabah',          latitude: 5.3384, longitude: 116.1606, fuelLitres: 1890, fuelCapacityLitres: 2450, staleMinutes: 6},
  {tag: 'MLK3392', model: 'FG Wilson 650 kVa',   runState: 'IDLE',    siteId: 'pe-014',  locationLabel: 'Victoria, Labuan',         latitude: 5.2767, longitude: 115.2417, fuelLitres: 720,  fuelCapacityLitres: 1600, staleMinutes: 26},
  {tag: 'SRB6644', model: 'Kohler 400 kVa',      runState: 'RUNNING', siteId: 'pe-015',     locationLabel: 'Papar, Sabah',             latitude: 5.7330, longitude: 115.9330, fuelLitres: 655,  fuelCapacityLitres: 900,  staleMinutes: 4,  startReason: 'TEST'},
  {tag: 'KTN1970', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'pmu-016',    locationLabel: 'Sepanggar Bay, Sabah',     latitude: 6.0830, longitude: 116.1080, fuelLitres: 1244, fuelCapacityLitres: 1800, staleMinutes: 9},
  {tag: 'KBR4128', model: 'Denyo 250 kVa',       runState: 'IDLE',    siteId: 'mg-017',   locationLabel: 'Kemabong, Tenom',          latitude: 4.9670, longitude: 115.9640, fuelLitres: 168,  fuelCapacityLitres: 600,  staleMinutes: 73, plateNumber: 'SB 6742 A'},

  // — The interior and the east coast (13) —
  //
  // The far half of the state is where the interesting half of this estate is.
  // The `PRIME` yards here are rural mini-grids, which is not a coincidence: an
  // island off Kudat or a settlement past the end of the 11 kV network has no
  // mains incomer to back up, and the sets there *are* the supply. That is the case the overview's outer split exists
  // to separate — and at these road distances the drive is most of any
  // intervention, which is what the buckets are for.
  //
  // Their tank levels are chosen rather than scattered. `rulesFor` deals alarms from
  // a hash of the tag, so a fleet seeded without thought lands almost everything in
  // the alarm bucket and leaves "Low fuel" reading zero on a screen built to show
  // it. These thirteen are picked to put real numbers in all four buckets — five
  // below the reserve line, one dry, two alarming — without touching a single
  // existing row, which matters because `BRF9540` and its neighbours are pinned to
  // the Figma frames.
  {tag: 'KKB8856', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'pe-018', locationLabel: 'Ranau, Sabah',           latitude: 5.9536, longitude: 116.6634, fuelLitres: 220,  fuelCapacityLitres: 1000, staleMinutes: 12},
  {tag: 'KKN4011', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'pe-018', locationLabel: 'Ranau, Sabah',           latitude: 5.9544, longitude: 116.6646, fuelLitres: 860,  fuelCapacityLitres: 1000, staleMinutes: 4},
  {tag: 'KNU2218', model: 'Denyo 250 kVa',       runState: 'RUNNING', siteId: 'mg-019', locationLabel: 'Nabawan, Sabah',         latitude: 5.0620, longitude: 116.4370, fuelLitres: 108,  fuelCapacityLitres: 600,  staleMinutes: 38},
  {tag: 'SDK5847', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'fdr-020', locationLabel: 'Sandakan, Sabah',        latitude: 5.8398, longitude: 118.1173, fuelLitres: 740,  fuelCapacityLitres: 1000, staleMinutes: 7},
  {tag: 'LDU7588', model: 'Denyo 250 kVa',       runState: 'RUNNING', siteId: 'fdr-021', locationLabel: 'Lahad Datu, Sabah',      latitude: 5.0273, longitude: 118.3276, fuelLitres: 402,  fuelCapacityLitres: 600,  staleMinutes: 21},
  {tag: 'LWS6446', model: 'Denyo 250 kVa',       runState: 'IDLE',    siteId: 'fdr-021', locationLabel: 'Lahad Datu, Sabah',      latitude: 5.0265, longitude: 118.3264, fuelLitres: 546,  fuelCapacityLitres: 600,  staleMinutes: 3, plateNumber: 'SB 8815 L'},
  {tag: 'KCH8566', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'ppu-022',  locationLabel: 'Batu Sapi, Sandakan',    latitude: 5.8556, longitude: 118.0204, fuelLitres: 2040, fuelCapacityLitres: 3000, staleMinutes: 1},
  {tag: 'KTG7712', model: 'Caterpillar 1250 kVa',runState: 'IDLE',    siteId: 'ppu-022',  locationLabel: 'Batu Sapi, Sandakan',    latitude: 5.8564, longitude: 118.0216, fuelLitres: 1650, fuelCapacityLitres: 3000, staleMinutes: 16},
  {tag: 'BTU3941', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'ppu-023',  locationLabel: 'Tawau, Sabah',           latitude: 4.2454, longitude: 117.8846, fuelLitres: 588,  fuelCapacityLitres: 2450, staleMinutes: 9},
  {tag: 'SRI7241', model: 'Cummins 1000 kVa',    runState: 'IDLE',    siteId: 'ppu-023',  locationLabel: 'Tawau, Sabah',           latitude: 4.2446, longitude: 117.8834, fuelLitres: 1936, fuelCapacityLitres: 2450, staleMinutes: 44},
  {tag: 'MRI8502', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'mg-024',   locationLabel: 'Kalabakan, Tawau',       latitude: 4.4214, longitude: 117.4756, fuelLitres: 1544, fuelCapacityLitres: 2450, staleMinutes: 6},
  {tag: 'LBG4884', model: 'Cummins 1000 kVa',    runState: 'IDLE',    siteId: 'mg-024',   locationLabel: 'Kalabakan, Tawau',       latitude: 4.4206, longitude: 117.4744, fuelLitres: 172,  fuelCapacityLitres: 2450, staleMinutes: 51},
  {tag: 'KPT8033', model: 'Denyo 250 kVa',       runState: 'IDLE',    siteId: 'mg-025', locationLabel: 'Pulau Larapan, Semporna',latitude: 4.5340, longitude: 118.6540, fuelLitres: 96,   fuelCapacityLitres: 600,  staleMinutes: 27},
] as const;

export const UTILITY_DATASET: BrandDataset = {
  id: 'utility',
  label: 'Utility distribution estate',
  groupingLabel: 'By zone',
  customers: CUSTOMERS,
  programs: PROGRAMS,
  siteKindLabels: SITE_KIND_LABELS,
  sites: SITES,
  gensets: GENSETS,
  // Pulau Banggi: the island mini-grid, and the only site on this estate whose
  // page carries an array, a bank and an engine at once.
  defaultSiteId: 'mg-012',
  defaultGensetId: 'brf9540',
};
