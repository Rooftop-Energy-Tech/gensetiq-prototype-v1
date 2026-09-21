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
 * Two configurations, because a genset fleet runs two: mains-backed and
 * genset-only. The estate this build serves is a *mobile* one — machines are
 * posted to a site for a period and collected again — so a site is a yard with
 * an engine standing in it, not a permanent plant with storage and an array.
 *
 * - `GRID_BACKUP` — there is a utility incomer, and a genset backs it up. The
 *   load normally sits on the grid; the set picks it up when the grid drops.
 *   Town and suburban sites.
 * - `DIESEL_PRIME` — no incomer. The genset *is* the supply and runs
 *   continuously. The configuration Express Mission's own fleet runs, and the
 *   one every remote posting lands in.
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
 * *machine's* history, so at a site declared `DIESEL_PRIME` it may still read
 * "Engine started on utility outage" from a posting at some earlier yard. The
 * setting redraws the site; it does not rewrite what the controllers did.
 */
export const SITE_POWER_ROLES = ['GRID_BACKUP', 'DIESEL_PRIME'] as const;

export type SitePowerRole = (typeof SITE_POWER_ROLES)[number];

/**
 * Is there a utility incomer at this site.
 *
 * One predicate rather than `role === 'GRID_BACKUP'` at each call site, because
 * the question every caller is actually asking is "is there a grid here", and
 * writing it as an equality invites the next configuration to be added by
 * forgetting one of them. The day a grid-tied arrangement joins the list this is
 * the only line that changes.
 */
export const hasMains = (role: SitePowerRole): boolean => role === 'GRID_BACKUP';

/** How the configuration is written in a heading or a chip. */
export const SITE_POWER_ROLE_LABEL: Record<SitePowerRole, string> = {
  GRID_BACKUP: 'Grid + genset',
  DIESEL_PRIME: 'Diesel prime',
};
/**
 * The mains incomer: whether it is live, and what is flowing through it.
 *
 * A **measurement**, not an inference. An earlier sketch of this derived mains
 * health from the gensets — "a set is running, so the grid must be down" — and it
 * was wrong for the one case that matters most: a set on a **test exercise** runs
 * beside a perfectly healthy grid, and inferring a failure from it would report an
 * outage at a site that never had one.
 *
 * In this prototype both figures are mock data like every other one (see
 * `data/sites.ts`); in a real deployment they come from the transfer switch and the
 * intake instrument, and nothing downstream of this type changes.
 */
export type MainsSupply = {
  /**
   * Is the incomer energised.
   *
   * This comes from the transfer switch, which senses voltage on the incomer because
   * that is how it decides to transfer at all — a separate fact from how much is
   * flowing, and the two are deliberately not folded together.
   */
  live: boolean;
  /**
   * What is flowing through the incomer, kW — `0` while a genset carries the load
   * and the mains contactor is open.
   */
  kw: number;
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
   * The physical quantity, which exists whether or not anybody is watching it, and
   * is therefore carried separately from anything an instrument reports.
   */
  loadKw: number;
  /**
   * Whose yard this is — see `data/customers.ts`.
   *
   * On the site and not on the genset, which is what makes "how many sets in Sarawak"
   * answerable without a machine having to carry an owner around with it.
   *
   * The **power role is deliberately not here.** Every other field on this object is
   * something the page *reports*; the role says how the yard is fed, which the supply
   * line and the alarm categories read off. The components that need it take it as a
   * prop rather than finding it on the summary, so each stays a pure function of what
   * it is handed. It is read live through `siteConfig.ts`. See `SitePowerRole`.
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
  /**
   * Open unless this set is actually carrying, and that is a change of rule.
   *
   * It used to draw the duty set **closed onto a dead bus** whenever it was stopped
   * but available — the classic standby position, a set sitting closed waiting for a
   * transfer. That is real behaviour at a grid-backed site and it was the wrong thing
   * to draw here, because the diagram's whole job is answering *what is feeding this
   * tower*: a reader looking at a solar hybrid on a sunny afternoon saw a closed knife
   * switch under a stopped engine and had to work out from the colour alone that no
   * diesel was involved. A switch is the one mark in the drawing whose shape a reader
   * takes in before any colour, and it was saying the opposite of the answer.
   *
   * So the position now follows the one fact the drawing is about: closed if this set
   * is carrying, open if it is not. The standby-closed state is not lost from the app —
   * the set's own run state is on its node's caption, its card and its page, in words
   * (`stopped`, `off-load`) that do not need decoding.
   */
  const carrying = duty && runState === 'RUNNING';
  return {closed: carrying, live: carrying};
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
 * `closed` and `live` are the same value here, and since `isolatorStateOf` took the
 * same rule they are the same value on every source the diagram draws. The reason was
 * always sharper for the grid: a transfer switch must never bridge two sources — that
 * is back-feed onto the utility, the one thing the interlock exists to prevent — so
 * there was never a closed-and-dead mains position to draw. `SwitchState` keeps the
 * two fields because they are two different facts and `Isolator` still renders all
 * three combinations; nothing currently produces the fourth.
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
