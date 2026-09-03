/**
 * A site is a **place with a load**, and gensets are what stand on it.
 *
 * That is the distinction the whole section rests on. A genset answers "what is
 * this machine doing"; a site answers "which of these machines is on the bus" —
 * a question that only exists the moment a site has more than one set, and one
 * that is invisible on either unit's own page.
 *
 * A site therefore owns exactly two things of its own: an identity (its name, and
 * what kind of load it carries) and the changeover that decides which of its sets
 * feeds that load. Everything else it reports — draw, fuel, condition — is
 * summed or ranked from its gensets, never stored, so a site cannot disagree with
 * the machines standing on it.
 */

import type {RunState} from '@/modules/genset/types/genset.type';
import type {MeterFeed} from '@/modules/meter/types/meter.type';
import type {CustomerId, ProgramId, SiteKindId} from '@/brands';

/**
 * What kind of network asset this site is.
 *
 * Not decoration: it is the reason the site tolerates an outage or doesn't. A
 * switching centre and a rural coverage site with identical plant are not equally
 * covered by one working genset — one of them carries traffic for a whole state —
 * and the kind is the only thing on the page that says so.
 *
 * It also sets the scale a reader should expect the load in. A macro base station
 * is 4–6 kW and a switching centre is a few hundred, so "is 216 kW a lot here" has
 * no answer without this field.
 *
 * **The vocabulary belongs to the dataset, not to this file.** It used to be a
 * five-entry union of tower classes, which is a fact about carriers: a utility's
 * estate is intake substations and feeder points, and there is no union that
 * covers both without meaning nothing. Each dataset declares its own kinds and
 * their labels, and `assertDatasetIntegrity` checks every site names one of them.
 * See `brands/types.ts` for where that line is drawn.
 */
export type SiteKind = SiteKindId;

/**
 * How this site is powered — and therefore **which circuit the site page draws**.
 *
 * Four configurations, because this estate genuinely runs four. The mobile-fleet
 * build had two, mains-backed and genset-only, and adding storage to that
 * vocabulary as a flag would have produced a fifth state nobody could name.
 *
 * - `GRID_BACKUP` — there is a utility incomer, and a genset backs it up. The
 *   load normally sits on the grid; the set picks it up when the grid drops.
 *   Town and suburban sites.
 * - `DIESEL_PRIME` — no incomer, no storage. The genset *is* the supply and runs
 *   continuously. The oldest configuration on the estate and the one every other
 *   entry here is measured against.
 * - `DIESEL_HYBRID` — no incomer. A battery carries the load and the genset runs
 *   in blocks to recharge it, near its efficient loading rather than idling at
 *   the 4 kW a tower draws. Fewer engine hours, less diesel, same supply.
 * - `SOLAR_HYBRID` — no incomer. Solar carries the day and charges the battery,
 *   the battery carries the night, and the genset is the backstop for a run of
 *   dull days. The genset is still fitted, which is the point: this is a hybrid,
 *   not an off-grid solar site.
 *
 * ## This is a display choice, and only a display choice
 *
 * It selects a **layout**: which sources the single-line diagram draws above the
 * bus. It does not configure a machine, does not command anything, and nothing
 * about how a genset behaves depends on it — `isolatorStateOf` below, the
 * changeover, `defaultDutyId` and every control pad are all untouched by it.
 *
 * That boundary is deliberate rather than a shortcut. A control that both redrew
 * a diagram *and* silently changed which sets could take load would be two
 * operations wearing one label, and the second of them would be a command this
 * prototype has no business issuing.
 *
 * One visible consequence of holding that line: a set's activity feed is the
 * *machine's* history, so at a site declared `SOLAR_HYBRID` it may still read
 * "Engine started on utility outage". The setting redraws the site; it does not
 * rewrite what the controllers did.
 */
export const SITE_POWER_ROLES = [
  'GRID_BACKUP',
  'DIESEL_PRIME',
  'DIESEL_HYBRID',
  'SOLAR_HYBRID',
] as const;

