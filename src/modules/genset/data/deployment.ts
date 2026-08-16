import {useSyncExternalStore} from 'react';

import {SITE_SEED} from '@/modules/site/data/siteSeed';
import type {Genset} from '../types/genset.type';
import {GENSETS} from './fleet';
import {spreadBetween} from './spread';

/**
 * Which site each genset stands at, when it is not where `fleet.ts` seeded it.
 *
 * ## Why the override is on the genset
 *
 * Because `siteId` is. Membership has always been held on the machine and grouped by
 * the site module, and an override store keyed the other way — a member list per
 * site — would reintroduce exactly the failure that direction was chosen to prevent:
 * two sites both claiming the same set, or a set listed nowhere.
 *
 * ## Deploying moves the machine
 *
 * A site is a customer's **yard**, not a folder. `fleet.ts` says so directly: units
 * sharing a site "sit within a hundred metres or so of each other". So attaching a
 * set to a site is not an administrative act — it is a lorry, and the set's placename
 * and position become the site's.
 *
 * Without that the model falls apart immediately. Attach a Penang set to a Petaling
 * Jaya site and, back when a site's position was the mean of its members', the yard
 * moved into the Strait of Malacca. Now the yard is a fixed, seeded place and the
 * machine comes to it.
 *
 * **Detaching moves nothing.** The set is still standing in that yard until somebody
 * collects it; only the paperwork changed. Inventing a depot coordinate to move it to
 * would be a claim about the physical world this app has not earned.
 *
 * ## Same prototype caveats as the power role
 *
 * `localStorage`, overrides only, no backend, no sync — see `site/data/siteConfig.ts`
 * for the full argument, which applies here unchanged. A fresh browser gets the
 * seeded fleet, and clearing site data restores it.
 */

const STORAGE_KEY = 'gensetiq.deployment';

/** `gensetId → siteId`, or `null` for the depot. Only moved sets appear. */
type Placement = Record<string, string | null>;

const listeners = new Set<() => void>();

const read = (): Placement => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as Placement);
  } catch {
    // Private mode, or a value written in some earlier shape. The seeded fleet is a
    // complete, correct answer — not worth taking the page down for.
    return {};
  }
};

let placement: Placement = read();

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

/**
 * The fleet with placements applied — the list every screen should read.
 *
 * `GENSETS` stays the untouched seed. This is a *view* of it, so clearing the store
 * returns the app to the fleet the design was built against, and nothing has to be
 * migrated when a seed changes.
 *
 * Rebuilt only when the store changes, never per read: `detail.ts` and `history.ts`
 * key off genset **id** and never look at where a machine is, so a relocation cannot
 * invalidate a single reading or run — which is the whole reason this is cheap.
 */
const applyPlacement = (current: Placement): Array<Genset> =>
  GENSETS.map((genset) => {
    if (!(genset.id in current)) return genset;

    const siteId = current[genset.id];
    if (siteId === genset.siteId) return genset;

    const seed = siteId === null ? undefined : SITE_SEED.find((site) => site.id === siteId);

    // Detached, or sent to a site that no longer exists: the machine has not moved,
    // so only its membership changes.
    if (seed === undefined) return {...genset, siteId: null};

    const offset = yardOffset(genset.id);
    return {
      ...genset,
      siteId,
      locationLabel: seed.locationLabel,
      latitude: seed.latitude + offset.lat,
      longitude: seed.longitude + offset.lon,
    };
  });

let snapshot: Array<Genset> = applyPlacement(placement);

const emit = () => {
  placement = read();
  snapshot = applyPlacement(placement);
  for (const listener of listeners) listener();
};

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
export const fleet = (): Array<Genset> => snapshot;

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
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );

/**
 * Send a set to a site, or to the depot with `null`.
 *
 * One call covers attach, detach *and* transfer, because all three are the same
 * fact — where this machine is — written once. A separate `detach` would let a set
 * be removed from one site without being placed anywhere, which is a state the store
 * should not be able to hold halfway through.
 */
export const deployGenset = (gensetId: string, siteId: string | null) => {
  const seeded = GENSETS.find((genset) => genset.id === gensetId);
  if (seeded === undefined) return;

  const next: Placement = {...placement};
  // Back where it was seeded means *no* override, so the store holds only genuine
  // moves and "has this fleet been rearranged" stays answerable.
  if (siteId === seeded.siteId) delete next[gensetId];
  else next[gensetId] = siteId;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — the move just won't survive a reload. */
  }
  emit();
};

/** Sets owned but not deployed. The pool a site's attach picker draws from. */
export const depotGensets = (all: Array<Genset>): Array<Genset> =>
  all.filter((genset) => genset.siteId === null);
