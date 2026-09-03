import {useSyncExternalStore} from 'react';

import type {CustomerId, ProgramId} from '@/brands';
import type {SitePowerRole} from '../types/site.type';
import {DATASET_SITE_SEED, datasetSiteSeed, siteSeed} from './siteSeed';
import type {SiteSeed} from './siteSeed';
import {
  clearSiteOverride,
  setSiteOverrideField,
  siteOverrides,
  subscribeSiteOverrides,
  useSiteOverride,
} from './siteOverrides';
import type {SiteOverride} from './siteOverrides';

/**
 * What a site's Settings tab edits, as one API over the override store.
 *
 * ## The three layers, and why they are three
 *
 * `siteOverrides.ts` is a **typed patch record over `localStorage`** and knows
 * nothing about sites. `siteSeed.ts` lays those patches over the dataset's rows and
 * is what the rest of the app reads. This file is the **product's view of the
 * seam**: what a reader is allowed to change, what the change is measured against,
 * and what it means when the two differ.
 *
 * The split exists because `siteSeed.ts` has to read the patches and this file has
 * to read the seeds — one module holding both would be a cycle.
 *
 * ## Why the power role still has its own accessors
 *
 * Because a dozen call sites want that one field and nothing else, and half of them
 * are outside components. `useSitePowerRole` selects a string rather than handing
 * back a config object, so a component watching one site's role does not re-render
 * when somebody moves another site's pin.
 *
 * ## What this is worth, and what it isn't
 *
 * A browser-local prototype affordance. It does not sync, a colleague opening the
 * same site sees the dataset's values, and — the important one — **it configures
 * nothing.** Renaming a site here renames it in this app; it does not rename it in
 * anybody's asset register. Changing the supply selects which circuit the site page
 * draws and commands no plant. See `SitePowerRole` for where that line is drawn and
 * why.
 */

/**
 * What a site is until somebody says otherwise: **whatever its dataset row says.**
 *
 * This used to be the constant `GRID_BACKUP`, on the grounds that the fleet's own
 * data says standby throughout — every set's activity feed is written around
 * utility outages. That held while the role only chose which single-line diagram to
 * draw. It stopped holding when the fleet summary began counting by it: a blanket
 * default makes the estate look as though it contains no prime sites at all, which
 * is a stronger claim than "nobody has flipped one yet".
 *
 * An id with no row behind it falls back to `GRID_BACKUP` — the app's original
 * assumption, and the safe reading for a site we know nothing about.
 */
export const FALLBACK_POWER_ROLE: SitePowerRole = 'GRID_BACKUP';

export const seededPowerRole = (siteId: string): SitePowerRole =>
  datasetSiteSeed(siteId)?.powerRole ?? FALLBACK_POWER_ROLE;

/** The role outside a component — routes, loaders, `aria-label` builders. */
export const sitePowerRole = (siteId: string): SitePowerRole =>
  siteSeed(siteId)?.powerRole ?? FALLBACK_POWER_ROLE;

export const setSitePowerRole = (siteId: string, role: SitePowerRole) =>
  setSiteOverrideField(siteId, 'powerRole', role, seededPowerRole(siteId));

/**
 * The role, live.
 *
 * The server snapshot is the dataset's value for the same reason the read falls
 * back to it: there is no `localStorage` during a render on the server, and the
 * dataset is the honest answer rather than a guess.
 */
export const useSitePowerRole = (siteId: string): SitePowerRole =>
  useSyncExternalStore(
    subscribeSiteOverrides,
    () => sitePowerRole(siteId),
    () => seededPowerRole(siteId),
  );

/**
 * Every site's effective role, live — what the summary cards count by.
 *
 * A whole map rather than `useSitePowerRole` in a loop, because the callers are
 * counting the *estate*: they need all twenty-five answers from one moment, and a
 * hook cannot be called per row anyway.
 *
 * Memoised against the override snapshot's identity so the object is stable between
 * writes. `useSyncExternalStore` compares snapshots by identity, and a fresh
 * `Object.fromEntries` on every call is an infinite render loop.
 */
let rolesCache: {overrides: unknown; roles: Record<string, SitePowerRole>} | undefined;