export type SitePowerRole = (typeof SITE_POWER_ROLES)[number];

/**
 * Is there a utility incomer at this site.
 *
 * One predicate rather than `role === 'GRID_BACKUP'` at each call site, because
 * the question every caller is actually asking is "is there a grid here", and
 * writing it as an equality invites the next configuration to be added by
 * forgetting one of them. Three of the four have no incomer, and the day a
 * grid-tied hybrid joins the list this is the only line that changes.
 */
export const hasMains = (role: SitePowerRole): boolean => role === 'GRID_BACKUP';

/** Is a battery fitted — the two hybrid configurations, and only those. */
export const hasBattery = (role: SitePowerRole): boolean =>
  role === 'DIESEL_HYBRID' || role === 'SOLAR_HYBRID';

/** Is a PV array fitted. */
export const hasSolar = (role: SitePowerRole): boolean => role === 'SOLAR_HYBRID';

/** Is this one of the two configurations the energy screen has anything to say about. */
export const isHybrid = (role: SitePowerRole): boolean => hasBattery(role);

/** How the configuration is written in a heading or a chip. */
export const SITE_POWER_ROLE_LABEL: Record<SitePowerRole, string> = {
  GRID_BACKUP: 'Grid + genset',
  DIESEL_PRIME: 'Diesel prime',
  DIESEL_HYBRID: 'Diesel hybrid',
  SOLAR_HYBRID: 'Solar hybrid',
};

/**
 * The mains incomer, as its meter reports it.
 *
 * A **measurement**, not an inference. An earlier sketch of this derived mains
 * health from the gensets — "a set is running, so the grid must be down" — and it
 * was wrong for the one case that matters most: a set on a **test exercise** runs
 * beside a perfectly healthy grid, and inferring a failure from it would report an
 * outage at a site that never had one.
 *
 * So the site reads its intake meter, and the meter is what says whether the
 * supply is there. In this prototype that reading is mock data like every other
 * figure (see `data/sites.ts`); in a real deployment it is the meter's API, and
 * nothing downstream of this type changes.
 */
export type MainsSupply = {
  /**
   * Is the incomer energised.
   *
   * **Always known, meter or no meter** — this comes from the transfer switch, which
   * senses voltage on the incomer because that is how it decides to transfer at all.
   * Presence and consumption are separate instruments, and conflating them would make
   * an unmetered site look like a site with no grid.
   */
  live: boolean;
  /**
   * What is flowing through the incomer — **only if somebody fitted a meter to it.**
   *
   * See `MeterFeed`: the figure, or which of the two reasons there isn't one. This
   * used to be a bare number every site carried, which quietly claimed instrumentation
   * most of them have never had.
   */
  feed: MeterFeed;
};

export type Site = {
  /** e.g. `wpkl-0207`. Matches `Genset.siteId`. */
  id: string;
  /** e.g. `WPKL-0207` — the label the design puts in the header. */
  name: string;
  kind: SiteKind;
  /** Shared by every genset here, because they stand in the same yard. */
  locationLabel: string;
  /** The yard's own position, seeded — see `siteSeed.ts`. */
  latitude: number;
  longitude: number;
  /**
   * What the customer draws, kW.
   *
   * The physical quantity, which exists whether or not anybody measures it. A meter
   * is what makes it *visible* — see `MeterFeed` — so this is carried separately from
   * the readings, and fitting or removing a meter never changes it.
   */
  loadKw: number;
  /**
   * Whose yard this is — see `data/customers.ts`.
   *
   * On the site and not on the genset, which is what makes "how many sets in Sarawak"
   * answerable without a machine having to carry an owner around with it.
   *
   * The **power role is deliberately not here.** Every other field on this object is
   * something the page *reports*; the role selects which circuit the page **draws**,
   * and the components that draw it take it as a prop so `SiteDiagram` can stay a
   * pure function of `(summary, dutyId, role)` — which is what lets the settings tab
   * render the same circuit twice, one role each, as a preview. It is read live
   * through `siteConfig.ts`. See `SitePowerRole`.
   */
  customer: CustomerId;
  /**
   * The rollout programme this site is filed under, or `undefined` for none.
   *
   * A **grouping and nothing else** — no figure on any screen derives from it. It
   * is here rather than beside the power role in the config store for the reason
   * `customer` is: it is a fact the summary *reports*, and every screen that groups
   * sites needs it from the same pass that gave it the region. See `programs.ts`
   * for why it is a separate axis from the region rather than a second name for it.
   */
  program: ProgramId | undefined;
};

