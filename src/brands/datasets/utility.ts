import type {BrandDataset} from '../types';

/**
 * The utility estate: **a distribution licensee's pencawang elektrik in Peninsular
 * Malaysia**.
 *
 * Twenty-five substations, feeder points and rural mini-grids across Sabah and
 * Labuan, with thirty-seven machines posted to them. **Posted, not fitted** — this
 * is the estate Express Mission walks, and EM is a vendor whose sets are trucked to
 * an injection point for a job and brought back. That is what `plant: 'mobile'`
 * below records, and it is why this estate's rail offers no Sites register.
 * Recovered from
 * `feat/sesb-demo`, which is where it was stranded — the branch predates the
 * hybrid plant, the generation series and the energy screen, and every one of
 * those was invisible on it.
 * Twenty-five distribution substations from Kepong down to Johor Bahru, with
 * thirty-seven machines standing on them.
 *
 * ## Why every site is a `PE`
 *
 * The estate this build serves is a *mobile* one — a machine is posted to a yard
 * for a period and collected again — and on a distribution network the yard it is
 * posted to is almost always a pencawang elektrik. An intake substation takes a
 * transmission feed and a main distribution substation steps it down; both are
 * sites a utility staffs, and both already have their own standby plant bolted
 * down. The PE is the one sitting unmanned at the end of an 11 kV spur, and it is
 * where a lorry actually goes.
 *
 * So the estate is one kind of site rather than five. `SITE_KIND_LABELS` still
 * exists, and still carries one entry, because the label is read from it wherever a
 * site's class is printed — a second kind is an entry in that map and nothing else.
 *
 * ## Why five of them are `DIESEL_PRIME`
 *
 * A pencawang elektrik has an incomer, so on the face of it every site here is
 * `GRID_BACKUP`. The exceptions are the ones the mobile fleet exists for: a PE
 * **isolated for refurbishment** has had its transformer or its switchgear taken
 * out, and for the length of that job the set standing in the compound is not
 * backing the supply up — it *is* the supply. That is `DIESEL_PRIME`, it is the
 * circuit the single-line diagram should draw at those five, and it is the case the
 * whole temporary-supply business is about.
 *
 * Five of twenty-five, all filed under the refurbishment programme: Rawang, Teluk
 * Intan, Butterworth, Kulai and Kuantan.
 *
 * These are mock sites carrying mock figures, the same standing as every other
 * number in this prototype. The placenames and coordinates are real; the
 * substations at them are not. Nobody should read a row here as a record of a
 * pencawang that exists.
 */

/**
 * The distribution states this estate is divided by.
 *
 * A Peninsular licensee organises by state rather than by region, so the grouping
 * is the state list — Wilayah Persekutuan first, since the densest sixth of the
 * estate is there, then out through Selangor and the corridors north and south.
 */
const CUSTOMERS = [
  {id: 'wilayah', name: 'Wilayah Persekutuan', shortName: 'WP'},
  {id: 'selangor', name: 'Selangor', shortName: 'Selangor'},
  {id: 'perak', name: 'Perak', shortName: 'Perak'},
  {id: 'pulau-pinang', name: 'Pulau Pinang', shortName: 'P. Pinang'},
  {id: 'johor', name: 'Johor', shortName: 'Johor'},
  {id: 'negeri-sembilan', name: 'Negeri Sembilan', shortName: 'N. Sembilan'},
  {id: 'pahang', name: 'Pahang', shortName: 'Pahang'},
] as const;

/**
 * The capital programmes this estate's sites are filed under.
 *
 * Two, and **most sites are in neither** — which is the honest shape of a utility's
 * capital plan and the reason `program` is optional. A pencawang that has been
 * standing in Bangsar for thirty years is not part of a programme; it is just the
 * network. The programmes are the work being *done to* the estate, and filing every
 * row under one to avoid a blank would make the grouping useless the moment
 * somebody filtered by it.
 */
