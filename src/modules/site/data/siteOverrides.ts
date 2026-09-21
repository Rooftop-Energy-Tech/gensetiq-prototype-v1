import {useSyncExternalStore} from 'react';

import type {CustomerId, ProgramId} from '@/brands';
import type {SitePowerRole} from '../types/site.type';

/**
 * What a reader has changed about a site, and nothing else.
 *
 * ## Why there is a store here at all
 *
 * Everything in `siteSeed.ts` is a **given about a place** — where the yard is,
 * what it is called, whose region it sits in — and every figure in `sites.ts` is
 * derived from those givens in one pass, so two sites cannot report from different
 * moments. Neither of those can hold a value somebody types into a form while the
 * app is running, and neither should: a seed that a reader can edit is no longer a
 * seed.
 *
 * So the edits live here, as a patch over the seed, and `siteSeed.ts` applies them.
 * A reader walking Settings → Site sees the change without a reload, the map moves
 * the pin, the region chips re-count, and clearing site data puts every one of them
 * back.
 *
 * ## Why only the differences are stored
 *
 * A site with no entry here **is** its seed. That is what makes "has anybody
 * changed this site" answerable, what makes Reset a `delete` rather than a copy of
 * twenty-five defaults, and what means adding a site to a dataset needs no
 * migration in this file. A field set back to its seeded value drops out of the
 * patch entirely rather than sitting there saying nothing — see `setSiteOverrideField`.
 *
 * ## What it is worth, and what it isn't
 *
 * It is a browser-local prototype affordance, the same one `modules/auth/session.ts`
 * is: `useSyncExternalStore` over `localStorage`, with the read guarded because
 * Safari in private mode *throws* on access rather than returning null, which would
 * take the app down at import time. It does not sync, and a colleague opening the
 * same site sees the dataset's own values.
 *
 * ## Why this is separate from `siteConfig.ts`
 *
 * Because `siteSeed.ts` has to read it, and `siteConfig.ts` reads `siteSeed.ts` to
 * know what a site's default is. One module holding both would be a cycle. This one
 * imports no site data at all — it is a typed patch record over `localStorage` and
 * knows nothing about what the ids mean.
 */

/**
 * The fields a reader may change from the site's Settings tab.
 *
 * Deliberately the site's **identity and placement** and nothing derived. A reader
 * can say what this place is called, where it is, whose region and programme it is
 * in, and how it is fed. They cannot edit what the site *draws* or what is standing
 * on it — the first is a meter reading and the second is the fleet's business.
 *
 * `program: null` is a real value and is not the same as the key being absent:
 * absent means "not overridden, use the seed", and `null` means **the reader took
 * this site out of its programme**. Collapsing the two would make un-filing a
 * seeded site impossible.
 */
export type SiteOverride = {
  name?: string;
  latitude?: number;
  longitude?: number;
  customer?: CustomerId;
  powerRole?: SitePowerRole;
  program?: ProgramId | null;
};

export type SiteOverrides = Readonly<Record<string, SiteOverride>>;

/**
 * One key, and it is the one the power-role store already used.
 *
 * Kept rather than bumped so a reader who flipped a site to solar hybrid last week
 * still finds it that way — see `parseEntry` for the migration, which is one line
 * because the old shape was a strict subset of this one.
 */
const STORAGE_KEY = 'gensetiq.siteConfig';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * One stored entry, sanitised — and `undefined` for one that survives nothing.
 *
 * Every field is checked rather than trusted, because this is parsed JSON from a
 * store an earlier version of the app wrote and a reader's devtools can edit. The
 * failure that matters is `latitude: "3.1"`: a string flows through `sites.ts`
 * untouched and lands on MapLibre, which puts the pin nowhere and logs nothing
 * useful. Anything unrecognised is dropped, which falls back to the seed — the
 * complete, correct answer.
 *
 * **The old shape is a plain role string**, from when this store held only the
 * power configuration. It reads as `{powerRole}`, so an existing choice survives
 * the change rather than silently reverting.
 */
