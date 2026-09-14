import {useSyncExternalStore} from 'react';

import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {RUN_STATES} from '@/modules/genset/types/genset.type';
import type {Genset} from '@/modules/genset/types/genset.type';
import {fleet, subscribeFleet} from '@/modules/genset/data/deployment';
import {gensetDetail} from '@/modules/genset/data/detail';
import type {GensetDetail} from '@/modules/genset/data/detail';
import {spreadBetween} from '@/modules/genset/data/spread';
import {hasBattery, hasMains} from '../types/site.type';
import type {MainsSupply, Site, SitePowerRole} from '../types/site.type';
import {hybridState} from './hybrid';
import {alarmRank, alarmRankCount} from './siteAlarmQueue';
import {SITE_KIND_LABEL, siteSeed, siteSeeds} from './siteSeed';
import {subscribeSiteOverrides} from './siteOverrides';
import type {SiteSeed} from './siteSeed';

/**
 * Everything the site pages report, derived from the fleet standing on each site.
 *
 * Same rule as `genset/data/detail.ts`: **nothing is stated twice.** A site's own
 * givens live in `siteSeed.ts` — its name, what kind of load it carries, where the
 * yard is and what the customer draws, none of which can be inferred from a diesel
 * engine — and every other number here is summed or ranked from the gensets that
 * name it. There is no stored site fuel figure to drift out of step with the machines.
 *
 * What a site **no longer** states is a verdict on itself. The `condition` field —
 * `Critical` / `Attention` / `Optimum`, ranked from the gensets — came off on
 * 2026-09-14; the estate now shows the alarm queue itself. See the note where it
 * stood, in `buildSummary`.
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
  /** Attention-ordered, so a turning set leads the page. */
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
  /**
   * What the incomer reads.
   *
   * On the summary rather than in the config store beside `powerRole`, because the
   * two are different kinds of thing: this is a **reading**, fixed mock data like a
   * tank level, and the role is a **display choice** a reader can flip at any
   * moment. Every site therefore carries a reading, including one declared
   * `DIESEL_PRIME` — where it simply goes undrawn, which is what lets the settings page
   * preview the standby layout without inventing a figure for it.
   */
  mains: MainsSupply;
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
 * at a `DIESEL_PRIME` site, nothing is generating; at a `GRID_BACKUP` site, the grid is down
 * *and* no set has picked the load up. Both are outages. Callers get to say so in
 * their own words; this only reports that nobody is feeding.
 */
export type SiteFeed =
  | {source: 'GENSET'; gensetId: string}
  | {source: 'MAINS'}
  /** The array is making more than the tower draws — it is carrying, and charging. */
  | {source: 'SOLAR'}
  /** The bank is carrying: night at a solar site, between blocks at a diesel one. */
  | {source: 'BATTERY'}
  | {source: 'NONE'};

export const siteFeed = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): SiteFeed => {
  if (siteDrawKw(summary, dutyId) !== null && dutyId !== undefined) {
    return {source: 'GENSET', gensetId: dutyId};
  }

  // Note what is *not* asked here: how much the incomer is carrying. Whether the
  // grid is up and how much is flowing through it are separate facts, and an earlier
  // version that required a figure here reported an unserved site whenever it had
  // none.
  //
  // A site with no incomer has no grid to fall back to, which is the whole of what
  // `hasMains` changes.
  if (hasMains(role) && summary.mains.live) return {source: 'MAINS'};

  // Then the hybrid plant, in the order it actually takes precedence: an array
  // making more than the tower draws is carrying it and charging with the rest,
  // and otherwise the bank is. Both sit *below* the genset above, which is the
  // right way round rather than a preference — a set that has been given the load
  // has it, and a controller that let the bank fight a running genset for the bus
  // would be a fault, not a strategy.
  //
  // The bank is treated as always able to carry. This prototype has no state of
  // charge history, so a flat bank is a state it cannot reach or represent, and
  // claiming an outage the model has no evidence for would be worse than the
  // simplification.
  if (hasBattery(role)) {
    const seed = siteSeed(summary.site.id);
    if (seed !== undefined) {
      const state = hybridState(seed, role);
      return state.solarKw > summary.site.loadKw ? {source: 'SOLAR'} : {source: 'BATTERY'};
    }
  }

  return {source: 'NONE'};
};

/**
 * What the load is drawing, or `null` when nothing is feeding it.
 *
 * Deliberately separate from `siteFeed` above, because **who is supplying the load
 * and how much it is drawing are two different questions**, and a page can want one
 * without the other. Folding them together is what produced the bug this split
 * fixes: a site read as though nothing were feeding it whenever no figure could be
 * quoted for it.
 *
 * The duty set's own controller answers it while a set is carrying. Otherwise the
 * site's seeded load stands, because whatever is carrying — the grid, or a hybrid
 * site's converter — is carrying exactly that. Only an unfed load has no figure, and
 * the page says so rather than printing a zero.
 */