const PROGRAMS = [
  {
    id: 'substation-refurbishment',
    name: 'Substation Refurbishment',
    shortName: 'Refurbishment',
    blurb: 'Transformers and switchgear replaced — the sites running on temporary supply.',
  },
  {
    id: 'demand-growth',
    name: 'Demand Growth Reinforcement',
    shortName: 'Demand Growth',
    blurb: 'The industrial and port corridors being reinforced ahead of load.',
  },
] as const;

/**
 * What kind of node on the network a site is.
 *
 * One entry, because this estate is one kind of site — see the note at the top of
 * this file. The map is kept rather than collapsed to a constant so that adding an
 * intake or a main distribution substation later is a line here, not a refactor.
 */
const SITE_KIND_LABELS = {
  PE: 'Distribution substation',
} as const;

const SITES = [
  // — Wilayah Persekutuan (6) — the cluster in the map view.
  {id: 'pe-001', name: 'PE-001', kind: 'PE', locationLabel: 'Bangsar, Kuala Lumpur',          latitude: 3.1290, longitude: 101.6700, loadKw: 412, customer: 'wilayah',         powerRole: 'GRID_BACKUP'},
  {id: 'pe-002', name: 'PE-002', kind: 'PE', locationLabel: 'Setapak, Kuala Lumpur',          latitude: 3.1980, longitude: 101.7200, loadKw: 288, customer: 'wilayah',         powerRole: 'GRID_BACKUP'},
  {id: 'pe-003', name: 'PE-003', kind: 'PE', locationLabel: 'Cheras, Kuala Lumpur',           latitude: 3.1000, longitude: 101.7400, loadKw: 355, customer: 'wilayah',         powerRole: 'GRID_BACKUP'},
  {id: 'pe-004', name: 'PE-004', kind: 'PE', locationLabel: 'Sentul, Kuala Lumpur',           latitude: 3.1830, longitude: 101.6900, loadKw: 196, customer: 'wilayah',         powerRole: 'GRID_BACKUP'},
  {id: 'pe-005', name: 'PE-005', kind: 'PE', locationLabel: 'Putrajaya',                      latitude: 2.9264, longitude: 101.6964, loadKw: 534, customer: 'wilayah',         powerRole: 'GRID_BACKUP', program: 'demand-growth'},
  {id: 'pe-006', name: 'PE-006', kind: 'PE', locationLabel: 'Kepong, Kuala Lumpur',           latitude: 3.2100, longitude: 101.6300, loadKw: 243, customer: 'wilayah',         powerRole: 'GRID_BACKUP'},

  // — Selangor (5) — the Klang corridor, and Rawang on temporary supply.
  {id: 'pe-007', name: 'PE-007', kind: 'PE', locationLabel: 'Shah Alam, Selangor',            latitude: 3.0730, longitude: 101.5180, loadKw: 618, customer: 'selangor',        powerRole: 'GRID_BACKUP', program: 'demand-growth'},
  {id: 'pe-008', name: 'PE-008', kind: 'PE', locationLabel: 'Klang, Selangor',                latitude: 3.0440, longitude: 101.4450, loadKw: 471, customer: 'selangor',        powerRole: 'GRID_BACKUP', program: 'demand-growth'},
  {id: 'pe-009', name: 'PE-009', kind: 'PE', locationLabel: 'Petaling Jaya, Selangor',        latitude: 3.1070, longitude: 101.6060, loadKw: 327, customer: 'selangor',        powerRole: 'GRID_BACKUP'},
  {id: 'pe-010', name: 'PE-010', kind: 'PE', locationLabel: 'Rawang, Selangor',               latitude: 3.3210, longitude: 101.5770, loadKw: 164, customer: 'selangor',        powerRole: 'DIESEL_PRIME', program: 'substation-refurbishment'},
  {id: 'pe-011', name: 'PE-011', kind: 'PE', locationLabel: 'Banting, Selangor',              latitude: 2.8160, longitude: 101.5000, loadKw: 118, customer: 'selangor',        powerRole: 'GRID_BACKUP'},

  // — Perak (4) — Ipoh, and the coast road down to Sitiawan.
  {id: 'pe-012', name: 'PE-012', kind: 'PE', locationLabel: 'Ipoh, Perak',                    latitude: 4.5975, longitude: 101.0901, loadKw: 302, customer: 'perak',           powerRole: 'GRID_BACKUP'},
  {id: 'pe-013', name: 'PE-013', kind: 'PE', locationLabel: 'Taiping, Perak',                 latitude: 4.8500, longitude: 100.7400, loadKw: 147, customer: 'perak',           powerRole: 'GRID_BACKUP'},
  {id: 'pe-014', name: 'PE-014', kind: 'PE', locationLabel: 'Teluk Intan, Perak',             latitude: 4.0230, longitude: 101.0210, loadKw: 96,  customer: 'perak',           powerRole: 'DIESEL_PRIME', program: 'substation-refurbishment'},
  {id: 'pe-015', name: 'PE-015', kind: 'PE', locationLabel: 'Sitiawan, Perak',                latitude: 4.2160, longitude: 100.6960, loadKw: 205, customer: 'perak',           powerRole: 'GRID_BACKUP'},

  // — Pulau Pinang (3) — the island, and the mainland crossing.
  {id: 'pe-016', name: 'PE-016', kind: 'PE', locationLabel: 'George Town, Pulau Pinang',      latitude: 5.4141, longitude: 100.3288, loadKw: 389, customer: 'pulau-pinang',    powerRole: 'GRID_BACKUP'},
  {id: 'pe-017', name: 'PE-017', kind: 'PE', locationLabel: 'Bayan Lepas, Pulau Pinang',      latitude: 5.2940, longitude: 100.2770, loadKw: 742, customer: 'pulau-pinang',    powerRole: 'GRID_BACKUP', program: 'demand-growth'},
  {id: 'pe-018', name: 'PE-018', kind: 'PE', locationLabel: 'Butterworth, Pulau Pinang',      latitude: 5.3990, longitude: 100.3630, loadKw: 133, customer: 'pulau-pinang',    powerRole: 'DIESEL_PRIME', program: 'substation-refurbishment'},

  // — Johor (4) — Johor Bahru, the port, and up the trunk road.
  {id: 'pe-019', name: 'PE-019', kind: 'PE', locationLabel: 'Johor Bahru, Johor',             latitude: 1.4927, longitude: 103.7414, loadKw: 448, customer: 'johor',           powerRole: 'GRID_BACKUP'},
  {id: 'pe-020', name: 'PE-020', kind: 'PE', locationLabel: 'Pasir Gudang, Johor',            latitude: 1.4720, longitude: 103.8920, loadKw: 695, customer: 'johor',           powerRole: 'GRID_BACKUP', program: 'demand-growth'},
  {id: 'pe-021', name: 'PE-021', kind: 'PE', locationLabel: 'Kulai, Johor',                   latitude: 1.6580, longitude: 103.6030, loadKw: 171, customer: 'johor',           powerRole: 'DIESEL_PRIME', program: 'substation-refurbishment'},
  {id: 'pe-022', name: 'PE-022', kind: 'PE', locationLabel: 'Batu Pahat, Johor',              latitude: 1.8548, longitude: 102.9325, loadKw: 224, customer: 'johor',           powerRole: 'GRID_BACKUP'},

  // — Negeri Sembilan (2) and Pahang (1) — the south coast, and the road across.
  {id: 'pe-023', name: 'PE-023', kind: 'PE', locationLabel: 'Seremban, Negeri Sembilan',      latitude: 2.7297, longitude: 101.9381, loadKw: 266, customer: 'negeri-sembilan', powerRole: 'GRID_BACKUP'},
  {id: 'pe-024', name: 'PE-024', kind: 'PE', locationLabel: 'Port Dickson, Negeri Sembilan',  latitude: 2.5228, longitude: 101.7960, loadKw: 109, customer: 'negeri-sembilan', powerRole: 'GRID_BACKUP'},
  {id: 'pe-025', name: 'PE-025', kind: 'PE', locationLabel: 'Kuantan, Pahang',                latitude: 3.8077, longitude: 103.3260, loadKw: 187, customer: 'pahang',          powerRole: 'DIESEL_PRIME', program: 'substation-refurbishment'},

  // — The six yards `BRF 9540` actually stood at, May–September 2026. Named as the
  //   job sheet names them rather than `PE-0nn`: these came off Express Mission's
  //   own deployment record, and `PE Kapar L. Ind Park` is what the operations room
  //   says out loud. Their `loadKw` is the mean load the set carried there, read off
  //   the controller — not a surveyed substation rating like the twenty-five above.
  //   ⚠️ Coordinates are the placename's, not a survey.
  {id: 'pe-026', name: 'PE Kapar L. Ind Park', kind: 'PE', locationLabel: 'Kapar, Selangor', latitude: 3.1167, longitude: 101.3833, loadKw: 44, customer: 'selangor', powerRole: 'GRID_BACKUP'},
  {id: 'pe-027', name: 'PE Sek Men Vokasional Sg. Buloh', kind: 'PE', locationLabel: 'Sungai Buloh, Selangor', latitude: 3.2064, longitude: 101.5806, loadKw: 180, customer: 'selangor', powerRole: 'GRID_BACKUP'},
  {id: 'pe-028', name: 'PE Taman Pantai Makmur 2', kind: 'PE', locationLabel: 'Pantai Makmur, Selangor', latitude: 3.1550, longitude: 101.3250, loadKw: 104, customer: 'selangor', powerRole: 'GRID_BACKUP'},
  {id: 'pe-029', name: 'PE Tmn Sementa Jaya', kind: 'PE', locationLabel: 'Sementa, Selangor', latitude: 3.0900, longitude: 101.3600, loadKw: 347, customer: 'selangor', powerRole: 'GRID_BACKUP'},
  {id: 'pe-030', name: 'PE Pusat Ternakan Itik', kind: 'PE', locationLabel: 'Jeram, Selangor', latitude: 3.2167, longitude: 101.3167, loadKw: 22, customer: 'selangor', powerRole: 'GRID_BACKUP'},
  {id: 'pe-031', name: 'PE Alam Perdana No 3', kind: 'PE', locationLabel: 'Bandar Puncak Alam, Selangor', latitude: 3.2300, longitude: 101.4200, loadKw: 172, customer: 'selangor', powerRole: 'GRID_BACKUP'},
] as const;

