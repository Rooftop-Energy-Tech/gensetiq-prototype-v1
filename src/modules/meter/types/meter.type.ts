/**
 * A power meter is a **device**, not a number.
 *
 * That is the whole point of this module. The site page used to state a figure for
 * the grid supply at every site, unconditionally, as though measurement were free —
 * and it is not. Metering is a box somebody fits to a circuit, and plenty of sites
 * have never had one. Where there is no meter there is no figure, and the page has
 * to say so rather than quietly inventing one.
 */

/**
 * Which circuit a meter is wired to.
 *
 * Two, and they are genuinely different measurements rather than two names for one:
 *
 * - `MAINS` — the incomer. What the site is **importing from the grid**, which is
 *   nothing at all while a genset is carrying the load.
 * - `LOAD` — the outgoing feeder. What the **customer is consuming**, whoever happens
 *   to be supplying it.
 *
 * They coincide only while the grid is carrying. A site metered on the mains alone
 * goes blind the moment it transfers to diesel; a site metered on the load never does.
 * That is exactly the trade a customer makes when they fit one and not the other, so
 * the app models the point rather than flattening both into "the meter".
 */
export const METER_POINTS = ['MAINS', 'LOAD'] as const;

export type MeterPoint = (typeof METER_POINTS)[number];

export const METER_POINT_LABEL: Record<MeterPoint, string> = {
  MAINS: 'Mains incomer',
  LOAD: 'Site load',
};

/**
 * Where a meter is fitted — a site **and** the circuit it is wired to.
 *
 * One object rather than two nullable fields on the meter, so "at a site but wired to
 * nothing" and "wired to the load but at no site" cannot be written down. A meter is
 * either installed somewhere specific or it is in stores; there is no third state, and
 * a shape that allowed one would eventually hold it.
 */
export type MeterFitting = {siteId: string; point: MeterPoint};

export type PowerMeter = {
  /** e.g. `pm-0101`. */
  id: string;
  /** Asset tag on the device, e.g. `PM-0101`. The fleet's `tag`, by another name. */
  serial: string;
  /** e.g. `Schneider PM2200`. */
  model: string;
  /** `null` when the meter is in stores rather than installed. */
  fitting: MeterFitting | null;
  /**
   * Is the device reporting.
   *
   * The same distinction `OFFLINE` draws for a genset: a meter that has stopped
   * talking is worse than one that isn't there, because the circuit *is* metered and
   * somebody is entitled to expect a figure from it. The two produce different words
   * on the page — `unmetered` against `no reading` — because they need different
   * actions: fit a meter, or go and find out why this one is silent.
   */
  online: boolean;
};

/**
 * A metered quantity: the figure, or the reason there isn't one.
 *
 * A bare `number | null` was the obvious alternative and it loses the only thing the
 * reader needs when it *is* null — whether nobody ever fitted a meter here, or one is
 * fitted and has gone quiet. Those are different problems with different owners.
 */
export type MeterFeed =
  | {state: 'METERED'; kw: number}
  /** No meter is fitted to this circuit. */
  | {state: 'UNMETERED'}
  /** A meter is fitted and is not reporting. */
  | {state: 'NOT_REPORTING'};

/** The figure, when there is one. */
export const meteredKw = (feed: MeterFeed): number | null =>
  feed.state === 'METERED' ? feed.kw : null;
