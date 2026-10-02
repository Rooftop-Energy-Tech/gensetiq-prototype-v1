/**
 * The depots, on their own so the fill classifier and the depot tank can both read
 * them without importing each other. `depotTank.ts` re-exports `DEPOTS` and `Depot`,
 * so nothing that imported them from there had to change.
 */

/**
 * The yards fuel is issued from.
 *
 * Four, placed where the estate's machines actually are: the Klang valley holds
 * thirteen of the thirty-eight, and Perak, Penang and Johor most of the rest. The
 * machines out in states with no depot are the trucks' (`trucks.ts`). A single national depot would be a fiction on an estate 700 km end to end —
 * nobody trucks diesel from Klang to Bayan Lepas — and it would also make the one
 * number on this page an average that no yard manager recognises.
 *
 * Their tanks are **not** the same size, because their catchments are not. Klang
 * fuels twenty-one machines and the others five or six, so a uniform 200,000 L gave
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
   * This yard's level sensor under-reads its falls, as a fraction.
   *
   * A float out of calibration does not lose fuel; it mis-measures the fuel that
   * moves. So the tank really gives up the litres the fleet took, and the
   * instrument writes down slightly fewer — which is why the variance comes out
   * **negative**: the gensets can prove more arrived than the depot can prove it
   * released. That is the one shape of gap that is never a loss, and it is what
   * `Sensor fault` exists to say.
   *
   * Set on exactly one yard. Without it every depot reconciled to within a few
   * litres, and the middle grade of the alarm had no way to be seen.
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

export const DEPOTS: ReadonlyArray<Depot> = [
  {id: 'klang', name: 'Klang', locationLabel: 'Klang, Selangor', address: 'Lot 12, Jalan Kebun Nenas 3, Kawasan Perindustrian Kebun Nenas, 41100 Klang, Selangor', latitude: 3.0449, longitude: 101.4455},
  {id: 'ipoh', name: 'Ipoh', locationLabel: 'Ipoh, Perak', address: 'Lot 7, Jalan Lahat, Kawasan Perindustrian Menglembu, 31450 Ipoh, Perak', latitude: 4.5975, longitude: 101.0901, stockFraction: 0.5},
  {id: 'butterworth', name: 'Butterworth', locationLabel: 'Butterworth, Pulau Pinang', address: 'Plot 22, Jalan Perusahaan 4, Kawasan Perindustrian Perai, 13600 Perai, Pulau Pinang', latitude: 5.3991, longitude: 100.3639, sensorDriftFraction: 0.025},
  {id: 'pasir-gudang', name: 'Pasir Gudang', locationLabel: 'Pasir Gudang, Johor', address: 'PLO 45, Jalan Pekeliling, Kawasan Perindustrian Pasir Gudang, 81700 Pasir Gudang, Johor', latitude: 1.4716, longitude: 103.8914, stockFraction: 0.24},
];

/**
 * Which depot serves a machine: the nearest one, by straight-line distance.
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

/**
 * The state a depot stands in, by name — `Selangor` for Klang.
 *
 * Read off the tail of its `locationLabel` rather than written down twice, because
 * the label is what a reader sees and the rule that uses this (a genset in a
 * depot's own state drives in to it) has to agree with what the card says.
 */
export const depotState = (depot: Depot): string =>
  depot.locationLabel.split(',').at(-1)?.trim() ?? depot.locationLabel;