/**
 * The machines. Thirty-seven across twenty-five yards — a substation compound holds
 * a pair far more often than a tower does, so twelve of the sites carry two.
 *
 * Their tank levels are chosen rather than scattered. `rulesFor` deals alarms from a
 * hash of the tag, so a fleet seeded without thought lands almost everything in the
 * alarm bucket and leaves "Low fuel" reading zero on a screen built to show it.
 * These are picked to put real numbers in all four readiness buckets — two dry, a
 * handful below the reserve line — alongside a spread of run states including a set
 * on a test exercise and two that have not reported in days.
 *
 * Plates carry the state prefix of the yard the machine is posted to, which is what
 * a lorry's paperwork would say: `W` in the Federal Territory, `B` in Selangor, `A`
 * in Perak, `P` in Pulau Pinang, `J` in Johor, `N` in Negeri Sembilan, `C` in
 * Pahang.
 */
const GENSETS = [
  // — Wilayah Persekutuan (9).
  {tag: 'CUM-739893', model: 'Cummins 1000 kVa',     runState: 'RUNNING', siteId: 'pe-001', locationLabel: 'Bangsar, Kuala Lumpur',        latitude: 3.1286, longitude: 101.6694, fuelLitres: 1763, fuelCapacityLitres: 2450, staleMinutes: 57, plateNumber: 'WVA 5385'},
  {tag: 'CUM-303952', model: 'Cummins 1000 kVa',     runState: 'IDLE',    siteId: 'pe-001', locationLabel: 'Bangsar, Kuala Lumpur',        latitude: 3.1294, longitude: 101.6706, fuelLitres: 214,  fuelCapacityLitres: 2450, staleMinutes: 45, plateNumber: 'WXQ 4562'},
  {tag: 'PRK-690242', model: 'Perkins 800 kVa',      runState: 'RUNNING', siteId: 'pe-002', locationLabel: 'Setapak, Kuala Lumpur',        latitude: 3.1976, longitude: 101.7194, fuelLitres: 1338, fuelCapacityLitres: 1800, staleMinutes: 12, plateNumber: 'WPK 4055'},
  {tag: 'CAT-639573', model: 'Caterpillar 1250 kVa', runState: 'RUNNING', siteId: 'pe-003', locationLabel: 'Cheras, Kuala Lumpur',         latitude: 3.0996, longitude: 101.7394, fuelLitres: 2255, fuelCapacityLitres: 3000, staleMinutes: 3,  plateNumber: 'WTE 4879'},
  {tag: 'KHL-306060', model: 'Kohler 400 kVa',       runState: 'IDLE',    siteId: 'pe-003', locationLabel: 'Cheras, Kuala Lumpur',         latitude: 3.1004, longitude: 101.7406, fuelLitres: 448,  fuelCapacityLitres: 900,  staleMinutes: 31, plateNumber: 'WSD 7780'},
  {tag: 'CUM-801936', model: 'Cummins 500 kVa',      runState: 'RUNNING', siteId: 'pe-004', locationLabel: 'Sentul, Kuala Lumpur',         latitude: 3.1830, longitude: 101.6900, fuelLitres: 733,  fuelCapacityLitres: 1200, staleMinutes: 8,  plateNumber: 'WHB 9411'},
  {tag: 'CAT-736523', model: 'Caterpillar 1250 kVa', runState: 'RUNNING', siteId: 'pe-005', locationLabel: 'Putrajaya',                    latitude: 2.9260, longitude: 101.6958, fuelLitres: 2810, fuelCapacityLitres: 3000, staleMinutes: 1,  plateNumber: 'WLA 9480'},
  {tag: 'DNY-201708', model: 'Denyo 250 kVa',        runState: 'OFFLINE', siteId: 'pe-005', locationLabel: 'Putrajaya',                    latitude: 2.9268, longitude: 101.6970, fuelLitres: 96,   fuelCapacityLitres: 600,  staleMinutes: 2_890, plateNumber: 'WKC 3190'},
  {tag: 'FGW-181837', model: 'FG Wilson 650 kVa',    runState: 'RUNNING', siteId: 'pe-006', locationLabel: 'Kepong, Kuala Lumpur',         latitude: 3.2100, longitude: 101.6300, fuelLitres: 1455, fuelCapacityLitres: 1600, staleMinutes: 5,  startReason: 'TEST', plateNumber: 'WGP 7087'},

  // — Selangor (8).
  {tag: 'CUM-930666', model: 'Cummins 1000 kVa',     runState: 'RUNNING', siteId: 'pe-007', locationLabel: 'Shah Alam, Selangor',          latitude: 3.0726, longitude: 101.5174, fuelLitres: 2004, fuelCapacityLitres: 2450, staleMinutes: 2,  plateNumber: 'BQH 7644'},
  {tag: 'CUM-646777', model: 'Cummins 500 kVa',      runState: 'IDLE',    siteId: 'pe-007', locationLabel: 'Shah Alam, Selangor',          latitude: 3.0734, longitude: 101.5186, fuelLitres: 511,  fuelCapacityLitres: 1200, staleMinutes: 95, plateNumber: 'BMU 6334'},
  {tag: 'CAT-939070', model: 'Caterpillar 1250 kVa', runState: 'RUNNING', siteId: 'pe-008', locationLabel: 'Klang, Selangor',              latitude: 3.0436, longitude: 101.4444, fuelLitres: 2040, fuelCapacityLitres: 3000, staleMinutes: 1,  plateNumber: 'BJN 2371'},
  {tag: 'CAT-281248', model: 'Caterpillar 1250 kVa', runState: 'IDLE',    siteId: 'pe-008', locationLabel: 'Klang, Selangor',              latitude: 3.0444, longitude: 101.4456, fuelLitres: 1650, fuelCapacityLitres: 3000, staleMinutes: 16, plateNumber: 'BRU 3805'},
  {tag: 'PRK-252128', model: 'Perkins 800 kVa',      runState: 'RUNNING', siteId: 'pe-009', locationLabel: 'Petaling Jaya, Selangor',      latitude: 3.1066, longitude: 101.6054, fuelLitres: 1102, fuelCapacityLitres: 1800, staleMinutes: 6,  plateNumber: 'BND 8026'},
  {tag: 'PRK-230015', model: 'Perkins 800 kVa',      runState: 'RUNNING', siteId: 'pe-010', locationLabel: 'Rawang, Selangor',             latitude: 3.3206, longitude: 101.5764, fuelLitres: 1520, fuelCapacityLitres: 1800, staleMinutes: 7,  plateNumber: 'BQL 9297'},
  {tag: 'KHL-599013', model: 'Kohler 400 kVa',       runState: 'IDLE',    siteId: 'pe-010', locationLabel: 'Rawang, Selangor',             latitude: 3.3214, longitude: 101.5776, fuelLitres: 305,  fuelCapacityLitres: 900,  staleMinutes: 44, plateNumber: 'BME 3713'},
  {tag: 'DNY-246845', model: 'Denyo 250 kVa',        runState: 'RUNNING', siteId: 'pe-011', locationLabel: 'Banting, Selangor',            latitude: 2.8160, longitude: 101.5000, fuelLitres: 402,  fuelCapacityLitres: 600,  staleMinutes: 11, plateNumber: 'BTW 8463'},

  // — Perak (6).
  {tag: 'CAT-408590', model: 'Caterpillar 1250 kVa', runState: 'RUNNING', siteId: 'pe-012', locationLabel: 'Ipoh, Perak',                  latitude: 4.5971, longitude: 101.0895, fuelLitres: 2640, fuelCapacityLitres: 3000, staleMinutes: 3,  plateNumber: 'AKA 1975'},
  {tag: 'CUM-245531', model: 'Cummins 1000 kVa',     runState: 'RUNNING', siteId: 'pe-012', locationLabel: 'Ipoh, Perak',                  latitude: 4.5979, longitude: 101.0907, fuelLitres: 1890, fuelCapacityLitres: 2450, staleMinutes: 6,  plateNumber: 'AFB 1502'},
  {tag: 'FGW-691403', model: 'FG Wilson 650 kVa',    runState: 'IDLE',    siteId: 'pe-013', locationLabel: 'Taiping, Perak',               latitude: 4.8500, longitude: 100.7400, fuelLitres: 720,  fuelCapacityLitres: 1600, staleMinutes: 26, plateNumber: 'AKM 5661'},
  {tag: 'DNY-703725', model: 'Denyo 250 kVa',        runState: 'RUNNING', siteId: 'pe-014', locationLabel: 'Teluk Intan, Perak',           latitude: 4.0226, longitude: 101.0204, fuelLitres: 108,  fuelCapacityLitres: 600,  staleMinutes: 38, plateNumber: 'ATQ 6264'},
  {tag: 'CUM-617409', model: 'Cummins 500 kVa',      runState: 'RUNNING', siteId: 'pe-014', locationLabel: 'Teluk Intan, Perak',           latitude: 4.0234, longitude: 101.0216, fuelLitres: 940,  fuelCapacityLitres: 1200, staleMinutes: 4,  plateNumber: 'AUF 6414'},
  {tag: 'KHL-928197', model: 'Kohler 400 kVa',       runState: 'RUNNING', siteId: 'pe-015', locationLabel: 'Sitiawan, Perak',              latitude: 4.2160, longitude: 100.6960, fuelLitres: 655,  fuelCapacityLitres: 900,  staleMinutes: 4,  startReason: 'TEST', plateNumber: 'AUD 5366'},

  // — Pulau Pinang (5) — Bayan Lepas carries the estate's heaviest pair.
  {tag: 'CUM-882799', model: 'Cummins 500 kVa',      runState: 'RUNNING', siteId: 'pe-016', locationLabel: 'George Town, Pulau Pinang',    latitude: 5.4137, longitude: 100.3282, fuelLitres: 220,  fuelCapacityLitres: 1000, staleMinutes: 12, plateNumber: 'PHQ 8279'},
  {tag: 'CUM-440939', model: 'Cummins 500 kVa',      runState: 'IDLE',    siteId: 'pe-016', locationLabel: 'George Town, Pulau Pinang',    latitude: 5.4145, longitude: 100.3294, fuelLitres: 860,  fuelCapacityLitres: 1000, staleMinutes: 4,  plateNumber: 'PFA 5976'},
  {tag: 'CUM-672771', model: 'Cummins 1000 kVa',     runState: 'RUNNING', siteId: 'pe-017', locationLabel: 'Bayan Lepas, Pulau Pinang',    latitude: 5.2944, longitude: 100.2776, fuelLitres: 588,  fuelCapacityLitres: 2450, staleMinutes: 9,  plateNumber: 'PGW 9748'},
  {tag: 'CUM-167879', model: 'Cummins 1000 kVa',     runState: 'IDLE',    siteId: 'pe-017', locationLabel: 'Bayan Lepas, Pulau Pinang',    latitude: 5.2936, longitude: 100.2764, fuelLitres: 1936, fuelCapacityLitres: 2450, staleMinutes: 44, plateNumber: 'PWG 6140'},
  {tag: 'PRK-541815', model: 'Perkins 800 kVa',      runState: 'RUNNING', siteId: 'pe-018', locationLabel: 'Butterworth, Pulau Pinang',    latitude: 5.3990, longitude: 100.3630, fuelLitres: 740,  fuelCapacityLitres: 1000, staleMinutes: 7,  plateNumber: 'PPB 8012'},

  // — Johor (6).
  {tag: 'FGW-637180', model: 'FG Wilson 650 kVa',    runState: 'RUNNING', siteId: 'pe-019', locationLabel: 'Johor Bahru, Johor',           latitude: 1.4923, longitude: 103.7408, fuelLitres: 1338, fuelCapacityLitres: 1600, staleMinutes: 2,  plateNumber: 'JDD 4719'},
  {tag: 'PRK-386403', model: 'Perkins 800 kVa',      runState: 'OFFLINE', siteId: 'pe-019', locationLabel: 'Johor Bahru, Johor',           latitude: 1.4931, longitude: 103.7420, fuelLitres: 880,  fuelCapacityLitres: 1800, staleMinutes: 1_615, plateNumber: 'JRA 3214'},
  {tag: 'CUM-806077', model: 'Cummins 1000 kVa',     runState: 'RUNNING', siteId: 'pe-020', locationLabel: 'Pasir Gudang, Johor',          latitude: 1.4716, longitude: 103.8914, fuelLitres: 1544, fuelCapacityLitres: 2450, staleMinutes: 6,  plateNumber: 'JFQ 8006'},
  {tag: 'CUM-164691', model: 'Cummins 1000 kVa',     runState: 'IDLE',    siteId: 'pe-020', locationLabel: 'Pasir Gudang, Johor',          latitude: 1.4724, longitude: 103.8926, fuelLitres: 172,  fuelCapacityLitres: 2450, staleMinutes: 51, plateNumber: 'JLA 5601'},
  {tag: 'DNY-359597', model: 'Denyo 250 kVa',        runState: 'RUNNING', siteId: 'pe-021', locationLabel: 'Kulai, Johor',                 latitude: 1.6576, longitude: 103.6024, fuelLitres: 402,  fuelCapacityLitres: 600,  staleMinutes: 21, plateNumber: 'JLQ 8401'},
  {tag: 'DNY-323530', model: 'Denyo 250 kVa',        runState: 'IDLE',    siteId: 'pe-022', locationLabel: 'Batu Pahat, Johor',            latitude: 1.8548, longitude: 102.9325, fuelLitres: 546,  fuelCapacityLitres: 600,  staleMinutes: 3,  plateNumber: 'JWQ 5891'},

  // — Negeri Sembilan (2) and Pahang (1).
  {tag: 'PRK-954710', model: 'Perkins 800 kVa',      runState: 'RUNNING', siteId: 'pe-023', locationLabel: 'Seremban, Negeri Sembilan',    latitude: 2.7297, longitude: 101.9381, fuelLitres: 1244, fuelCapacityLitres: 1800, staleMinutes: 9,  plateNumber: 'NHA 1169'},
  {tag: 'DNY-566998', model: 'Denyo 250 kVa',        runState: 'IDLE',    siteId: 'pe-024', locationLabel: 'Port Dickson, Negeri Sembilan',latitude: 2.5228, longitude: 101.7960, fuelLitres: 168,  fuelCapacityLitres: 600,  staleMinutes: 73, plateNumber: 'NKC 3446'},
  {tag: 'DNY-619585', model: 'Denyo 250 kVa',        runState: 'IDLE',    siteId: 'pe-025', locationLabel: 'Kuantan, Pahang',              latitude: 3.8077, longitude: 103.3260, fuelLitres: 96,   fuelCapacityLitres: 600,  staleMinutes: 27, plateNumber: 'CLB 9831'},

  // — The one real machine on this estate. —
  //
  // `BRF 9540` — asset tag `BRF9540`, which is what its id and URL are built from —
  // is not dealt. Every figure on it is read off Express Mission's own
  // gateway, `em-gw-001`, exported 2026-09-21: its eight postings, their windows and
  // their tank readings are in `deployment/data/realJobs.ts`, and its runs are the
  // engine actually turning, in `history.ts`. Nothing else in this file is measured.
  //
  // **It stands at no yard.** Its last posting closed on 16 September and it has not
  // been sent out since, which is what `siteId: undefined` means — the machine is
  // back in the workshop, and it is the only row here in that state.
  //
  // **Both fuel figures are measured.** `fuelLitres` is the gauge at 1,428 L, the
  // level when the machine came off its last posting. `fuelCapacityLitres` is 2,350
  // — not the 2,450 the other Cummins 1000 kVA rows carry, which is a fixture
  // number. It is read off `RIQFL001 | Fuel Level (derived) [L]`, whose calibration
  // holds across the whole export at about `2.683 L/mm − 106 L`: two separate fills
  // topped out at 2,300 L (26 Aug) and 2,354 L at 917 mm (12 Sep), the highest the
  // sensor ever saw, and no posting on the job sheet starts above 2,300. The tank
  // may be built larger than that — a float cannot see the air above it — but 2,350
  // is what this machine has been shown to hold.
  {tag: 'BRF9540', model: 'Cummins 1000 kVa', runState: 'IDLE', siteId: undefined, locationLabel: 'Workshop, Kapar', latitude: 3.1167, longitude: 101.3833, fuelLitres: 1428, fuelCapacityLitres: 2350, staleMinutes: 7_400, plateNumber: 'BRF 9540'},
] as const;

export const UTILITY_DATASET: BrandDataset = {
  id: 'utility',
  label: 'Utility distribution estate',
  groupingLabel: 'By state',
  // A vendor's machines, posted to the operator's injection points for a job and
  // taken back. The rail drops Sites — see `PlantKind`.
  plant: 'mobile',
  customers: CUSTOMERS,
  programs: PROGRAMS,
  siteKindLabels: SITE_KIND_LABELS,
  sites: SITES,
  gensets: GENSETS,
  // Rawang: a pencawang isolated for refurbishment, so its page draws the
  // diesel-prime circuit rather than an incomer with a set behind it.
  defaultSiteId: 'pe-010',
  defaultGensetId: 'cum-739893',
};
