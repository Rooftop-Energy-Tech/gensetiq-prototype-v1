import {DATASET} from '@/brands';
import {malaysiaStateName, MALAYSIA_STATE_IDS} from '@/lib/geo/malaysiaStates';
import {seededDeployments, seededMemberships} from '@/modules/deployment/data/seed';
import {GENSETS} from '@/modules/genset/data/fleet';
import {refuelsIn} from '@/modules/genset/data/history';
import {DEPOTS, depotFor, depotState} from './depots';
import {TRUCKS} from './trucks';

/**
 * Every fill a genset took, and **how it was filled** — at a depot's yard, or by a
 * truck at its posting.
 *
 * ## The rule
 *
 * Jeff's, 2026-09-29. A genset standing in a depot's own state is brought in to
 * that depot and filled from the bulk tank; one standing anywhere else is filled
 * by the truck that covers that state. Decided per fill, by where the machine was
 * posted **at that instant** — the fleet moves between jobs, and a set filled at
 * the Klang yard in August can be taking a truck in Seremban in September.
 *
 * A machine between postings is in a yard by definition, so it fills at the depot
 * nearest where it is kept.
 *
 * ## Where there are no trucks
 *
 * An estate with no trucks keeps the page's original rule exactly: every fill is a
 * yard fill, at the nearest depot to the machine. That is not a fallback for
 * missing data — it is what a customer without trucks does.
 *
 * ## Why the state comes from the label, not the coordinates
 *
 * The site's `locationLabel` names its state, and it is what the reader sees on
 * every row. The state polygons disagree with it at the edges: `Kepong, Kuala
 * Lumpur` sits a few hundred metres inside Selangor's outline. A row reading
 * *Kepong, Kuala Lumpur — at Klang depot* would contradict the rule on its own
 * face, so the label wins.
 */

export type FillRoute = {kind: 'yard'; depotId: string} | {kind: 'truck'; truckId: string};

export type GensetFill = {
  id: string;
  gensetId: string;
  at: number;
  /** What the genset's own level sensor saw arrive. */
  litres: number;
  /** Where the machine was posted at that instant, in words. */
  place: string;
  /** The state that posting stands in, or `undefined` between postings. */
  state: string | undefined;
  latitude: number;
  longitude: number;
  route: FillRoute;
};

const STATE_NAMES = new Set(
  MALAYSIA_STATE_IDS.map((id) => malaysiaStateName(id)).filter((name) => name !== undefined),
);

/** `Bangsar, Kuala Lumpur` → `Kuala Lumpur`; `Putrajaya` → `Putrajaya`. */
export const stateOfLabel = (label: string): string | undefined => {
  const tail = label.split(',').at(-1)?.trim() ?? '';
  return STATE_NAMES.has(tail) ? tail : undefined;
};

type Posting = {
  gensetId: string;
  startMs: number;
  endMs: number;
  place: string;
  state: string | undefined;
  latitude: number | undefined;
  longitude: number | undefined;
};

/** Every posting, flattened once. The per-fill lookup is then a scan of one machine's. */
const buildPostings = (): Map<string, Array<Posting>> => {
  const deployments = new Map(seededDeployments().map((d) => [d.id, d]));
  const sites = new Map(DATASET.sites.map((site) => [site.id, site]));
  const byGenset = new Map<string, Array<Posting>>();

  for (const member of seededMemberships()) {
    const deployment = deployments.get(member.deploymentId);
    if (deployment === undefined) continue;

    const site = sites.get(deployment.siteId);
    const posting: Posting = {
      gensetId: member.gensetId,
      startMs: new Date(deployment.startsAt).getTime(),
      endMs:
        deployment.endsAt === null
          ? Number.POSITIVE_INFINITY
          : new Date(deployment.endsAt).getTime(),
      place: deployment.locationLabel,
      // The site's label, not the deployment's: a real job's label is the PE's
      // name (`PE Tmn Sementa Jaya`), which carries no state.
      state: site === undefined ? undefined : stateOfLabel(site.locationLabel),
      latitude: site?.latitude,
      longitude: site?.longitude,
    };

    const held = byGenset.get(member.gensetId) ?? [];
    held.push(posting);
    byGenset.set(member.gensetId, held);
  }

  return byGenset;
};

const DEPOT_BY_STATE = new Map(DEPOTS.map((depot) => [depotState(depot), depot]));

/**
 * `kept` is where the seed keeps the machine, and it picks the nearest yard exactly
 * as the page always has; `latitude`/`longitude` are where it stood for this fill.
 */
const routeFor = (
  state: string | undefined,
  kept: {latitude: number; longitude: number},
  latitude: number,
  longitude: number,
): FillRoute => {
  const nearest = depotFor(kept.latitude, kept.longitude);

  if (TRUCKS.length === 0) return {kind: 'yard', depotId: nearest.id};

  // Between postings, or in a depot's own state: the machine comes to the yard.
  if (state === undefined) return {kind: 'yard', depotId: nearest.id};
  const home = DEPOT_BY_STATE.get(state);
  if (home !== undefined) return {kind: 'yard', depotId: home.id};

  // Anywhere else, a truck. The one whose area names this state; failing that, the
  // truck based at the nearest yard — a state no area lists is still somewhere a
  // truck has to drive to.
  const closest = depotFor(latitude, longitude);
  const covering =
    TRUCKS.find((truck) => truck.areaStates.includes(state)) ??
    TRUCKS.find((truck) => truck.homeDepotId === closest.id) ??
    TRUCKS[0];
  return {kind: 'truck', truckId: covering.id};
};

const buildFills = (): Array<GensetFill> => {
  const postings = buildPostings();
  const now = Date.now();
  const fills: Array<GensetFill> = [];

  for (const genset of GENSETS) {
    const own = postings.get(genset.id) ?? [];

    for (const refuel of refuelsIn(genset.id, 0, now)) {
      const posting = own.find((p) => refuel.at >= p.startMs && refuel.at <= p.endMs);
      const latitude = posting?.latitude ?? genset.latitude;
      const longitude = posting?.longitude ?? genset.longitude;
      const state = posting?.state;

      fills.push({
        id: `${genset.id}-${refuel.at}`,
        gensetId: genset.id,
        at: refuel.at,
        litres: refuel.litres,
        place: posting?.place ?? 'Between postings',
        state,
        latitude,
        longitude,
        route: routeFor(state, genset, latitude, longitude),
      });
    }
  }

  return fills.sort((a, b) => a.at - b.at);
};

let held: Array<GensetFill> | undefined;

/** Every fill in the record, oldest first. Dealt on first access. */
export const allFills = (): ReadonlyArray<GensetFill> => {
  held ??= buildFills();
  return held;
};

/** Fills at one depot's yard — the ones its bulk tank fell for directly. */
export const yardFills = (depotId: string): ReadonlyArray<GensetFill> =>
  allFills().filter((fill) => fill.route.kind === 'yard' && fill.route.depotId === depotId);

/** Fills one truck made. */
export const truckFills = (truckId: string): ReadonlyArray<GensetFill> =>
  allFills().filter((fill) => fill.route.kind === 'truck' && fill.route.truckId === truckId);
