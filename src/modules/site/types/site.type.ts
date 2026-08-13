/**
 * A site is a **place with a load**, and gensets are what stand on it.
 *
 * That is the distinction the whole section rests on. A genset answers "what is
 * this machine doing"; a site answers "is this customer's power covered" — and
 * those are different questions the moment a site has more than one set, because
 * a site with two 1000 kVA units and one running is fully covered, while the same
 * site with both stopped is not, and neither fact is visible on either unit's own
 * page.
 *
 * A site therefore owns exactly two things of its own: an identity (its name, and
 * what kind of load it carries) and the changeover that decides which of its sets
 * feeds that load. Everything else it reports — draw, fuel, condition — is
 * summed or ranked from its gensets, never stored, so a site cannot disagree with
 * the machines standing on it.
 */

import type {RunState} from '@/modules/genset/types/genset.type';

/**
 * What the site's load actually is.
 *
 * Not decoration: it is the reason the site tolerates an outage or doesn't. A
 * hospital and a retail unit with identical hardware are not equally covered by
 * one working genset, and the kind is the only thing on the page that says so.
 */
export const SITE_KINDS = ['TELCO', 'DATA', 'HOSPITAL', 'MANUFACTURING', 'RETAIL', 'PORT', 'AIRPORT', 'TOWER'] as const;

export type SiteKind = (typeof SITE_KINDS)[number];

export type Site = {
  /** e.g. `telco-001`. Matches `Genset.siteId`. */
  id: string;
  /** e.g. `Telco-001` — the label the design puts in the header. */
  name: string;
  kind: SiteKind;
  /** Shared by every genset here, because they stand in the same yard. */
  locationLabel: string;
  /** The yard's centre — the mean of its gensets' own positions. */
  latitude: number;
  longitude: number;
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
 * Can the changeover hand the load to this set?
 *
 * Only to a set that is already turning. Transferring to a stopped one means
 * *starting* it first, which is a `START` command — and those are inert in this
 * prototype and say so. Transferring to a faulted or unreachable set is not an
 * operation at all.
 */
export const canTakeLoad = (runState: RunState): boolean => runState === 'RUNNING';