const allRoles = (): Record<string, SitePowerRole> => {
  const overrides = siteOverrides();
  if (rolesCache?.overrides !== overrides) {
    rolesCache = {
      overrides,
      roles: Object.fromEntries(
        DATASET_SITE_SEED.map((seed) => [
          seed.id,
          overrides[seed.id]?.powerRole ?? seed.powerRole,
        ]),
      ),
    };
  }
  return rolesCache.roles;
};

const SERVER_ROLES: Record<string, SitePowerRole> = Object.fromEntries(
  DATASET_SITE_SEED.map((seed) => [seed.id, seed.powerRole]),
);

export const useSitePowerRoles = (): Record<string, SitePowerRole> =>
  useSyncExternalStore(subscribeSiteOverrides, allRoles, () => SERVER_ROLES);

/**
 * The six things a reader can change about a site, and what each one currently is.
 *
 * `program: null` rather than `undefined` for a site in no programme, so the value
 * a picker holds and the value the store writes are the same shape — see
 * `SiteOverride.program` for why absent and null have to stay distinguishable at
 * the storage layer.
 */
export type SiteConfig = {
  name: string;
  latitude: number;
  longitude: number;
  customer: CustomerId;
  powerRole: SitePowerRole;
  program: ProgramId | null;
};

const configOf = (seed: SiteSeed): SiteConfig => ({
  name: seed.name,
  latitude: seed.latitude,
  longitude: seed.longitude,
  customer: seed.customer,
  powerRole: seed.powerRole,
  program: seed.program ?? null,
});

/**
 * The answer for an id that is not in this estate.
 *
 * Reachable only from a component rendering a site the route has already resolved,
 * so in practice it is unreachable — but the alternative is a nullable return that
 * every field in the settings form has to guard, which is a worse trade than one
 * inert placeholder. `0, 0` is the Gulf of Guinea and looks like the mistake it is.
 */
const EMPTY_CONFIG: SiteConfig = {
  name: 'Site',
  latitude: 0,
  longitude: 0,
  customer: '',
  powerRole: FALLBACK_POWER_ROLE,
  program: null,
};

/**
 * The settings form's state, live.
 *
 * Returns the effective config, the fields that differ from the dataset, and
 * whether anything does at all — the settings page needs all three at once (the
 * inputs' values, the per-field "changed" marks, and whether Reset is worth
 * offering), and deriving them from one subscription keeps them from disagreeing.
 */
export const useSiteConfig = (
  siteId: string,
): {config: SiteConfig; seeded: SiteConfig; changed: SiteOverride; isChanged: boolean} => {
  // Subscribes on its own account: the seeds this reads are recomputed from the
  // same store, but nothing else on the settings page would wake this component.
  const changed = useSiteOverride(siteId);
  const seed = siteSeed(siteId);
  const dataset = datasetSiteSeed(siteId);

  const config = seed === undefined ? EMPTY_CONFIG : configOf(seed);
  const seeded = dataset === undefined ? EMPTY_CONFIG : configOf(dataset);

  return {config, seeded, changed, isChanged: Object.keys(changed).length > 0};
};

export const setSiteName = (siteId: string, name: string) =>
  setSiteOverrideField(siteId, 'name', name, datasetSiteSeed(siteId)?.name);

export const setSiteLatitude = (siteId: string, latitude: number) =>
  setSiteOverrideField(siteId, 'latitude', latitude, datasetSiteSeed(siteId)?.latitude);

export const setSiteLongitude = (siteId: string, longitude: number) =>
  setSiteOverrideField(siteId, 'longitude', longitude, datasetSiteSeed(siteId)?.longitude);

export const setSiteCustomer = (siteId: string, customer: CustomerId) =>
  setSiteOverrideField(siteId, 'customer', customer, datasetSiteSeed(siteId)?.customer);

/** `null` files the site under no programme — a choice, not a cleared field. */
export const setSiteProgram = (siteId: string, program: ProgramId | null) =>
  setSiteOverrideField(siteId, 'program', program, datasetSiteSeed(siteId)?.program);

/** Put every field back to what the dataset says. */
export const resetSiteConfig = (siteId: string) => clearSiteOverride(siteId);
