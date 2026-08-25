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
 * This branch's estate is **a carrier's tower network across Malaysia**, and the
 * thing that changed most from the mobile-fleet seed is *scale*. A macro base
 * station draws 4–6 kW and takes a 20 kVA set; the utility build's smallest
 * machine was 250 kVA. Every rating, tank and load here is sized to the site it
 * stands at, because a 1,000 kVA genset beside a 5 kW tower is the one detail
 * that would tell a reader this estate was borrowed from another product.
 *
 * Four things are deliberate about the shape of it:
 *
 *  - **The two switching centres carry the big plant**, and they are the only
 *    places on the estate that do. `WPKL-0207` at 205 kW and `JHR-0907` at
 *    168 kW are the sites where a 1,000 and a 500 kVA set are the right answer.
 *  - `BRF9540 | Cummins 1000 kVa` is pinned to exactly the values in the Figma
 *    frames — Running, 1763 L of 2450 (72%), ~57 minutes stale, carrying 205 kW —
 *    so the detail panel can be diffed against the design directly. It sits at
 *    `wpkl-0207`, whose load is that same 205 kW, which is what keeps the pin
 *    from reading as an oversized machine at an undersized site.
 *  - **The two switching centres and the two diesel-prime sites hold two units
 *    each**, which is what makes the site page's single-line diagram worth
 *    drawing — a diagram of one genset feeding one load has no changeover
 *    decision in it. Everywhere else holds one, which is the truth about a tower
 *    site: there is a plinth, and there is one machine on it.
 *  - **Tank levels are chosen rather than scattered.** `rulesFor` deals alarms
 *    from a hash of the tag, so a fleet seeded without thought lands almost
 *    everything in the alarm bucket and leaves "Low fuel" reading zero on a
 *    screen built to show it. The levels below put real numbers in all four
 *    buckets — three below the reserve line, one dry, two alarming.
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
   * Why this unit last cranked. **`OUTAGE` unless stated** — the ordinary reason
   * on a grid-backed site, and the one the activity feed has always assumed.
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
