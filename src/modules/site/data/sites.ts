import {useSyncExternalStore} from 'react';

import type {GensetCondition} from '@/modules/genset/types/alert.type';
import {RUN_STATES} from '@/modules/genset/types/genset.type';
import type {Genset} from '@/modules/genset/types/genset.type';
import {fleet, subscribeFleet} from '@/modules/genset/data/deployment';
import {gensetDetail} from '@/modules/genset/data/detail';
import type {GensetDetail} from '@/modules/genset/data/detail';
import {gensetCondition} from '@/modules/genset/data/fuelIntegrity';
import {meterAt, meters, subscribeMeters} from '@/modules/meter/data/meters';
import {meteredKw} from '@/modules/meter/types/meter.type';
import type {MeterFeed, MeterPoint, PowerMeter} from '@/modules/meter/types/meter.type';
import type {MainsSupply, Site, SitePowerRole} from '../types/site.type';
import {SITE_KIND_LABEL, SITE_SEED} from './siteSeed';
import type {SiteSeed} from './siteSeed';

/**
 * Everything the site pages report, derived from the fleet standing on each site.
 *
 * Same rule as `genset/data/detail.ts`: **nothing is stated twice.** A site's own
 * givens live in `siteSeed.ts` — its name, what kind of load it carries, where the
 * yard is and what the customer draws, none of which can be inferred from a diesel
 * engine — and every other number here is summed or ranked from the gensets that
 * name it. There is no stored site fuel figure or site condition to drift out of step
 * with the machines.
 *
 * The membership direction matters too. Sites do not list their gensets; gensets
 * name their site, and this file groups them. A site cannot therefore claim a unit
 * that doesn't exist, and no unit can be at two sites at once — both of which a
 * hand-maintained member list eventually gets wrong.
 *
 * The fleet it groups is the **deployed** one, from `deployment.ts`, not the raw
 * seed. That is the only line in the site module that membership reaches through,
 * which is why attaching and detaching gensets was affordable at all.
 */

export {SITE_KIND_LABEL, DEFAULT_SITE_ID, siteLabel} from './siteSeed';

/**
 * One genset at a site, with the half of its detail the site page needs.
 *
 * The full `GensetDetail` is carried rather than a reduction of it, because the
 * site page draws the genset's real run card and real control pad — the same
 * components its own home page uses. A summary struct here would mean maintaining
 * a second, thinner version of every figure those components already know how to
 * render.
 */
export type SiteGenset = {genset: Genset; detail: GensetDetail};

export type SiteSummary = {
  site: Site;
  /** Attention-ordered, so a faulted set leads the page. */
  gensets: Array<SiteGenset>;
  /**
   * Which set the changeover starts on — the one carrying the load, or the one
   * that would if the grid dropped now.
   *
   * A *default*, not a stored setting: the site page lets an operator transfer the
   * load, and that selection is component state. `undefined` at a site where
   * nothing here can take the load at all.
   */
  defaultDutyId: string | undefined;
  /** Nameplate across every set here, running or not. */
  ratedKw: number;
  runningCount: number;
  /** Sets we are hearing from. Not the same as running. */
  onlineCount: number;
  fuelLitres: number;
  fuelCapacityLitres: number;
  /** Worst condition among the sets — a site is as healthy as its sickest unit. */
  condition: GensetCondition;
  /**
   * What the intake meter reads.
   *
   * On the summary rather than in the config store beside `powerRole`, because the
   * two are different kinds of thing: the meter is a **reading**, fixed mock data
   * like a tank level, and the role is a **display choice** a reader can flip at
   * any moment. Every site therefore carries a reading, including one declared
   * `PRIME` — where it simply goes undrawn, which is what lets the settings page
   * preview the standby layout without inventing a figure for it.
   */
  mains: MainsSupply;
  /**
   * What a meter on the **outgoing feeder** reads — the customer's consumption,
   * whoever is supplying it.
   *
   * Separate from `mains.feed` because they are separate devices measuring separate
   * circuits, and the difference shows the moment a site transfers to diesel: mains
   * metering goes to nothing, load metering carries on. A site can have either, both
   * or neither.
   */
  loadFeed: MeterFeed;
};

/** The set the changeover currently has on the bus, if any. */
export const dutyMember = (
  summary: SiteSummary,
  dutyId: string | undefined,
): SiteGenset | undefined => summary.gensets.find(({genset}) => genset.id === dutyId);

/**
 * What the site is drawing, or `null` when nothing is feeding the load.
 *
 * The duty set's output, **not** the sum of every running set's. Only one set is
 * connected to the bus at a time, so a second set that happens to be turning is
 * off-load and contributes nothing to what the customer is drawing. Summing them
 * would report a figure no meter at this site could ever read.
 */