export const siteLoadKw = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): number | null => {
  const feed = siteFeed(summary, dutyId, role);
  if (feed.source === 'GENSET') return siteDrawKw(summary, dutyId);
  if (feed.source === 'NONE') return null;
  return summary.site.loadKw;
};

/**
 * The DC plant's output, as NetEco reports it: what the bus is holding, and what
 * the load is pulling out of it.
 *
 * These are two of the three site-level essentials — the third is who is feeding,
 * which `siteFeed` already answers. They ride *with* the draw rather than beside
 * it because they are the same measurement written three ways: a tower's DC plant
 * has one bus, and `P = V x I` on it. Deriving the current rather than seeding it
 * is what guarantees a reader who multiplies the bracket gets the kilowatts back.
 *
 * ## Why the voltage moves, and what moves it
 *
 * A -48 V plant is not at 48 V. Rectifiers hold the bus at **float**, a shade over
 * 53 V, whenever anything is driving them — mains, a genset, or a hybrid site's
 * converter with the array behind it. The per-site offset is a fraction of a volt
 * either way: real plants are commissioned individually and an estate of
 * twenty-five identical readings is the tell of a number nobody measured.
 *
 * The bank is the one supply that does not hold a bus. On battery the plant is
 * *unpowered* and the load is riding the pack straight, so the bus is the pack's
 * terminal voltage and it sags as the charge goes — which is why this reads off
 * `hybridState`'s `soc` rather than off a constant. It is the same state of charge
 * the diagram and the strip already draw, so a bus at 50 V and a bank at 42%
 * cannot disagree.
 *
 * `null` where `siteLoadKw` is `null`, and for the same reason: an unfed load has
 * no current to report, and a plant nobody is driving has no output voltage. That
 * is an outage, not a zero.
 *
 * ## The simplification, stated
 *
 * The whole of the site's load is put on the DC bus. At a macro or rural site that
 * is very nearly true — the radio is the load, and what isn't DC is a fan. At a
 * switching centre it is not: a few hundred kilowatts of that is chillers on the
 * AC side, so the current here reads high for a single plant. Splitting it would
 * mean seeding a DC share per site kind, and the cost of that is the property this
 * bracket is worth having for — that `volts x amps` comes back to the kilowatts
 * printed beside it. A reader who checks the arithmetic should not find it broken.
 * When a real NetEco feed lands, the DC load is its own measured quantity and this
 * derivation goes away rather than being corrected.
 */
export type SiteDcBus = {
  /** Bus voltage at the plant's output terminals, V. */
  volts: number;
  /** What the load is drawing off that bus, A. */
  amps: number;
};

/** Rectifier float, the bus voltage whenever anything is driving the plant. */
const FLOAT_V = 53.5;
/** Commissioning spread either side of float — see the note above. */
const FLOAT_SPREAD_V = 0.4;
/** The pack's terminal voltage at the ends of its window, carrying the load. */
const PACK_EMPTY_V = 47;
const PACK_FULL_V = 54;

const busVolts = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
  now: number,
): number => {
  const seed = siteSeed(summary.site.id);

  if (siteFeed(summary, dutyId, role).source === 'BATTERY' && seed !== undefined) {
    const {soc} = hybridState(seed, role, now);
    return Math.round((PACK_EMPTY_V + soc * (PACK_FULL_V - PACK_EMPTY_V)) * 10) / 10;
  }

  return (
    Math.round(
      spreadBetween(
        summary.site.id,
        'dc/float',
        FLOAT_V - FLOAT_SPREAD_V,
        FLOAT_V + FLOAT_SPREAD_V,
      ) * 10,
    ) / 10
  );
};

export const siteDcBus = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
  now: number = Date.now(),
): SiteDcBus | null => {
  const loadKw = siteLoadKw(summary, dutyId, role);
  if (loadKw === null) return null;

  const volts = busVolts(summary, dutyId, role, now);
  return {volts, amps: Math.round((loadKw * 1000) / volts)};
};

/**
 * The incomer, in place of the intake API this prototype doesn't have: whether it is
 * energised, and what it is carrying.
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
 * and the grid is back. `OFFLINE` does count: that set went out on an outage and
 * never came home, which is the worst state a standby site has.
 *
 * A second, independent mains flag was the obvious alternative and it is the wrong
 * shape. It could disagree with the activity feed, and the disagreement would land
 * on exactly the case this is here to get right: a set on a **test exercise**, which
 * has no outage behind it and therefore leaves the supply healthy. Two of the fleet's
 * sets are pinned that way, so the case is on screen rather than hypothetical.
 *
 * The figure beside it is the site's own seeded load, not a fraction of installed
 * genset capacity. Scaling off nameplate was a convenience that quietly made
 * consumption a function of the machinery parked outside, and it let one load carry
 * two numbers — `mfg-015` read 152 kW while its own genset reported carrying 175 kW.
 *
 * It is `0` while the supply is down, because the incomer then carries nothing. That
 * is a fact about the copper rather than a gap, which is why `live` and `kw` are two
 * fields: a dead incomer is still a known one.
 */
