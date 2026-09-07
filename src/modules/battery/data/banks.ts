import {useMemo} from 'react';

import {hybridPlant, hybridState} from '@/modules/site/data/hybrid';
import {
  FALLBACK_POWER_ROLE,
  sitePowerRole,
  useSitePowerRoles,
} from '@/modules/site/data/siteConfig';
import {siteSeed, siteSeeds} from '@/modules/site/data/siteSeed';
import type {SiteSeed} from '@/modules/site/data/siteSeed';
import {hasBattery} from '@/modules/site/types/site.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import type {BatteryBank} from '../types/bank.type';

/**
 * Every battery bank on the estate, derived from the sites that have one.
 *
 * A direct parallel of `solar/data/systems.ts`, deliberately: same shape, same
 * role-driven existence test, same pair of `bank`/`useBank` readers, so the two
 * plant registers can be read by anybody who has read either.
 *
 * ## Why a bank exists at all is a question about the site
 *
 * `hasBattery(role)` — and the role is a **live** setting a reader can flip on a
 * site's settings tab. So a bank is not a permanent object: converting a site from
 * `DIESEL_PRIME` to `DIESEL_HYBRID` brings one into being and flipping it back
 * takes it away, exactly as it does a solar system. That is why `bank()` returns
 * `undefined` rather than throwing, and why the route 404s on it: `/battery/prk-0713`
 * is a real URL for a site that currently has no storage, and a page of zeroes
 * would be a worse answer than a not-found.
 */

/**
 * One module's usable energy, kWh.
 *
 * A constant, for the reason `MODULE_WATTS` is one in the solar module: a bank is
 * built from one product, and an estate whose module size varied site by site is
 * one nobody procured. 5.12 kWh is an ordinary 51.2 V / 100 Ah LFP rack module,
 * which is what these are actually assembled from.
 */
const MODULE_KWH = 5.12;

/**
 * The converter's continuous rating as a fraction of the bank's energy.
 *
 * 0.5C — a bank that can deliver its whole usable energy in two hours. That is the
 * ordinary specification for storage doing this job: it has to carry the tower's
 * load, which is a small fraction of the bank, and it has to absorb a genset's
 * charging block or an array's midday peak, which is not. Anything faster is paying
 * for power a telecom site never draws.
 *
 * It matters on the page because it is the bank's *other* nameplate. A reader who
 * knows only the kWh cannot tell whether a bank can take the array's 30 kW at noon;
 * the pair of figures is what answers that. A solar system has no such pair — its
 * `kwp` is both the size and the ceiling, because a telco array feeds the DC bus
 * with no converter of its own in between.
 */
const C_RATE = 0.5;

const bankFrom = (seed: SiteSeed, role: SitePowerRole, now: number): BatteryBank => {
  const plant = hybridPlant(seed, role);
  const state = hybridState(seed, role, now);

  return {
    id: seed.id,
    siteId: seed.id,
    siteName: seed.name,
    locationLabel: seed.locationLabel,
    latitude: seed.latitude,
    longitude: seed.longitude,
    customer: seed.customer,
    role,
    kwh: plant.batteryKwh,
    autonomyHours: plant.autonomyHours,
    soh: plant.soh,
    // At least one, so a very small bank is never reported as built from nothing.
    modules: Math.max(1, Math.round(plant.batteryKwh / MODULE_KWH)),
    moduleKwh: MODULE_KWH,
    continuousKw: Math.round(plant.batteryKwh * C_RATE),
    soc: state.soc,
    hoursLeft: state.hoursLeft,
    powerKw: state.batteryKw,
  };
};

/**
 * A site has a bank when its role says so **and** the sizing came out above zero.
 *
 * Both halves are needed. The role is the declaration; `batteryKwh` is the
 * arithmetic, and a site whose load rounds the bank to nothing has no bank however
 * it is configured. The same pair guards the site rail's `Asset ▸ Battery` row.
 */
const fitted = (seed: SiteSeed, role: SitePowerRole): boolean =>
  hasBattery(role) && hybridPlant(seed, role).batteryKwh > 0;

/** Every bank on the estate, by site name. The register re-sorts. */
export const batteryBanks = (
  roles: Record<string, SitePowerRole>,
  now: number = Date.now(),
): Array<BatteryBank> =>
  siteSeeds().filter((seed) => fitted(seed, roles[seed.id] ?? FALLBACK_POWER_ROLE))
    .map((seed) => bankFrom(seed, roles[seed.id] ?? FALLBACK_POWER_ROLE, now))
    .sort((left, right) => left.siteName.localeCompare(right.siteName));

/** One bank, or `undefined` where that site has no storage. */
export const batteryBank = (
  bankId: string,
  roles: Record<string, SitePowerRole>,
  now: number = Date.now(),
): BatteryBank | undefined => {
  const seed = siteSeed(bankId);
  if (seed === undefined) return undefined;

  const role = roles[bankId] ?? seed.powerRole;
  return fitted(seed, role) ? bankFrom(seed, role, now) : undefined;
};

/**
 * The loader's reader — the store's own function rather than the hook, because a
 * loader is not a component. Mirrors `solarSystem`'s use in the solar route.
 */
export const bankForLoader = (bankId: string, now: number): BatteryBank | undefined =>
  batteryBank(bankId, {[bankId]: sitePowerRole(bankId)}, now);

export const useBatteryBanks = (now: number): Array<BatteryBank> => {
  const roles = useSitePowerRoles();
  return useMemo(() => batteryBanks(roles, now), [roles, now]);
};

export const useBatteryBank = (bankId: string, now: number): BatteryBank | undefined => {
  const roles = useSitePowerRoles();
  return useMemo(() => batteryBank(bankId, roles, now), [bankId, roles, now]);
};