export const siteDrawKw = (
  summary: SiteSummary,
  dutyId: string | undefined,
): number | null => {
  const duty = dutyMember(summary, dutyId);
  return duty?.genset.runState === 'RUNNING' ? duty.detail.loadKw : null;
};

/**
 * What is actually feeding the load, and at what.
 *
 * One function rather than a `drawKw` figure plus an `onMains` boolean beside it,
 * because those two can be assembled into a state that cannot happen — on mains
 * *and* on generator — and every screen would have to re-derive which of them wins.
 * Here the winner is decided once.
 *
 * The genset wins, and that ordering is the transfer switch's own: a set that has
 * been given the load is carrying it, so the mains contactor is open (see
 * `mainsContactorStateOf`). The grid's health is then a separate fact reported
 * beside it, which is what keeps a **test run** from reading as an outage.
 *
 * `NONE` is a real state at both kinds of site and means different things at each —
 * at a `PRIME` site, nothing is generating; at a `STANDBY` site, the grid is down
 * *and* no set has picked the load up. Both are outages. Callers get to say so in
 * their own words; this only reports that nobody is feeding.
 */
export type SiteFeed =
  | {source: 'GENSET'; gensetId: string}
  | {source: 'MAINS'}
  | {source: 'NONE'};

export const siteFeed = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): SiteFeed => {
  if (siteDrawKw(summary, dutyId) !== null && dutyId !== undefined) {
    return {source: 'GENSET', gensetId: dutyId};
  }

  // Note what is *not* asked here: whether a meter is fitted. The grid carries the
  // load whether or not anybody measures it, and an earlier version of this required
  // a reading — which made every unmetered site report itself as unserved.
  //
  // A `PRIME` yard has no incomer to fall back to, which is the whole of what the
  // role changes.
  if (role === 'STANDBY' && summary.mains.live) return {source: 'MAINS'};

  return {source: 'NONE'};
};

/**
 * What the load is drawing, or `null` when nothing here can say.
 *
 * Deliberately separate from `siteFeed` above, because **who is supplying the load
 * and how much it is drawing are answered by different instruments**, and a site can
 * know one without the other. Folding them together is what produced the bug this
 * split fixes: an unmetered site read as though nothing were feeding it.
 *
 * Three sources, in order of how directly they measure the load:
 *
 *  1. **the load meter** — measures the load itself, whoever is supplying it. It is
 *     first because it is the only one that stays true across a changeover: transfer
 *     between two sets whose controllers report different outputs and the *load* has
 *     not changed, so quoting the meter keeps the figure still while the supply moves.
 *  2. **the carrying source** — a genset's own controller, or the mains meter while
 *     the grid carries. Both measure the same power one step upstream.
 *  3. nothing, and the page has to say so rather than print a zero.
 */
/**
 * How much power is actually flowing through one circuit, metered or not.
 *
 * This is the **physical** answer, which is why it returns a plain number and can
 * legitimately return zero: a mains incomer with the contactor open carries nothing,
 * and that is a fact about the copper rather than a gap in the instrumentation. What a
 * *reader* is shown still depends on whether a meter is there to see it — the meters
 * list applies that separately, which is exactly the separation this whole module is
 * about.
 */
export const circuitFlowKw = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
  point: MeterPoint,
): number => {
  const feed = siteFeed(summary, dutyId, role);
  if (point === 'MAINS') return feed.source === 'MAINS' ? summary.site.loadKw : 0;
  return feed.source === 'NONE' ? 0 : summary.site.loadKw;
};

export const siteLoadKw = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): number | null => {
  const metered = meteredKw(summary.loadFeed);
  if (metered !== null) return metered;

  const feed = siteFeed(summary, dutyId, role);
  if (feed.source === 'GENSET') return siteDrawKw(summary, dutyId);
  if (feed.source === 'MAINS') return meteredKw(summary.mains.feed);
  return null;
};

/**
 * The intake meter's reading, in place of the metering API this prototype doesn't
 * have.
 *
 * Same rule as everything else in this file: **derived from a given, not a second
 * given.** The given is each set's `startReason` in `fleet.ts`, and the derivation
 * is the one an operator would make in reverse — a set out on an outage *is* the
 * evidence the grid dropped:
 *
 *   the supply is dead ⟺ some set here is out on an unfinished outage run.
 *
 * "Unfinished" is why `IDLE` doesn't count. An idle set started on an outage too,
 * and then stopped — its own feed says "utility restored" — so its outage is over
 * and the grid is back. `FAULT` and `OFFLINE` do count: those sets went out on an
 * outage and never came home, which is the worst state a standby site has.
 *
 * A second, independent mains flag was the obvious alternative and it is the wrong
 * shape. It could disagree with the activity feed, and the disagreement would land
 * on exactly the case this is here to get right: a set on a **test exercise**, which
 * has no outage behind it and therefore leaves the meter healthy. Two of the fleet's
 * sets are pinned that way, so the case is on screen rather than hypothetical.
 *
 * The magnitude is a hash of the site id — never `Math.random()` — so a site reads
 * the same on every render and every reload, the convention `detail.ts` sets.
 */
