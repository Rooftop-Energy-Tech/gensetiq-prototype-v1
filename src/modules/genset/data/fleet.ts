import {DATASET} from '@/brands';
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

/**
 * The active estate's machines.
 *
 * The rows live in `brands/datasets/*.ts` beside the sites they stand on, because
 * every `siteId` below has to name a site in the same estate or the fleet and the
 * site rollups disagree by a machine and nothing says so. `assertDatasetIntegrity`
 * checks exactly that pairing on load, which is only possible while the two arrays
 * are in one file.
 *
 * The two casts are the dataset layer declining to import the genset module: a
 * dataset states `runState` and `startReason` as plain strings so a dataset file
 * can be read on its own, and they are asserted back to their unions here. The
 * integrity check does not cover them — those vocabularies are the product's — so
 * use the names in `RunState` and `StartReason`.
 */
const FLEET_SEED: Array<FleetSeed> = DATASET.gensets.map((seed) => ({
  ...seed,
  runState: seed.runState as RunState,
  startReason: seed.startReason as StartReason | undefined,
  // A machine in the workshop stands at no site. The seeds here all name one, but
  // the dataset shape allows the workshop case and this column is not optional.
  siteId: seed.siteId ?? '',
}));

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
export const DEFAULT_GENSET_ID = DATASET.defaultGensetId;
