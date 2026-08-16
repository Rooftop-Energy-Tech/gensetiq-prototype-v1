import type {
  Genset,
  GensetActivity,
  GensetActivityKind,
  RunState,
  StartReason,
} from '../types/genset.type';

/**
 * A stand-in fleet, in place of the telemetry API this prototype doesn't have.
 *
 * Three things are deliberate about the shape of it:
 *
 *  - Twelve of the twenty-four units sit in the Klang Valley. That's what makes
 *    the map's cluster bubble read "12" at the zoom the design shows, which is
 *    the whole reason the cluster exists in the mock-up.
 *  - `BRF9540 | Cummins 1000 kVa` is pinned to exactly the values in the Figma
 *    frames — Running, 1763 L of 2450 (72%), Petaling Jaya, ~57 minutes stale —
 *    so the detail panel can be diffed against the design directly.
 *  - **Nine of the seventeen sites hold two units**, which is what makes the site
 *    page's single-line diagram worth drawing — a diagram of one genset feeding
 *    one load has no changeover decision in it. `telco-001` pairs `BRF9540` with
 *    the other `Cummins 1000 kVa`, so the designed frame's two identical genset
 *    cards land on two identical machines, one running and one faulted.
 *
 * Timestamps are minutes-ago offsets resolved at module load rather than fixed
 * ISO strings: a hardcoded date would drift into "412 days ago" the week after
 * anyone opens this.
 */

type FleetSeed = {
  tag: string;
  model: string;
  runState: RunState;
  /**
   * Why this unit last cranked. **`OUTAGE` unless stated** — the standby fleet's
   * ordinary reason, and the one its activity feed has always assumed.
   *
   * Seeded rather than derived because it is the *given* the site page's intake
   * meter reads: `sites.ts` decides whether a yard's mains is up by looking at
   * whether any set there is out on an outage. Stating it once, here, is what
   * stops a set's activity feed ("started on utility outage") from contradicting
   * the meter drawn a few pixels above it on the site diagram.
   *
   * Two units are pinned to `TEST` so the fleet actually contains the case that
   * distinction exists for — a set turning beside a healthy grid.
   */
  startReason?: StartReason;
  /**
   * The site this unit stands at. Sites are derived from this column rather than
   * seeded separately — see `modules/site/data/sites.ts`.
   *
   * Units sharing a site share their `locationLabel` exactly, and sit within a
   * hundred metres or so of each other. Both follow from what a site *is*: a
   * customer's yard with one or more sets on it, feeding one load.
   */
  siteId: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  fuelLitres: number;
  fuelCapacityLitres: number;
  /** How stale this unit's telemetry is, in minutes. */
  staleMinutes: number;
};