const mainsSupply = (seed: SiteSeed, members: Array<Genset>): MainsSupply => {
  // From the transfer switch — see `MainsSupply.live`. A yard's grid is dead exactly
  // when some set there is out on an unfinished outage run.
  const live = !members.some(
    (genset) => genset.startReason === 'OUTAGE' && genset.runState !== 'IDLE',
  );
  return {live, kw: live ? seed.loadKw : 0};
};

const stateRank = (genset: Genset) => RUN_STATES.indexOf(genset.runState);

const buildSummary = (seed: SiteSeed, all: Array<Genset>): SiteSummary => {
  const members: Array<Genset> = all
    .filter((genset) => genset.siteId === seed.id)
    // `RUN_STATES` is declared attention-first, so a turning set leads and the tag
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
      // Whose yard it is. Carried through from the seed rather than derived,
      // because there is nothing on a diesel engine that says "Sarawak".
      customer: seed.customer,
      // And which rollout filed it — a grouping the operator drew, so there is
      // nothing to derive it from at all. `undefined` at a site in no programme.
      program: seed.program,
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
    // **No condition verdict.** This object used to carry one — the worst of its
    // gensets' alarms, rolled up as `Critical` / `Attention` / `Optimum` — and it was
    // removed (Tristan, 2026-09-14) along with every chip that drew it. It ranked the
    // *engines* and nothing else, so a yard whose monitoring unit was asserting eleven
    // rows could report `Optimum` in the list while its own Alarms tab listed all
    // eleven. See `useEstateAlarmCounts` in `siteAlarmQueue.ts` for what replaced it
    // and why it is a count rather than a verdict.
    mains: mainsSupply(seed, members),
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
      seeds: ReadonlyArray<SiteSeed>;
      fleet: Array<Genset>;
      byId: Record<string, SiteSummary>;
      ordered: Array<SiteSummary>;
    }
  | undefined;

const summaries = () => {
  const currentSeeds = siteSeeds();
  const currentFleet = fleet();
  // Both inputs have to be in the key. A reader can rename a site, move its pin or
  // change its region from the Settings tab, so the *seeds* are no longer fixed for
  // the life of the process either. `siteSeeds()` is memoised on the override store,
  // so an untouched estate hands back the same array every time and this stays one
  // rebuild per change rather than one per read.
  if (cache?.seeds !== currentSeeds || cache.fleet !== currentFleet) {
    const byId = Object.fromEntries(
      currentSeeds.map((seed) => [seed.id, buildSummary(seed, currentFleet)]),
    );
    cache = {
      seeds: currentSeeds,
      fleet: currentFleet,
      byId,
      ordered: currentSeeds.map((seed) => byId[seed.id]),
    };
  }
  return cache;
};

/**
 * Subscribe to anything that changes a summary — the fleet's placement, or a
 * reader's edits to a site's own facts. Both feed `buildSummary`, so both have to
 * wake its readers.
 */
const subscribeSources = (listener: () => void) => {
  const unsubscribeFleet = subscribeFleet(listener);
  const unsubscribeOverrides = subscribeSiteOverrides(listener);
  return () => {
    unsubscribeFleet();
    unsubscribeOverrides();
  };
};

/** Every site, in seed order. Prefer `useSiteSummaries` inside a component. */
export const siteSummaries = (): Array<SiteSummary> => summaries().ordered;

/** One site. Prefer `useSiteSummary` inside a component. */
export const siteSummary = (siteId: string): SiteSummary | undefined => summaries().byId[siteId];

export const useSiteSummaries = (): Array<SiteSummary> =>
  useSyncExternalStore(subscribeSources, siteSummaries, siteSummaries);

export const useSiteSummary = (siteId: string): SiteSummary | undefined =>
  useSyncExternalStore(
    subscribeSources,
    () => siteSummary(siteId),
    () => siteSummary(siteId),
  );

/**
 * Sites in the order the list shows them: by what is standing, then by name.
 *
 * The ranking used to be the **condition verdict** and is now the **alarm queue** —
 * worst standing severity first, then how many rows are standing at it. That is the
 * same queue the row's pill draws and the same one the site's Alarms tab lists, so the
 * order and the figure beside it cannot tell a reader two different stories. See
 * `alarmRank` for why severity outranks volume.
 *
 * Name breaks the tie, so the order is total and the list does not reshuffle between
 * renders — and so the quiet foot of the list, where every site ranks the same, stays
 * put.
 *
 * **The counts are the caller's**, from `useEstateAlarmCounts`. They are live — a row
 * cleared on a site's tab re-ranks this list on the way back — and a sort that fetched
 * its own would be a second subscription reading a second moment.
 */
export const sortSites = (
  summaries: Array<SiteSummary>,
  counts: Record<string, Record<AlertSeverity, number>>,
): Array<SiteSummary> =>
  [...summaries].sort(
    (left, right) =>
      alarmRank(counts[left.site.id]) - alarmRank(counts[right.site.id]) ||
      alarmRankCount(counts[right.site.id]) - alarmRankCount(counts[left.site.id]) ||
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
