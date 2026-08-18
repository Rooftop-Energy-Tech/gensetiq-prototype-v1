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
import type {CustomerId} from '../data/customers';

/**
 * What kind of network asset the injection point is.
 *
 * Not decoration: it is the reason the site tolerates an outage or doesn't. An
 * intake substation and a rural mini-grid with identical hardware are not
 * equally covered by one working genset, and the kind is the only thing on the
 * page that says so.
 */
export const SITE_KINDS = ['PMU', 'PPU', 'PE', 'FEEDER', 'MINI_GRID'] as const;

export type SiteKind = (typeof SITE_KINDS)[number];

/**
 * How this yard is fed — and therefore **which circuit the site page draws**.
 *
 * - `STANDBY` — there is a mains incomer, and the gensets back it up. The load
 *   normally sits on the grid; a set picks it up when the grid drops. Every site
 *   in this prototype is this, which is the assumption the whole app was written
 *   under before this setting existed.
 * - `PRIME` — there is no mains incomer. The gensets *are* the supply and carry
 *   the load continuously; a second set at a prime site is a spare, not a backup
 *   to something else.
 *
 * ## This is a display choice, and only a display choice
 *
 * It selects a **layout**: whether the single-line diagram includes a mains
 * source above the gensets. It does not configure a machine, does not command
 * anything, and nothing about how a genset behaves depends on it —
 * `isolatorStateOf` below, the changeover, `defaultDutyId` and every control pad
 * are all untouched by it.
 *
 * That boundary is deliberate rather than a shortcut. A control that both redrew
 * a diagram *and* silently changed which sets could take load would be two
 * operations wearing one label, and the second of them would be a command this
 * prototype has no business issuing.
 *
 * One visible consequence of holding that line: a set's activity feed is the
 * *machine's* history, so at a site declared `PRIME` it may still read "Engine
 * started on utility outage". The setting redraws the yard; it does not rewrite
 * what the controllers did.
 */
export const SITE_POWER_ROLES = ['STANDBY', 'PRIME'] as const;

export type SitePowerRole = (typeof SITE_POWER_ROLES)[number];

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
  /** e.g. `ppu-001`. Matches `Genset.siteId`. */
  id: string;
  /** e.g. `PPU-001` — the label the design puts in the header. */
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
   * On the site and not on the genset, which is what makes "how many sets at Maxis"
   * answerable without a machine having to carry an owner around with it.
   *
   * The **power role is deliberately not here.** It is seeded beside this one, but a
   * reader can flip it at any moment, so it is read live through
   * `siteConfig.ts` rather than baked into the summary a site was built with. A copy
   * on this object would be the stale one within a click.
   */
  customer: CustomerId;
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
 * - duty + `FAULT`/`OFFLINE` → open. A faulted set is isolated by the controller as
 *   part of shutting down, and a set we cannot hear from must be drawn as *not*
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
 * prototype and say so. Transferring to a faulted or unreachable set is not an
 * operation at all.
 */
export const canTakeLoad = (runState: RunState): boolean => runState === 'RUNNING';