// prettier-ignore
const FLEET_SEED: Array<FleetSeed> = [
  // — Klang Valley (12) — the cluster in the map view.
  {tag: 'BRF9540', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'telco-001',   locationLabel: 'Petaling Jaya, Selangor',   latitude: 3.1073, longitude: 101.6067, fuelLitres: 1763, fuelCapacityLitres: 2450, staleMinutes: 57},
  {tag: 'KLN3355', model: 'Cummins 1000 kVa',    runState: 'FAULT',   siteId: 'telco-001',   locationLabel: 'Petaling Jaya, Selangor',   latitude: 3.1081, longitude: 101.6079, fuelLitres: 214,  fuelCapacityLitres: 2450, staleMinutes: 9},
  {tag: 'CYB6602', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'data-002',    locationLabel: 'Cyberjaya, Selangor',       latitude: 2.9213, longitude: 101.6559, fuelLitres: 2810, fuelCapacityLitres: 3000, staleMinutes: 1},
  {tag: 'KJG9048', model: 'Denyo 250 kVa',       runState: 'OFFLINE', siteId: 'data-002',    locationLabel: 'Cyberjaya, Selangor',       latitude: 2.9221, longitude: 101.6571, fuelLitres: 96,   fuelCapacityLitres: 600,  staleMinutes: 2_890},
  {tag: 'KLG2214', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'telco-003',   locationLabel: 'Subang Jaya, Selangor',     latitude: 3.0567, longitude: 101.5851, fuelLitres: 940,  fuelCapacityLitres: 1200, staleMinutes: 4},
  {tag: 'SHA7731', model: 'Perkins 800 kVa',     runState: 'IDLE',    siteId: 'mfg-004',     locationLabel: 'Shah Alam, Selangor',       latitude: 3.0733, longitude: 101.5185, fuelLitres: 612,  fuelCapacityLitres: 1800, staleMinutes: 12},
  {tag: 'PCH4180', model: 'FG Wilson 650 kVa',   runState: 'RUNNING', siteId: 'mfg-004',     locationLabel: 'Shah Alam, Selangor',       latitude: 3.0741, longitude: 101.5197, fuelLitres: 1338, fuelCapacityLitres: 1600, staleMinutes: 2},
  {tag: 'KLC1027', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'tower-005',   locationLabel: 'Kuala Lumpur City Centre',  latitude: 3.1578, longitude: 101.7119, fuelLitres: 2255, fuelCapacityLitres: 3000, staleMinutes: 3},
  {tag: 'CHR5162', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'hosp-006',    locationLabel: 'Cheras, Kuala Lumpur',      latitude: 3.0833, longitude: 101.7500, fuelLitres: 1102, fuelCapacityLitres: 1800, staleMinutes: 6},
  {tag: 'AMP8890', model: 'Kohler 400 kVa',      runState: 'IDLE',    siteId: 'hosp-006',    locationLabel: 'Cheras, Kuala Lumpur',      latitude: 3.0841, longitude: 101.7512, fuelLitres: 448,  fuelCapacityLitres: 900,  staleMinutes: 31},
  {tag: 'RWG3471', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'mfg-007',     locationLabel: 'Rawang, Selangor',          latitude: 3.3212, longitude: 101.5769, fuelLitres: 733,  fuelCapacityLitres: 1200, staleMinutes: 8},
  {tag: 'SPG2093', model: 'FG Wilson 650 kVa',   runState: 'RUNNING', siteId: 'airport-008', locationLabel: 'Sepang, Selangor',          latitude: 2.7456, longitude: 101.7072, fuelLitres: 1455, fuelCapacityLitres: 1600, staleMinutes: 5,  startReason: 'TEST'},

  // — Northern corridor (6).
  {tag: 'IPH7724', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'mfg-009',     locationLabel: 'Ipoh, Perak',              latitude: 4.5975, longitude: 101.0901, fuelLitres: 1520, fuelCapacityLitres: 1800, staleMinutes: 7},
  {tag: 'TPG1188', model: 'Kohler 400 kVa',      runState: 'IDLE',    siteId: 'mfg-009',     locationLabel: 'Ipoh, Perak',              latitude: 4.5983, longitude: 101.0913, fuelLitres: 305,  fuelCapacityLitres: 900,  staleMinutes: 44},
  {tag: 'PNG6015', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'telco-010',   locationLabel: 'George Town, Penang',      latitude: 5.4141, longitude: 100.3288, fuelLitres: 2004, fuelCapacityLitres: 2450, staleMinutes: 2},
  {tag: 'BKM4409', model: 'Cummins 500 kVa',     runState: 'FAULT',   siteId: 'telco-010',   locationLabel: 'George Town, Penang',      latitude: 5.4149, longitude: 100.3300, fuelLitres: 511,  fuelCapacityLitres: 1200, staleMinutes: 18},
  {tag: 'SGP7756', model: 'Denyo 250 kVa',       runState: 'RUNNING', siteId: 'retail-011',  locationLabel: 'Sungai Petani, Kedah',     latitude: 5.6470, longitude: 100.4870, fuelLitres: 402,  fuelCapacityLitres: 600,  staleMinutes: 11},
  {tag: 'ASR2260', model: 'Perkins 800 kVa',     runState: 'OFFLINE', siteId: 'telco-012',   locationLabel: 'Alor Setar, Kedah',        latitude: 6.1248, longitude: 100.3678, fuelLitres: 880,  fuelCapacityLitres: 1800, staleMinutes: 1_615},

  // — Southern + east coast (6).
  {tag: 'JHB5503', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'data-013',    locationLabel: 'Senai, Johor',             latitude: 1.6015, longitude: 103.6650, fuelLitres: 2640, fuelCapacityLitres: 3000, staleMinutes: 3},
  {tag: 'PSG8817', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'data-013',    locationLabel: 'Senai, Johor',             latitude: 1.6023, longitude: 103.6662, fuelLitres: 1890, fuelCapacityLitres: 2450, staleMinutes: 6},
  {tag: 'MLK3392', model: 'FG Wilson 650 kVa',   runState: 'IDLE',    siteId: 'retail-014',  locationLabel: 'Melaka Tengah, Melaka',    latitude: 2.1896, longitude: 102.2501, fuelLitres: 720,  fuelCapacityLitres: 1600, staleMinutes: 26},
  {tag: 'SRB6644', model: 'Kohler 400 kVa',      runState: 'RUNNING', siteId: 'mfg-015',     locationLabel: 'Seremban, Negeri Sembilan',latitude: 2.7258, longitude: 101.9424, fuelLitres: 655,  fuelCapacityLitres: 900,  staleMinutes: 4,  startReason: 'TEST'},
  {tag: 'KTN1970', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'port-016',    locationLabel: 'Kuantan, Pahang',          latitude: 3.8077, longitude: 103.3260, fuelLitres: 1244, fuelCapacityLitres: 1800, staleMinutes: 9},
  {tag: 'KBR4128', model: 'Denyo 250 kVa',       runState: 'IDLE',    siteId: 'telco-017',   locationLabel: 'Kota Bharu, Kelantan',     latitude: 6.1254, longitude: 102.2381, fuelLitres: 168,  fuelCapacityLitres: 600,  staleMinutes: 73},
];

