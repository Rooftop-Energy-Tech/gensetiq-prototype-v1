import {DATASET} from '@/brands';
import type {DatasetId} from '@/brands';

/**
 * The depots, on their own so the fills (`fills.ts`) and the depot tank can both read
 * them without importing each other. `depotTank.ts` re-exports `DEPOTS` and `Depot`,
 * so nothing that imported them from there had to change.
 */

/**
 * The yards fuel is issued from.
 *
 * Placed where each estate's machines actually are. On Express Mission's, four: the
 * Klang valley holds thirteen of the thirty-eight, and Perak, Penang and Johor most
 * of the rest; a machine in a state with no depot is supplied by the nearest one
 * (`fills.ts`). The carrier's seven follow its towers into Sabah and Sarawak. A
 * single national depot would be a fiction on an estate 700 km end to end —
 * nobody hauls diesel from Klang to Bayan Lepas — and it would also make the one
 * number on this page an average that no yard manager recognises.
 *
 * Their tanks are **not** the same size, because their catchments are not. Klang
 * issues about 100,000 L a month and the others 30,000 to 60,000 (2026-10-05), and
 * when it fuelled twenty-one machines to their five or six a uniform 200,000 L gave
 * the three smaller yards five months of cover — tanks that never took a delivery in
 * the whole record and sat there draining. Each is sized from what it actually
 * issues; see `depotCapacityLitres`.
 */
export type Depot = {
  id: string;
  name: string;
  locationLabel: string;
  /**
   * The yard's street address, under its name on the depot's page (Jeff,
   * 2026-10-01). Made up for the prototype — plausible industrial-estate
   * addresses in each town, not real depots.
   */
  address: string;
  latitude: number;
  longitude: number;
  /**
   * Written down only where a yard's tank is not what its catchment implies.
   * Absent, the capacity is derived — see `depotCapacityLitres`.
   */
  capacityLitres?: number;
  /**
   * This yard's level sensor over-reads its falls, as a fraction.
   *
   * A float out of calibration does not lose fuel; it mis-measures the fuel that
   * moves. So the tank really gives up the litres its gensets received, and the
   * instrument writes down slightly more — a small gap that grows with throughput.
   * It was planted for the `Sensor fault` verdict, removed 2026-10-05 (Jeff); past
   * 100 L, as it is on Express Mission's month, it now flags as missing in transit
   * like any other gap.
   *
   * It used to under-read, which made the gap negative; since the gap is held at
   * zero (2026-10-01) that showed as nothing, so it over-reads now (2026-10-05).
   * Set on one Express Mission yard.
   */
  sensorDriftFraction?: number;
  /**
   * Where this yard's tank stands now, as a fraction, where it is written down.
   *
   * Every yard otherwise sits high, because the supplier's round tops it up to what
   * it issued, and four near-full tanks never show what a low one looks like
   * (Jeff, 2026-09-30). The walk reaches this by shrinking each round's load until
   * the level lands on it — a supplier bringing less than the yard issues, so the
   * stock runs down week by week. Kept above the 18% reorder floor, which would
   * refill the tank to the brim instead.
   */
  stockFraction?: number;
};

/** How far the one drifting yard's sensor over-reads its falls — see `Depot.sensorDriftFraction`. */
const SENSOR_DRIFT = 0.001;

const KLANG: Depot = {id: 'klang', name: 'Klang', locationLabel: 'Klang, Selangor', address: 'Lot 12, Jalan Kebun Nenas 3, Kawasan Perindustrian Kebun Nenas, 41100 Klang, Selangor', latitude: 3.0449, longitude: 101.4455};
const BUTTERWORTH: Depot = {id: 'butterworth', name: 'Butterworth', locationLabel: 'Butterworth, Pulau Pinang', address: 'Plot 22, Jalan Perusahaan 4, Kawasan Perindustrian Perai, 13600 Perai, Pulau Pinang', latitude: 5.3991, longitude: 100.3639};
const PASIR_GUDANG: Depot = {id: 'pasir-gudang', name: 'Pasir Gudang', locationLabel: 'Pasir Gudang, Johor', address: 'PLO 45, Jalan Pekeliling, Kawasan Perindustrian Pasir Gudang, 81700 Pasir Gudang, Johor', latitude: 1.4716, longitude: 103.8914};

/**
 * Each estate's yards. Per estate because one shared list sent the carrier's Sabah
 * and Sarawak towers to Pasir Gudang for every fill, across the South China Sea. The
 * carrier keeps the three peninsular yards its towers there are nearest and adds
 * four in Borneo, where most of its sets stand.
 */
const DEPOTS_BY_DATASET: Record<DatasetId, ReadonlyArray<Depot>> = {
  utility: [
    KLANG,
    {id: 'ipoh', name: 'Ipoh', locationLabel: 'Ipoh, Perak', address: 'Lot 7, Jalan Lahat, Kawasan Perindustrian Menglembu, 31450 Ipoh, Perak', latitude: 4.5975, longitude: 101.0901, stockFraction: 0.5},
    {...BUTTERWORTH, sensorDriftFraction: SENSOR_DRIFT},
    // Written down (Jeff, 2026-10-05): sized from its catchment once the trucks went,
    // it came out at 60,000 L, and a tank that small issuing 8,000 L a week cannot be
    // walked down to 24% without touching the reorder floor on the way.
    {...PASIR_GUDANG, capacityLitres: 80_000, stockFraction: 0.24},
  ],
  carrier: [
    KLANG,
    BUTTERWORTH,
    PASIR_GUDANG,
    {id: 'kota-kinabalu', name: 'Kota Kinabalu', locationLabel: 'Kota Kinabalu, Sabah', address: 'Lot 18, Jalan Industri 2, Kota Kinabalu Industrial Park, 88460 Kota Kinabalu, Sabah', latitude: 6.0880, longitude: 116.1380},
    {id: 'sandakan', name: 'Sandakan', locationLabel: 'Sandakan, Sabah', address: 'Lot 4, Jalan Batu Sapi, Kawasan Perindustrian Batu Sapi, 90000 Sandakan, Sabah', latitude: 5.8600, longitude: 118.0700},
    {id: 'bintulu', name: 'Bintulu', locationLabel: 'Bintulu, Sarawak', address: 'Lot 210, Jalan Tanjung Kidurong, Kidurong Industrial Area, 97000 Bintulu, Sarawak', latitude: 3.2650, longitude: 113.0700},
    {id: 'kuching', name: 'Kuching', locationLabel: 'Kuching, Sarawak', address: 'Lot 9, Jalan Pending, Kawasan Perindustrian Pending, 93450 Kuching, Sarawak', latitude: 1.5530, longitude: 110.3900},
  ],
};

/** The active estate's yards. */
export const DEPOTS: ReadonlyArray<Depot> = DEPOTS_BY_DATASET[DATASET.id];

/**
 * Which depot supplies a machine: the nearest one, by straight-line distance.
 *
 * Distance on the raw coordinates rather than a great circle. Over 700 km of one
 * peninsula the two answers differ by a rounding, and the question here is only
 * *which of four is closest* — a figure that would have to be wrong by 200 km to
 * change the answer.
 */
export const depotFor = (latitude: number, longitude: number): Depot => {
  let nearest = DEPOTS[0];
  let best = Number.POSITIVE_INFINITY;

  for (const depot of DEPOTS) {
    const dx = depot.latitude - latitude;
    const dy = depot.longitude - longitude;
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      best = distance;
      nearest = depot;
    }
  }

  return nearest;
};