/**
 * What a meter on this circuit would report — or why nothing does.
 *
 * The **load exists whether or not anybody measures it**, and that separation is the
 * point: `seed.loadKw` is the physical quantity, and the meter is only what makes it
 * visible. Fitting one does not change what the customer draws; removing one does not
 * either, it just stops the page being able to say.
 *
 * The figure itself is the site's own seeded load, not a fraction of installed genset
 * capacity. Scaling off nameplate was a convenience that quietly made consumption a
 * function of the machinery parked outside, and it let one load carry two numbers —
 * `mfg-015` metered 152 kW while its own genset reported carrying 175 kW.
 */
const feedAt = (seed: SiteSeed, all: Array<PowerMeter>, point: MeterPoint): MeterFeed => {
  const meter = meterAt(all, seed.id, point);
  if (meter === undefined) return {state: 'UNMETERED'};
  if (!meter.online) return {state: 'NOT_REPORTING'};
  return {state: 'METERED', kw: seed.loadKw};
};

const mainsSupply = (
  seed: SiteSeed,
  members: Array<Genset>,
  all: Array<PowerMeter>,
): MainsSupply => ({
  // From the transfer switch, not from a meter — see `MainsSupply.live`. A yard's
  // grid is dead exactly when some set there is out on an unfinished outage run.
  live: !members.some(
    (genset) => genset.startReason === 'OUTAGE' && genset.runState !== 'IDLE',
  ),
  feed: feedAt(seed, all, 'MAINS'),
});

const stateRank = (genset: Genset) => RUN_STATES.indexOf(genset.runState);

const buildSummary = (
  seed: SiteSeed,
  all: Array<Genset>,
  allMeters: Array<PowerMeter>,
): SiteSummary => {
  const members: Array<Genset> = all
    .filter((genset) => genset.siteId === seed.id)
    // `RUN_STATES` is declared worst-first, so a faulted set leads and the tag
    // breaks ties — the same order the fleet table uses, for the same reason.
    .sort((left, right) => stateRank(left) - stateRank(right) || left.tag.localeCompare(right.tag));

  const gensets: Array<SiteGenset> = members.flatMap((genset) => {
    const detail = gensetDetail(genset.id);
    return detail === undefined ? [] : [{genset, detail}];
  });

  const ratedKw = gensets.reduce((sum, {detail}) => sum + detail.ratedKw, 0);

  return {
    site: {
      id: seed.id,
      name: seed.name,
      kind: seed.kind,
      // The yard's own place, seeded — not the mean of whatever is standing in it.
      // See `siteSeed.ts` for why that inverted: a site has to know where it is
      // before a genset arrives, or deploying one has nowhere to send it.
      locationLabel: seed.locationLabel,
      latitude: seed.latitude,
      longitude: seed.longitude,
      loadKw: seed.loadKw,
    },
    gensets,
    // A running set if there is one — it is already carrying the load. Otherwise
    // the first set fit to pick it up, which is what "on standby" means. The
    // members are attention-ordered, so this is deterministic.
    defaultDutyId:
      members.find((genset) => genset.runState === 'RUNNING')?.id ??
      members.find((genset) => genset.runState === 'IDLE')?.id,
    ratedKw,
    runningCount: gensets.filter(({genset}) => genset.runState === 'RUNNING').length,
    onlineCount: gensets.filter(({genset}) => genset.runState !== 'OFFLINE').length,
    fuelLitres: members.reduce((sum, g) => sum + g.fuelLitres, 0),
    fuelCapacityLitres: members.reduce((sum, g) => sum + g.fuelCapacityLitres, 0),
    // Worst wins, on the severity ordering the alert module already defines.
    //
    // Read through `gensetCondition` rather than off the detail snapshot, so a
    // yard holding a set that is losing fuel is not reported as healthy. The
    // register map has no bit for a leak, and this roll-up is the whole reason
    // that gap could not be left at the genset page: a site's colour on the map
    // is how most readers meet the fault.
    condition: gensets.some(({genset}) => gensetCondition(genset.id) === 'CRITICAL')
      ? 'CRITICAL'
      : gensets.some(({genset}) => gensetCondition(genset.id) === 'ATTENTION')
        ? 'ATTENTION'
        : 'OPTIMUM',
    mains: mainsSupply(seed, members, allMeters),
    loadFeed: feedAt(seed, allMeters, 'LOAD'),
  };
};

