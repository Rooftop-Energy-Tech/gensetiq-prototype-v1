import {useSyncExternalStore} from 'react';

import type {SitePowerRole} from '../types/site.type';

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
 * What every site is until somebody says otherwise.
 *
 * `STANDBY` rather than a per-site seed, because the fleet's own data says standby
 * throughout: every set's activity feed is written around utility outages, and its
 * `startReason` is the given the intake meter reads. Defaulting a site to `PRIME`
 * would put a yard with no grid next to a genset whose log says it started when the
 * grid failed.
 */
export const DEFAULT_POWER_ROLE: SitePowerRole = 'STANDBY';

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
  snapshot[siteId] ?? DEFAULT_POWER_ROLE;

export const setSitePowerRole = (siteId: string, role: SitePowerRole) => {
  // Back to the default means *no* override, not an override that happens to equal
  // it. Otherwise the store slowly fills with entries that say nothing, and
  // "has this site been configured" stops being answerable.
  const next: Overrides = {...snapshot};
  if (role === DEFAULT_POWER_ROLE) delete next[siteId];
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
    () => snapshot[siteId] ?? DEFAULT_POWER_ROLE,
    () => DEFAULT_POWER_ROLE,
  );
