/**
 * The four states a genset reports. Ordered by how much they want attention —
 * `RUN_STATES` is the sort key used by the "state" column, so a faulted unit
 * surfaces above a healthy one.
 */
export const RUN_STATES = ['FAULT', 'RUNNING', 'IDLE', 'OFFLINE'] as const;

export type RunState = (typeof RUN_STATES)[number];

export type GensetActivityKind = 'START' | 'STOP' | 'REFUEL' | 'FAULT' | 'SERVICE';

/**
 * Why this unit's run began — the controller's own reason for cranking.
 *
 * Two, and the distinction is the difference between an incident and a scheduled
 * chore:
 *
 * - `OUTAGE` — the mains failed and the controller picked the load up. The site
 *   is on generator because it has to be.
 * - `TEST` — a periodic exercise. Standby plant that is never run seizes, so it is
 *   started deliberately on a schedule, beside a perfectly healthy grid.
 *
 * It lives on the genset because starting is something a *controller* does, and it
 * is what lets the site page's intake meter agree with this unit's activity feed:
 * a set running on `TEST` cannot be drawn as evidence of a mains failure, which is
 * precisely the wrong answer an earlier version of the site diagram gave.
 */
export type StartReason = 'OUTAGE' | 'TEST';

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
  /**
   * Why the current run started — or, on a stopped unit, why the last one did.
   *
   * Always present rather than optional-when-idle: every unit in the log has been
   * started by something, and a nullable field here would push the "we don't know"
   * case onto every reader for a fact that is never actually unknown.
   */
  startReason: StartReason;
  fuelLitres: number;
  fuelCapacityLitres: number;
  /**
   * The site this unit is installed at, e.g. `ppu-001` — or `null` when it is in
   * the depot, owned but not deployed.
   *
   * The relationship is held **here rather than as a member list on the site**, and
   * that is the half of the old invariant still doing work: a unit can be at one
   * site or no site, never two, and a site cannot claim a unit that does not exist.
   * A hand-maintained list on the site gets both of those wrong eventually.
   *
   * The half deliberately given up is "never at no site". It was true only because
   * nothing could move a machine; once a set can be detached, a depot is where it
   * goes — and gensets genuinely exist before they are deployed and while they are
   * away being serviced. Pretending otherwise would force every removal to be a
   * transfer to somewhere it is not.
   *
   * `fleet.ts` seeds it. `deployment.ts` is what changes it.
   */
  siteId: string | null;
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
