import {useSyncExternalStore} from 'react';

import {deployments, memberships, subscribeDeployments} from '@/modules/deployment/data/store';
import {deploymentState} from '@/modules/deployment/types/deployment.type';
import type {Deployment, DeploymentMembership} from '@/modules/deployment/types/deployment.type';
import {siteSeeds} from '@/modules/site/data/siteSeed';
import type {Genset} from '../types/genset.type';
import {GENSETS} from './fleet';
import {spreadBetween} from './spread';

/**
 * Where each genset is, derived from the job it is on.
 *
 * ## The direction this used to run, and why it was turned round
 *
 * Membership was held on the machine: `siteId` on the genset, with a
 * `gensetId → siteId` override store over it, and attaching a set to a site wrote
 * that map directly. Deployments were history somebody else had written, and the
 * store's own comment admitted the two could not be kept in step.
 *
 * It is the other way round now. **A machine is at a yard because a job put it
 * there**, so the job is the record a reader writes (see
 * `modules/deployment/data/store.ts`) and this module holds nothing of its own: it
 * reads the active membership and answers "where is this machine".
 *
 * The argument for holding placement on the machine still holds, and this satisfies
 * it: a machine has at most one active membership, so it cannot be claimed by two
 * yards or listed by none. The invariant moved from being a property of a map's
 * shape to being a rule the store enforces on every write.
 *
 * ## Deploying moves the machine; collecting does not
 *
 * A site is a customer's **yard**, not a folder. `fleet.ts` puts co-sited units
 * within a hundred metres of each other because that is what sharing a site means.
 * So a job going active is a lorry: its machines take the yard's placename and a
 * spot in it, and their pins move on the fleet map.
 *
 * **Collecting moves nothing.** The set leaves the job and reports no site, and it
 * is still standing in that yard until somebody comes for it. So `siteId` is derived
 * and the coordinates are **last known**: the yard of the most recent job the
 * machine actually stood on. Inventing a depot coordinate to move it to would be a
 * claim about the physical world this app has not earned.
 *
 * **A planned job moves nothing either**, which is the whole point of having that
 * state: the commitment is real and the lorry has not been called.
 *
 * Two words are in use for a machine with no active job, and it is worth knowing
 * before writing a third. The deployment layer and the site's Settings section call
 * it the **depot**; the fleet cards and their role filter call it **`Workshop`**.
 * They are the same absence of a job.
 *
 * Every figure a site reports is summed from its members, so all of them move when
 * this does. That rebuild is cheap for one specific reason: **`detail.ts` and
 * `history.ts` never look at where a machine is.** They key off genset id, so a
 * relocation cannot invalidate a single reading or run.
 */

/**
 * How far a deployed set sits from the middle of its yard, in degrees.
 *
 * `fleet.ts` puts co-sited units about 0.0008° apart — roughly ninety metres — so two
 * pins never stack on the map and the yard reads as a yard. A set arriving by this
 * route has to land in the same spread, and the offset is a hash of its id rather
 * than `Math.random()` so it stops in the same spot on every render and reload.
 */
const yardOffset = (gensetId: string): {lat: number; lon: number} => ({
  lat: spreadBetween(gensetId, 'yard-lat', -0.0008, 0.0008),
  lon: spreadBetween(gensetId, 'yard-lon', -0.0008, 0.0008),
});

type Placement = {
  /** The yard the machine is standing at now, or `null` in the depot. */
  siteId: string | null;
  /** The yard it was last on, which is where it physically is either way. */
  lastSiteId: string | null;
};

/**
 * Read the record once and work out, per machine, its active yard and its last one.
 *
 * One pass over the memberships rather than a lookup per genset: the fleet is 37
 * machines and the record is a few hundred rows, and this runs on every write.
 */
