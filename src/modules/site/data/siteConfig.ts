import {useSyncExternalStore} from 'react';

import type {SitePowerRole} from '../types/site.type';
import {SITE_SEED, siteSeed} from './siteSeed';

/**
 * How each site says it is fed — the one setting the site's Settings tab edits.
 *
 * ## Why this is not in `sites.ts`
 *
 * Everything in `sites.ts` is either a seeded given or derived from one, and it is
 * all built **once at module load** so two sites cannot report figures from
 * different moments. This is neither: it is a choice a reader makes while the app
 * is running, and it has to survive them walking from Settings back to Home to see
 * what it did.
 *
 * So it is a store, and it is deliberately the smallest one that works. There is no
 * backend behind this prototype, which is why `modules/auth/session.ts` is the shape
 * copied here — `useSyncExternalStore` over `localStorage`, with the read guarded
 * because Safari in private mode *throws* on access rather than returning null,
 * which would take the app down at import time.
 *
 * ## Why only overrides are stored
 *
 * Every site defaults to `STANDBY`, which is what the whole app assumed before this
 * setting existed — so a fresh browser renders exactly the screens the design was
 * drawn against, and clearing site data restores them. Only sites a reader has
 * actually changed take up a key, which also means adding a site to `SITE_SEED`
 * needs no migration here.
 *
 * ## What it is worth, and what it isn't
 *
 * It is a browser-local prototype affordance. It does not sync, a colleague opening
 * the same site sees the default, and — the important one — **it configures nothing.**
 * It selects which circuit the site page draws. See `SitePowerRole` for why that
 * line is drawn where it is.
 */

const STORAGE_KEY = 'gensetiq.siteConfig';

/**
 * What a site is until somebody says otherwise: **whatever its seed says.**
 *
 * This used to be the constant `STANDBY`, on the grounds that the fleet's own data
 * says standby throughout — every set's activity feed is written around utility
 * outages. That held while the role only chose which single-line diagram to draw.
 * It stopped holding when the fleet summary began counting by it: a blanket default
 * makes the estate look as though it contains no prime sites at all, which is a
 * stronger claim than "nobody has flipped one yet".
 *
 * So the default is per-site and lives in `siteSeed.ts` with the other facts about
 * the place, and the seam it opens is the one `SitePowerRole` already describes and
 * accepts: a set at a seeded-`PRIME` yard still logs "started on utility outage",
 * because that feed is the machine's history and this setting does not rewrite it.
 *
 * An id with no seed behind it falls back to `STANDBY` — the app's original
 * assumption, and the safe reading for a site we know nothing about.
 */
export const FALLBACK_POWER_ROLE: SitePowerRole = 'STANDBY';

export const seededPowerRole = (siteId: string): SitePowerRole =>
  siteSeed(siteId)?.powerRole ?? FALLBACK_POWER_ROLE;

type Overrides = Record<string, SitePowerRole>;

const listeners = new Set<() => void>();

const read = (): Overrides => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as Overrides);
  } catch {
    // Private mode, or a value some earlier version wrote in another shape. An
    // unreadable store is not worth taking the page down for — the defaults are
    // a complete, correct answer.
    return {};
  }
};

// `useSyncExternalStore` compares snapshots by identity, so the parsed object has
// to be memoised: a fresh `JSON.parse` on every call is an infinite render loop.
let snapshot: Overrides = read();

const emit = () => {
  snapshot = read();
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The role outside a component — routes, loaders, `aria-label` builders. */
export const sitePowerRole = (siteId: string): SitePowerRole =>
  snapshot[siteId] ?? seededPowerRole(siteId);

export const setSitePowerRole = (siteId: string, role: SitePowerRole) => {
  // Back to the default means *no* override, not an override that happens to equal
  // it. Otherwise the store slowly fills with entries that say nothing, and
  // "has this site been configured" stops being answerable.
  const next: Overrides = {...snapshot};
  if (role === seededPowerRole(siteId)) delete next[siteId];
  else next[siteId] = role;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — the choice just won't survive a reload. */
  }
  emit();
};

/**
 * The role, live.
 *
 * Selects a string rather than handing back the overrides object, so a component
 * watching one site does not re-render when another site's role changes. The server
 * snapshot is the default for the same reason the value falls back to it: there is
 * no `localStorage` during a render on the server, and the default is the honest
 * answer rather than a guess.
 */
export const useSitePowerRole = (siteId: string): SitePowerRole =>
  useSyncExternalStore(
    subscribe,
    () => snapshot[siteId] ?? seededPowerRole(siteId),
    () => seededPowerRole(siteId),
  );

/**
 * Every site's effective role, live — what the summary cards count by.
 *
 * A whole map rather than `useSitePowerRole` in a loop, because the callers are
 * counting the *estate*: they need all seventeen answers from one moment, and a
 * hook cannot be called per row anyway.
 *
 * Memoised against the overrides snapshot's identity so the object is stable
 * between emits. `useSyncExternalStore` compares snapshots by identity, and a fresh
 * `Object.fromEntries` on every call is an infinite render loop — the same trap
 * `snapshot` itself is memoised against a few lines up.
 */
let rolesCache: {overrides: Overrides; roles: Record<string, SitePowerRole>} | null = null;

const allRoles = (overrides: Overrides): Record<string, SitePowerRole> => {
  if (rolesCache?.overrides !== overrides) {
    rolesCache = {
      overrides,
      roles: Object.fromEntries(
        SITE_SEED.map((seed) => [seed.id, overrides[seed.id] ?? seed.powerRole]),
      ),
    };
  }
  return rolesCache.roles;
};

const SERVER_OVERRIDES: Overrides = {};

export const useSitePowerRoles = (): Record<string, SitePowerRole> =>
  useSyncExternalStore(
    subscribe,
    () => allRoles(snapshot),
    () => allRoles(SERVER_OVERRIDES),
  );
