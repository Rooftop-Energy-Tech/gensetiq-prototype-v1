import {MALAYSIA_STATE_IDS, malaysiaStateAt, malaysiaStateName} from '@/lib/geo/malaysiaStates';

import type {Genset} from '../types/genset.type';

/**
 * Which Malaysian state a genset is standing in — read off where it is, not stored.
 *
 * The same point-in-polygon the map's state hover counts with, so the register's
 * `State` column and the number on the hover card cannot disagree about a machine.
 * A seeded field would be a second answer to a question the coordinates already
 * settle, and it would go stale the moment a job moved the set to another yard.
 *
 * `locationLabel` is not the answer either: it is a placename somebody typed, and
 * half of them name a town rather than a state (`Sepanggar, Kota Kinabalu`).
 *
 * Memoised on the coordinates, because the sort asks this once per comparison and
 * the test walks every state's rings. A moved set has new coordinates and a new key.
 */
const cache = new Map<string, string | undefined>();

const stateIdAt = (longitude: number, latitude: number): string | undefined => {
  const key = `${longitude},${latitude}`;
  if (!cache.has(key)) cache.set(key, malaysiaStateAt(longitude, latitude));
  return cache.get(key);
};

/**
 * The state a point stands in, by display name, or `undefined` offshore. Shared with
 * the deployments register, whose yards are placed by the same polygons.
 */
export const stateNameAt = (longitude: number, latitude: number): string | undefined => {
  const id = stateIdAt(longitude, latitude);
  return id === undefined ? undefined : malaysiaStateName(id);
};

/** The state's display name — `Pulau Pinang`, the map's own — or `undefined` offshore. */
export const gensetStateName = (genset: Genset): string | undefined =>
  stateNameAt(genset.longitude, genset.latitude);

/**
 * The state as it stands in a URL — `pulau-pinang`, `kuala-lumpur` — for the
 * register's State filter.
 *
 * A slug of the display name rather than the ISO code (`MY-07`), so a filtered link
 * reads as what it filters by. The name is the map's and never changes, so neither
 * does the slug.
 */
export const stateSlug = (name: string): string => name.toLowerCase().replace(/\s+/g, '-');

/** A genset's state, as `stateSlug` writes it, or `undefined` offshore. */
export const gensetStateSlug = (genset: Genset): string | undefined => {
  const name = gensetStateName(genset);
  return name === undefined ? undefined : stateSlug(name);
};

/** Back from a slug to the display name — `pulau-pinang` to `Pulau Pinang` — or `undefined`. */
export const stateNameFromSlug = (slug: string): string | undefined =>
  MALAYSIA_STATE_IDS.map(malaysiaStateName).find(
    (name): name is string => name !== undefined && stateSlug(name) === slug,
  );
