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
 * This branch's estate stands in **Sabah and Labuan only** — the territory the
 * demo's operator serves. Every tag, run state, tank level and pairing is the
 * shared seed's row unchanged; only the geography moved, so the tuned buckets
 * and the Figma-pinned values survive the relocation.
 *
 * Three things are deliberate about the shape of it:
 *
 *  - Twelve of the units sit in greater Kota Kinabalu. That's what makes
 *    the map's cluster bubble read "12" at the zoom the design shows, which is
 *    the whole reason the cluster exists in the mock-up.
 *  - `BRF9540 | Cummins 1000 kVa` is pinned to exactly the values in the Figma
 *    frames — Running, 1763 L of 2450 (72%), ~57 minutes stale —
 *    so the detail panel can be diffed against the design directly.
 *  - **Many sites hold two units**, which is what makes the site
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
  // — Greater Kota Kinabalu (12) — the cluster in the map view.
  {tag: 'BRF9540', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'telco-001',   locationLabel: 'Luyang, Kota Kinabalu',      latitude: 5.9556, longitude: 116.0804, fuelLitres: 1763, fuelCapacityLitres: 2450, staleMinutes: 57},
  {tag: 'KLN3355', model: 'Cummins 1000 kVa',    runState: 'FAULT',   siteId: 'telco-001',   locationLabel: 'Luyang, Kota Kinabalu',      latitude: 5.9564, longitude: 116.0816, fuelLitres: 214,  fuelCapacityLitres: 2450, staleMinutes: 9},
  {tag: 'CYB6602', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'data-002',    locationLabel: 'Sepanggar, Sabah',           latitude: 6.0666, longitude: 116.1324, fuelLitres: 2810, fuelCapacityLitres: 3000, staleMinutes: 1},
  {tag: 'KJG9048', model: 'Denyo 250 kVa',       runState: 'OFFLINE', siteId: 'data-002',    locationLabel: 'Sepanggar, Sabah',           latitude: 6.0674, longitude: 116.1336, fuelLitres: 96,   fuelCapacityLitres: 600,  staleMinutes: 2_890},
  {tag: 'KLG2214', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'telco-003',   locationLabel: 'Penampang, Sabah',           latitude: 5.9370, longitude: 116.1120, fuelLitres: 940,  fuelCapacityLitres: 1200, staleMinutes: 4},
  {tag: 'SHA7731', model: 'Perkins 800 kVa',     runState: 'IDLE',    siteId: 'mfg-004',     locationLabel: 'Inanam, Sabah',              latitude: 5.9796, longitude: 116.1284, fuelLitres: 612,  fuelCapacityLitres: 1800, staleMinutes: 12},
  {tag: 'PCH4180', model: 'FG Wilson 650 kVa',   runState: 'RUNNING', siteId: 'mfg-004',     locationLabel: 'Inanam, Sabah',              latitude: 5.9804, longitude: 116.1296, fuelLitres: 1338, fuelCapacityLitres: 1600, staleMinutes: 2},
  {tag: 'KLC1027', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'tower-005',   locationLabel: 'Kota Kinabalu City Centre',  latitude: 5.9860, longitude: 116.0760, fuelLitres: 2255, fuelCapacityLitres: 3000, staleMinutes: 3},
  {tag: 'CHR5162', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'hosp-006',    locationLabel: 'Bukit Padang, Kota Kinabalu',latitude: 5.9496, longitude: 116.0874, fuelLitres: 1102, fuelCapacityLitres: 1800, staleMinutes: 6},
  {tag: 'AMP8890', model: 'Kohler 400 kVa',      runState: 'IDLE',    siteId: 'hosp-006',    locationLabel: 'Bukit Padang, Kota Kinabalu',latitude: 5.9504, longitude: 116.0886, fuelLitres: 448,  fuelCapacityLitres: 900,  staleMinutes: 31},
  {tag: 'RWG3471', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'mfg-007',     locationLabel: 'Telipok, Sabah',             latitude: 6.1230, longitude: 116.1740, fuelLitres: 733,  fuelCapacityLitres: 1200, staleMinutes: 8},
  {tag: 'SPG2093', model: 'FG Wilson 650 kVa',   runState: 'RUNNING', siteId: 'airport-008', locationLabel: 'Tanjung Aru, Kota Kinabalu', latitude: 5.9370, longitude: 116.0510, fuelLitres: 1455, fuelCapacityLitres: 1600, staleMinutes: 5,  startReason: 'TEST'},

  // — The west-coast corridor (6): Tuaran up to Kota Marudu.
  {tag: 'IPH7724', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'mfg-009',     locationLabel: 'Tuaran, Sabah',            latitude: 6.1766, longitude: 116.2324, fuelLitres: 1520, fuelCapacityLitres: 1800, staleMinutes: 7},
  {tag: 'TPG1188', model: 'Kohler 400 kVa',      runState: 'IDLE',    siteId: 'mfg-009',     locationLabel: 'Tuaran, Sabah',            latitude: 6.1774, longitude: 116.2336, fuelLitres: 305,  fuelCapacityLitres: 900,  staleMinutes: 44},
  {tag: 'PNG6015', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'telco-010',   locationLabel: 'Kota Belud, Sabah',        latitude: 6.3506, longitude: 116.4294, fuelLitres: 2004, fuelCapacityLitres: 2450, staleMinutes: 2},
  {tag: 'BKM4409', model: 'Cummins 500 kVa',     runState: 'FAULT',   siteId: 'telco-010',   locationLabel: 'Kota Belud, Sabah',        latitude: 6.3514, longitude: 116.4306, fuelLitres: 511,  fuelCapacityLitres: 1200, staleMinutes: 18},
  {tag: 'SGP7756', model: 'Denyo 250 kVa',       runState: 'RUNNING', siteId: 'retail-011',  locationLabel: 'Kudat, Sabah',             latitude: 6.8830, longitude: 116.8440, fuelLitres: 402,  fuelCapacityLitres: 600,  staleMinutes: 11},
  {tag: 'ASR2260', model: 'Perkins 800 kVa',     runState: 'OFFLINE', siteId: 'telco-012',   locationLabel: 'Kota Marudu, Sabah',       latitude: 6.5040, longitude: 116.7440, fuelLitres: 880,  fuelCapacityLitres: 1800, staleMinutes: 1_615},

  // — Interior, Labuan and the south-west (6).
  {tag: 'JHB5503', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'data-013',    locationLabel: 'Keningau, Sabah',          latitude: 5.3376, longitude: 116.1594, fuelLitres: 2640, fuelCapacityLitres: 3000, staleMinutes: 3},
  {tag: 'PSG8817', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'data-013',    locationLabel: 'Keningau, Sabah',          latitude: 5.3384, longitude: 116.1606, fuelLitres: 1890, fuelCapacityLitres: 2450, staleMinutes: 6},
  {tag: 'MLK3392', model: 'FG Wilson 650 kVa',   runState: 'IDLE',    siteId: 'retail-014',  locationLabel: 'Victoria, Labuan',         latitude: 5.2767, longitude: 115.2417, fuelLitres: 720,  fuelCapacityLitres: 1600, staleMinutes: 26},
  {tag: 'SRB6644', model: 'Kohler 400 kVa',      runState: 'RUNNING', siteId: 'mfg-015',     locationLabel: 'Papar, Sabah',             latitude: 5.7330, longitude: 115.9330, fuelLitres: 655,  fuelCapacityLitres: 900,  staleMinutes: 4,  startReason: 'TEST'},
  {tag: 'KTN1970', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'port-016',    locationLabel: 'Sepanggar Bay, Sabah',     latitude: 6.0830, longitude: 116.1080, fuelLitres: 1244, fuelCapacityLitres: 1800, staleMinutes: 9},
  {tag: 'KBR4128', model: 'Denyo 250 kVa',       runState: 'IDLE',    siteId: 'telco-017',   locationLabel: 'Tenom, Sabah',             latitude: 5.1330, longitude: 115.9500, fuelLitres: 168,  fuelCapacityLitres: 600,  staleMinutes: 73},

  // — The interior and the east coast (13) —
  //
  // The far half of the state is where the interesting half of this estate is.
  // Six of these yards are `PRIME`, which is not a coincidence: a Nabawan
  // exchange or a Semporna tower has no mains incomer to back up, and the sets
  // there *are* the supply. That is the case the overview's outer split exists
  // to separate — and at these road distances the drive is most of any
  // intervention, which is what the buckets are for.
  //
  // Their tank levels are chosen rather than scattered. `rulesFor` deals alarms from
  // a hash of the tag, so a fleet seeded without thought lands almost everything in
  // the alarm bucket and leaves "Refuel due" reading zero on a screen built to show
  // it. These thirteen are picked to put real numbers in all four buckets — five
  // below the reserve line, one dry, two alarming — without touching a single
  // existing row, which matters because `BRF9540` and its neighbours are pinned to
  // the Figma frames.
  {tag: 'KKB8856', model: 'Cummins 500 kVa',     runState: 'RUNNING', siteId: 'telco-018', locationLabel: 'Ranau, Sabah',           latitude: 5.9536, longitude: 116.6634, fuelLitres: 220,  fuelCapacityLitres: 1000, staleMinutes: 12},
  {tag: 'KKN4011', model: 'Cummins 500 kVa',     runState: 'IDLE',    siteId: 'telco-018', locationLabel: 'Ranau, Sabah',           latitude: 5.9544, longitude: 116.6646, fuelLitres: 860,  fuelCapacityLitres: 1000, staleMinutes: 4},
  {tag: 'KNU2218', model: 'Denyo 250 kVa',       runState: 'RUNNING', siteId: 'telco-019', locationLabel: 'Nabawan, Sabah',         latitude: 5.0620, longitude: 116.4370, fuelLitres: 108,  fuelCapacityLitres: 600,  staleMinutes: 38},
  {tag: 'SDK5847', model: 'Perkins 800 kVa',     runState: 'RUNNING', siteId: 'telco-020', locationLabel: 'Sandakan, Sabah',        latitude: 5.8398, longitude: 118.1173, fuelLitres: 740,  fuelCapacityLitres: 1000, staleMinutes: 7},
  {tag: 'LDU7588', model: 'Denyo 250 kVa',       runState: 'RUNNING', siteId: 'tower-021', locationLabel: 'Lahad Datu, Sabah',      latitude: 5.0273, longitude: 118.3276, fuelLitres: 402,  fuelCapacityLitres: 600,  staleMinutes: 21},
  {tag: 'LWS6446', model: 'Denyo 250 kVa',       runState: 'IDLE',    siteId: 'tower-021', locationLabel: 'Lahad Datu, Sabah',      latitude: 5.0265, longitude: 118.3264, fuelLitres: 546,  fuelCapacityLitres: 600,  staleMinutes: 3},
  {tag: 'KCH8566', model: 'Caterpillar 1250 kVa',runState: 'RUNNING', siteId: 'data-022',  locationLabel: 'Batu Sapi, Sandakan',    latitude: 5.8556, longitude: 118.0204, fuelLitres: 2040, fuelCapacityLitres: 3000, staleMinutes: 1},
  {tag: 'KTG7712', model: 'Caterpillar 1250 kVa',runState: 'IDLE',    siteId: 'data-022',  locationLabel: 'Batu Sapi, Sandakan',    latitude: 5.8564, longitude: 118.0216, fuelLitres: 1650, fuelCapacityLitres: 3000, staleMinutes: 16},
  {tag: 'BTU3941', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'port-023',  locationLabel: 'Tawau, Sabah',           latitude: 4.2454, longitude: 117.8846, fuelLitres: 588,  fuelCapacityLitres: 2450, staleMinutes: 9},
  {tag: 'SRI7241', model: 'Cummins 1000 kVa',    runState: 'IDLE',    siteId: 'port-023',  locationLabel: 'Tawau, Sabah',           latitude: 4.2446, longitude: 117.8834, fuelLitres: 1936, fuelCapacityLitres: 2450, staleMinutes: 44},
  {tag: 'MRI8502', model: 'Cummins 1000 kVa',    runState: 'RUNNING', siteId: 'mfg-024',   locationLabel: 'POIC Lahad Datu, Sabah', latitude: 5.0484, longitude: 118.3996, fuelLitres: 1544, fuelCapacityLitres: 2450, staleMinutes: 6},
  {tag: 'LBG4884', model: 'Cummins 1000 kVa',    runState: 'IDLE',    siteId: 'mfg-024',   locationLabel: 'POIC Lahad Datu, Sabah', latitude: 5.0476, longitude: 118.3984, fuelLitres: 172,  fuelCapacityLitres: 2450, staleMinutes: 51},
  {tag: 'KPT8033', model: 'Denyo 250 kVa',       runState: 'IDLE',    siteId: 'telco-025', locationLabel: 'Semporna, Sabah',        latitude: 4.4770, longitude: 118.6110, fuelLitres: 96,   fuelCapacityLitres: 600,  staleMinutes: 27},
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
