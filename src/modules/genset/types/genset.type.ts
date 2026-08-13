/**
 * The four states a genset reports. Ordered by how much they want attention —
 * `RUN_STATES` is the sort key used by the "state" column, so a faulted unit
 * surfaces above a healthy one.
 */
export const RUN_STATES = ['FAULT', 'RUNNING', 'IDLE', 'OFFLINE'] as const;

export type RunState = (typeof RUN_STATES)[number];

export type GensetActivityKind = 'START' | 'STOP' | 'REFUEL' | 'FAULT' | 'SERVICE';

export type GensetActivity = {
  id: string;
  kind: GensetActivityKind;
  message: string;
  /** ISO 8601. */
  at: string;
};

export type Genset = {
  id: string;
  /** Asset tag, e.g. `BRF9540`. Unique, and what the search box matches first. */
  tag: string;
  /** e.g. `Cummins 1000 kVa`. */
  model: string;
  runState: RunState;
  fuelLitres: number;
  fuelCapacityLitres: number;
  /**
   * The site this unit is installed at, e.g. `telco-001`.
   *
   * A genset is always at exactly one site — it is a machine bolted to a slab,
   * and the site is the slab. The relationship is held here rather than as a list
   * of members on the site so it cannot be half-stated: there is no way to
   * express a unit at two sites, or at none.
   */
  siteId: string;
  /**
   * Human-readable placename, e.g. `Petaling Jaya, Selangor`.
   *
   * This is the *site's* placename — two gensets at the same site necessarily
   * report the same one, and `sites.ts` reads it back off them.
   */
  locationLabel: string;
  latitude: number;
  longitude: number;
  /** ISO 8601 — when telemetry last arrived from this unit. */
  lastUpdated: string;
  activity: Array<GensetActivity>;
};

/** `BRF9540 | Cummins 1000 kVa` — the label the design uses everywhere. */
export const gensetName = (genset: Genset): string => `${genset.tag} | ${genset.model}`;