/**
 * How the changeover at this site is standing, per genset.
 *
 * `closed` is the isolator: whether this set is *connected* to the site bus.
 * `live` is whether it is pushing power through it. The two are separate because
 * a set can be closed onto a dead bus (connected, not turning) but never live
 * while open — which is exactly the invariant `switchStateOf` below encodes.
 */
export type SwitchState = {
  closed: boolean;
  live: boolean;
};

/**
 * Where a set's isolator stands, given its run state and whether it is the site's
 * **duty set** — the one the changeover has selected to carry the load.
 *
 * A site has one load and one changeover, so **exactly one set is connected to the
 * bus at a time.** That is what the design's frame draws — one closed isolator, one
 * open — and treating it as the rule rather than a coincidence is what makes the
 * two-set page mean something: the standby set is not idly waiting *in parallel*,
 * it is isolated, and transferring the load to it is a deliberate operation.
 *
 * So being duty is necessary to be connected, and the run state decides the rest:
 *
 * - duty + `RUNNING` → closed and live: this is the set feeding the load.
 * - duty + `IDLE` → closed and dead: made up on a dead bus, which is what lets the
 *   controller pick up a mains failure in ten seconds rather than after somebody
 *   drives out.
 * - duty + `OFFLINE` → open. A set we cannot hear from must be drawn as *not*
 *   contributing — assuming a silent machine is carrying load is the one error on
 *   this page that could get somebody hurt.
 * - not duty → open, whatever it is doing. A set can be turning while isolated (on
 *   test, or warming), and it is off-load while it is.
 */
export const isolatorStateOf = (runState: RunState, duty: boolean): SwitchState => {
  if (!duty) return {closed: false, live: false};

  return {
    closed: runState === 'RUNNING' || runState === 'IDLE',
    live: runState === 'RUNNING',
  };
};

/**
 * Where the **mains contactor** stands: the grid half of the transfer switch.
 *
 * Derived, never selected. The changeover control on the site page picks between
 * *gensets*, and adding the grid to it would dress a utility supply up as
 * something an operator here can switch on. A transfer switch acts on its own, so
 * this reads the two facts it acts on — the meter, and whether a set is already
 * carrying — and reports the position that follows.
 *
 * `closed` and `live` are the same value here, which they are *not* for a genset
 * isolator, and the asymmetry is the point: a genset can sit closed onto a dead
 * bus waiting for a mains failure, but the grid is either carrying the load or
 * disconnected from it. A transfer switch must never bridge the two sources — that
 * is back-feed onto the utility, the one thing the interlock exists to prevent — so
 * there is no closed-and-dead mains position to draw.
 *
 * A set that is carrying therefore *wins*: the contactor is open, and the meter's
 * verdict on the grid is reported next to it rather than in place of it. That is
 * what separates the two cases this whole type exists for — a genset carrying
 * because the grid **failed**, and a genset carrying while the grid is **healthy**,
 * which is a test run and not an incident.
 */
export const mainsContactorStateOf = (mains: MainsSupply, gensetCarrying: boolean): SwitchState => {
  const carrying = mains.live && !gensetCarrying;
  return {closed: carrying, live: carrying};
};

/**
 * Can the changeover hand the load to this set?
 *
 * Only to a set that is already turning. Transferring to a stopped one means
 * *starting* it first, which is a `START` command — and those are inert in this
 * prototype and say so. Transferring to an unreachable set is not an operation at
 * all.
 */
export const canTakeLoad = (runState: RunState): boolean => runState === 'RUNNING';