const MINUTE = 60_000;

/** ISO timestamp `minutes` before `now`. */
const minutesBefore = (now: number, minutes: number): string =>
  new Date(now - minutes * MINUTE).toISOString();

/**
 * The event feed shown under "Activity".
 *
 * Built from the unit's *current* state backwards, so the story is consistent:
 * a faulted genset's newest event is the fault, a running one's is the start
 * that put it there, and every unit eventually bottoms out at a refuel and a
 * service. Without that the panel would happily show "Engine stopped" as the
 * latest event on a unit whose badge reads Running.
 */
const buildActivity = (seed: FleetSeed, now: number): Array<GensetActivity> => {
  const {tag, runState, staleMinutes} = seed;

  // The START line quotes the seeded reason rather than assuming an outage. A unit
  // out on a test exercise beside a healthy grid is a real state of this fleet
  // (two are seeded that way), and a feed that called it an outage would disagree
  // with the intake meter the site page draws directly above it.
  const startedBecause =
    (seed.startReason ?? 'OUTAGE') === 'TEST'
      ? 'Engine started on test exercise'
      : 'Engine started on utility outage';

  const head: Array<[GensetActivityKind, string, number]> =
    runState === 'FAULT'
      ? [
          ['FAULT', 'Low fuel pressure — engine shut down', staleMinutes],
          ['START', startedBecause, staleMinutes + 96],
        ]
      : runState === 'OFFLINE'
        ? [
            ['STOP', 'Controller stopped reporting', staleMinutes],
            ['START', startedBecause, staleMinutes + 240],
          ]
        : runState === 'IDLE'
          ? [
              ['STOP', 'Engine stopped — utility restored', staleMinutes],
              ['START', startedBecause, staleMinutes + 174],
            ]
          : [
              ['START', startedBecause, staleMinutes + 42],
              ['STOP', 'Engine stopped — utility restored', staleMinutes + 1_290],
            ];

  // No `SERVICE` line here. There used to be one — "Scheduled 250-hour service
  // completed", eight days ago, on every unit in the fleet — and it was a claim
  // with no record behind it. Now that services are recorded, `services.ts` is
  // where they come from, and `serviceActivity()` turns each one into the feed
  // entry this used to fake. Leaving the seeded line in would have put a service
  // eight days ago on the same page as a service log saying it was in April.
  const tail: Array<[GensetActivityKind, string, number]> = [
    ['REFUEL', `Refuelled to ${seed.fuelCapacityLitres.toLocaleString('en-MY')}L`, staleMinutes + 2_760],
  ];

  return [...head, ...tail].map(([kind, message, minutes], index) => ({
    id: `${tag}-act-${index}`,
    kind,
    message,
    at: minutesBefore(now, minutes),
  }));
};

const buildFleet = (): Array<Genset> => {
  const now = Date.now();

  return FLEET_SEED.map((seed) => ({
    id: seed.tag.toLowerCase(),
    tag: seed.tag,
    model: seed.model,
    runState: seed.runState,
    // The seed's default. Resolved here rather than left optional on `Genset`, so
    // no reader has to know that a missing reason means an outage.
    startReason: seed.startReason ?? 'OUTAGE',
    fuelLitres: seed.fuelLitres,
    fuelCapacityLitres: seed.fuelCapacityLitres,
    siteId: seed.siteId,
    locationLabel: seed.locationLabel,
    latitude: seed.latitude,
    longitude: seed.longitude,
    lastUpdated: minutesBefore(now, seed.staleMinutes),
    activity: buildActivity(seed, now),
  }));
};

export const GENSETS: Array<Genset> = buildFleet();

/** The unit the design opens on, and this app's default selection. */
export const DEFAULT_GENSET_ID = 'brf9540';