const parseEntry = (raw: unknown): SiteOverride | undefined => {
  if (typeof raw === 'string') return {powerRole: raw as SitePowerRole};
  if (typeof raw !== 'object' || raw === null) return undefined;

  const source = raw as Record<string, unknown>;
  const entry: SiteOverride = {};

  if (typeof source.name === 'string' && source.name.trim() !== '') entry.name = source.name;
  if (isFiniteNumber(source.latitude)) entry.latitude = source.latitude;
  if (isFiniteNumber(source.longitude)) entry.longitude = source.longitude;
  if (typeof source.customer === 'string') entry.customer = source.customer;
  if (typeof source.powerRole === 'string') entry.powerRole = source.powerRole as SitePowerRole;
  if (source.program === null || typeof source.program === 'string') {
    entry.program = source.program as ProgramId | null;
  }

  return Object.keys(entry).length === 0 ? undefined : entry;
};

const read = (): SiteOverrides => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};

    const next: Record<string, SiteOverride> = {};
    for (const [siteId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = parseEntry(value);
      if (entry !== undefined) next[siteId] = entry;
    }
    return next;
  } catch {
    // Private mode, or a value some earlier version wrote in a shape `parseEntry`
    // could not rescue. An unreadable store is not worth taking the page down for —
    // the dataset's own values are a complete answer.
    return {};
  }
};

const listeners = new Set<() => void>();

// `useSyncExternalStore` compares snapshots by identity, so the parsed object has
// to be memoised: a fresh `JSON.parse` on every call is an infinite render loop.
let snapshot: SiteOverrides = read();

const emit = () => {
  snapshot = read();
  for (const listener of listeners) listener();
};

export const subscribeSiteOverrides = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Every override, as one object. The identity is stable between writes. */
export const siteOverrides = (): SiteOverrides => snapshot;

/**
 * The answer for a site nobody has touched — **one shared object, not a fresh one.**
 *
 * `useSyncExternalStore` compares snapshots by identity, so `?? {}` here is an
 * infinite render loop: every read of an unedited site hands React an object it has
 * never seen, React re-renders, and the next read hands it another. It is the same
 * trap `snapshot` itself is memoised against a few lines up, and it fires on the
 * *unedited* case — which is every site until somebody types something, so it is
 * also the case least likely to be exercised while building the form.
 *
 * Frozen so the mistake cannot be made twice. Every writer below builds its entry
 * with `{...}` and would spread this rather than mutate it, but a `TypeError` at the
 * first attempt is a better teacher than a shared object that quietly becomes every
 * site's override.
 */
const NO_OVERRIDE: SiteOverride = Object.freeze({});

export const siteOverride = (siteId: string): SiteOverride => snapshot[siteId] ?? NO_OVERRIDE;

/** One site's, live. */
export const useSiteOverride = (siteId: string): SiteOverride =>
  useSyncExternalStore(subscribeSiteOverrides, () => siteOverride(siteId), () => NO_OVERRIDE);

const write = (next: Record<string, SiteOverride>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — the choice just won't survive a reload. */
  }
  emit();
};

/**
 * Set one field, or clear it when the value is the site's seeded one.
 *
 * `seeded` is passed in rather than looked up, because this module deliberately
 * knows nothing about the seed — see the note at the top on why the cycle is
 * broken here. The caller in `siteConfig.ts` has both halves.
 *
 * Writing a value back to its default means **no override**, not an override that
 * happens to equal it. Otherwise the store fills with entries that say nothing, the
 * "changed from the dataset" mark on the settings page lights up on a site nobody
 * has changed, and a later edit to the dataset silently fails to reach a reader who
 * once clicked the value it already had.
 */
export const setSiteOverrideField = <Field extends keyof SiteOverride>(
  siteId: string,
  field: Field,
  value: NonNullable<SiteOverride[Field]> | null,
  seeded: SiteOverride[Field],
): void => {
  const entry: SiteOverride = {...(snapshot[siteId] ?? {})};

  if (value === seeded || (value === null && seeded === undefined)) delete entry[field];
  else entry[field] = value as SiteOverride[Field];

  const next: Record<string, SiteOverride> = {...snapshot};
  if (Object.keys(entry).length === 0) delete next[siteId];
  else next[siteId] = entry;

  write(next);
};

/** Put one site back to exactly what the dataset says. */
export const clearSiteOverride = (siteId: string): void => {
  if (snapshot[siteId] === undefined) return;
  const next: Record<string, SiteOverride> = {...snapshot};
  delete next[siteId];
  write(next);
};