const placements = (
  allDeployments: Array<Deployment>,
  allMemberships: Array<DeploymentMembership>,
  now: number,
): Map<string, Placement> => {
  const byId = new Map(allDeployments.map((deployment) => [deployment.id, deployment]));
  const placement = new Map<string, Placement>();
  const lastStartedAt = new Map<string, string>();

  for (const membership of allMemberships) {
    const deployment = byId.get(membership.deploymentId);
    if (deployment === undefined) continue;

    const state = deploymentState(deployment, now);
    // A job that has not started is a commitment. It says nothing about where the
    // machine is standing today, so it is skipped entirely here.
    if (state === 'planned') continue;

    const held = placement.get(membership.gensetId) ?? {siteId: null, lastSiteId: null};

    if (state === 'active' && membership.collectedAt === null) {
      placement.set(membership.gensetId, {...held, siteId: deployment.siteId});
    }

    // The most recent job the machine actually stood on is where it physically is,
    // whether or not that job is over.
    const seen = lastStartedAt.get(membership.gensetId);
    if (seen === undefined || deployment.startsAt > seen) {
      lastStartedAt.set(membership.gensetId, deployment.startsAt);
      placement.set(membership.gensetId, {
        ...(placement.get(membership.gensetId) ?? held),
        lastSiteId: deployment.siteId,
      });
    }
  }

  return placement;
};

/**
 * The fleet with placement applied — the list every screen should read.
 *
 * `GENSETS` stays the untouched seed. This is a *view* of it, so clearing site data
 * returns the app to the fleet the design was built against, and nothing has to be
 * migrated when a seed changes.
 */
const applyPlacement = (now: number): Array<Genset> => {
  const placement = placements(deployments(), memberships(), now);
  const seedById = new Map(siteSeeds().map((site) => [site.id, site]));

  return GENSETS.map((genset) => {
    const placed = placement.get(genset.id);
    const siteId = placed?.siteId ?? null;
    const standingAt = placed?.lastSiteId ?? genset.siteId;
    const seed = standingAt === null ? undefined : seedById.get(standingAt);

    // No yard on the record at all: the seed's own position is the only thing known
    // about where this machine is, so it keeps it.
    if (seed === undefined) return {...genset, siteId};

    const offset = yardOffset(genset.id);
    return {
      ...genset,
      siteId,
      locationLabel: seed.locationLabel,
      latitude: seed.latitude + offset.lat,
      longitude: seed.longitude + offset.lon,
    };
  });
};

const listeners = new Set<() => void>();

/** Built on first read: see `deployment/data/seed.ts` for why nothing here is eager. */
let snapshot: Array<Genset> | undefined;

const current = (): Array<Genset> => (snapshot ??= applyPlacement(Date.now()));

const rebuild = () => {
  snapshot = applyPlacement(Date.now());
  for (const listener of listeners) listener();
};

// One subscription to the record for the whole fleet, set up at module load: the
// fleet is a pure function of the jobs, so there is nothing else to listen to.
subscribeDeployments(rebuild);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The current fleet, outside a component — loaders, `sites.ts`, anything deriving.
 *
 * The array identity is stable between changes, which is what lets `sites.ts` memoise
 * its summaries on it and what keeps `useSyncExternalStore` from looping.
 */
export const fleet = (): Array<Genset> => current();

/**
 * Subscribe to placement changes.
 *
 * Exported so `sites.ts` can hang its own store on this one. Site summaries are a
 * pure function of the fleet, so there is no second source to listen to — and giving
 * them their own listener set would mean two stores that have to be kept in step.
 */
export const subscribeFleet = (listener: () => void) => subscribe(listener);

/** The fleet, live. */
export const useFleet = (): Array<Genset> =>
  useSyncExternalStore(subscribe, current, current);

/**
 * The fleet row for an id.
 *
 * Reads the **deployed** fleet rather than the seed, so a set that has been put on a
 * job somewhere else reports the yard it is actually standing in. It lives here
 * rather than in `detail.ts` because that is a lookup over placement, and having it
 * there made a machine's detail depend on the deployment record it is measured
 * independently of.
 */
export const gensetById = (gensetId: string): Genset | undefined =>
  current().find((genset) => genset.id === gensetId);

/**
 * Re-read the clock and rebuild.
 *
 * The one thing a derived placement cannot do on its own is notice that a planned
 * job has started. Nothing polls for it, because a ticking clock would re-render
 * every screen to move one label, so a screen that wants today's answer asks for it
 * on mount and the reader sees the change on their next navigation.
 */
export const refreshPlacement = () => rebuild();
