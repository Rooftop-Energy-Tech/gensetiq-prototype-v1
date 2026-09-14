import {siteLabel} from '@/modules/site/data/siteSeed';

/**
 * The three states a genset reports. Ordered by how much they want attention —
 * `RUN_STATES` is the sort key used by the "state" column, so a working unit
 * surfaces above a silent one.
 */
export const RUN_STATES = ['RUNNING', 'IDLE', 'OFFLINE'] as const;

export type RunState = (typeof RUN_STATES)[number];

export type GensetActivityKind = 'START' | 'STOP' | 'REFUEL' | 'SERVICE' | 'DEPLOY' | 'NOTE';

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
  /**
   * Where the entry came from — the controller's own event stream, the
   * dispatch feed, the service log, or a person typing.
   * Displayed beside the timestamp, because an audit trail whose entries
   * cannot say who put them there is a list rather than a log.
   */
  source?: string;
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
  /**
   * The lorry or trailer plate this machine is registered under, or `null` when it
   * has none — a set on a plinth is not a road vehicle.
   *
   * Nullable rather than optional, for the reason `siteId` is: "this machine has
   * no plate" is a fact the register holds, and an optional field would let every
   * reader treat the absence as an oversight instead. The details block prints the
   * row only when there is one.
   */
  plateNumber: string | null;
  fuelLitres: number;
  fuelCapacityLitres: number;
  /**
   * The site this unit is installed at, e.g. `wpkl-0207` — or `null` when it is in
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

/**
 * `Genset | WPKL-0207` — the asset, then the site it stands at.
 *
 * It read `Genset | BRF9540` until 2026-09-14, naming the machine by its own tag.
 * The tag is a placeholder: this estate has no genset names recorded yet, and a
 * fixture tag is not one — so the name falls back to the fact the prototype can
 * actually answer for, which is where the set is. The bank, the array and the
 * cabinet already name their site, so this is the shape the other three use.
 *
 * ⚠️ **Five sites on this estate hold two sets, so five pairs of rows now carry the
 * same name.** That is the cost of the fallback and it is not a rendering fault:
 * the register still keys, selects and links by `genset.id`, so the rows are
 * distinct objects that happen to read alike. The tag has not gone anywhere — it is
 * still on the `Genset` record and still what the search box matches — so restoring
 * it, or appending it where a site holds a pair, is a change to this one line.
 *
 * The model this used to carry is in the rail's info glyph, one row under the asset
 * tag. It was the right second half when the first half was already a machine's tag
 * — two sets on one plinth are told apart by what they are — but it is not what
 * identifies a set, and the name's job here is to say *what kind of thing* the page
 * is about before saying which one.
 */
export const gensetName = (genset: Genset): string => `Genset | ${gensetSiteName(genset)}`;

/**
 * The **second half on its own** — `WPKL-0207`, no `Genset |` in front of it.
 *
 * For the surfaces where something beside the name has already said what kind of
 * thing this is — the **fleet register**: its column is headed `Genset name`, its page
 * is headed `Gensets`, and printing the word again is the header read once per row,
 * thirty times down a column that says it at the top. Tristan's call, 2026-09-14. The
 * register's three renderings all take it: the table, the phone cards and the preview
 * panel are one screen and must not name the same machine two ways.
 *
 * **`gensetName` above is still the right one for a detail page**, and that is the
 * line between them. A set, a bank, an array and a cabinet standing at one site all
 * take that site's name, so `SBH-1336` alone would title four different pages
 * identically — there the prefix is the only thing saying which of the four you are
 * reading, and the rail it sits in lists all four. A column header cannot be in two
 * places at once; a page title has to carry its own.
 */
export const gensetSiteName = (genset: Genset): string =>
  genset.siteId === null ? genset.tag : siteLabel(genset.siteId);