/**
 * Every site, rebuilt whenever the fleet's placement changes — and only then.
 *
 * This used to be a module const, built once, and the reason given was that one pass
 * meant two sites could not report figures derived from different moments. That
 * reason survives intact: **`buildSummary` reads no clock.** Every time-bearing
 * figure it carries comes from `gensetDetail`, which is still built exactly once and
 * keyed by genset id, so re-grouping the fleet cannot shift a timestamp.
 *
 * What it can no longer be is *permanent*, because a set can now be attached and
 * detached and every figure here is summed from its members. So it is memoised on
 * the fleet array's identity instead: one rebuild per move, not one per read, and the
 * returned objects stay identity-stable in between — which is what `useSyncExternalStore`
 * needs and what keeps `SitesPage`'s `useMemo` honest.
 *
 * The rebuild is 17 sites over 24 gensets with no derivation heavier than a sum. It
 * is cheap because `detail.ts` and `history.ts` never look at where a machine is.
 */
let cache:
  | {
      fleet: Array<Genset>;
      meters: Array<PowerMeter>;
      byId: Record<string, SiteSummary>;
      ordered: Array<SiteSummary>;
    }
  | undefined;

const summaries = () => {
  const currentFleet = fleet();
  const currentMeters = meters();
  // Two inputs now, and both have to be in the key: fitting a meter changes what a
  // site can report without moving a single genset.
  if (cache?.fleet !== currentFleet || cache.meters !== currentMeters) {
    const byId = Object.fromEntries(
      SITE_SEED.map((seed) => [seed.id, buildSummary(seed, currentFleet, currentMeters)]),
    );
    cache = {
      fleet: currentFleet,
      meters: currentMeters,
      byId,
      ordered: SITE_SEED.map((seed) => byId[seed.id]),
    };
  }
  return cache;
};

/**
 * Subscribe to anything that changes a summary — the fleet's placement, or the
 * metering estate. Both feed `buildSummary`, so both have to wake its readers.
 */
const subscribeSources = (listener: () => void) => {
  const unsubscribeFleet = subscribeFleet(listener);
  const unsubscribeMeters = subscribeMeters(listener);
  return () => {
    unsubscribeFleet();
    unsubscribeMeters();
  };
};

/** Every site, in seed order. Prefer `useSiteSummaries` inside a component. */
export const siteSummaries = (): Array<SiteSummary> => summaries().ordered;

/** One site. Prefer `useSiteSummary` inside a component. */
export const siteSummary = (siteId: string): SiteSummary | undefined => summaries().byId[siteId];

export const useSiteSummaries = (): Array<SiteSummary> =>
  useSyncExternalStore(subscribeFleet, siteSummaries, siteSummaries);

export const useSiteSummary = (siteId: string): SiteSummary | undefined =>
  useSyncExternalStore(
    subscribeSources,
    () => siteSummary(siteId),
    () => siteSummary(siteId),
  );

/**
 * Sites in the order the list shows them: by how much is wrong, then by name.
 *
 * Condition is the ranking the list has, and it is the genset module's own —
 * worst severity among the sets standing here. Name breaks the tie so the order
 * is total and the list does not reshuffle between renders.
 */
const CONDITION_RANK: Record<GensetCondition, number> = {CRITICAL: 0, ATTENTION: 1, OPTIMUM: 2};

export const sortSites = (summaries: Array<SiteSummary>): Array<SiteSummary> =>
  [...summaries].sort(
    (left, right) =>
      CONDITION_RANK[left.condition] - CONDITION_RANK[right.condition] ||
      left.site.name.localeCompare(right.site.name),
  );

/**
 * Free-text filter for the sites list.
 *
 * Matches what the row actually shows — the site's name, its placename and its
 * kind — plus the asset tags standing on it, because "where is BRF9540" is the
 * question a fleet operator arrives with and the tag is not otherwise on screen.
 */
export const searchSites = (
  summaries: Array<SiteSummary>,
  query: string,
): Array<SiteSummary> => {
  const needle = query.trim().toLowerCase();
  if (!needle) return summaries;

  return summaries.filter((summary) =>
    [
      summary.site.name,
      summary.site.locationLabel,
      SITE_KIND_LABEL[summary.site.kind],
      ...summary.gensets.map(({genset}) => genset.tag),
    ].some((field) => field.toLowerCase().includes(needle)),
  );
};
