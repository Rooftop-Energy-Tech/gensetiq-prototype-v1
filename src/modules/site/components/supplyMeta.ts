import {BatteryChargingIcon, PlugZapIcon, SunMediumIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {SiteFeed} from '../data/sites';
import {hasBattery, hasMains, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';

/**
 * The supply badge, in one place because two screens draw it.
 *
 * The list's preview panel and the site page's own header both answer "what has
 * the load right now", and they answered it in two copies that had already begun
 * to differ — one of them said `1 of 2 feeding` at a prime site and the other did
 * not. Two readings of one fact is the bug this file exists to make impossible.
 *
 * ## Why the wording changes with the configuration
 *
 * Because the question does. At a diesel-prime site the gensets *are* the supply,
 * so **"1 of 2 feeding"** is the useful fact — and it is deliberately not "1 of 2
 * running": at most one set feeds the load, because there is one changeover, so a
 * second turning set is off-load and does not count.
 *
 * At a grid-backed site that count answers the wrong question. A healthy one has
 * **zero** sets feeding, and a badge reading "0 of 2 feeding" over a site running
 * perfectly well on the grid is alarm-shaped where no alarm exists.
 *
 * At a hybrid, a running genset is not the ordinary state either — it is the
 * backstop having been called on, which is worth its own word rather than the
 * neutral "on generator" a grid-backed site gets.
 */
export type SupplyMeta = {
  label: string;
  icon: LucideIcon;
  /** Drives the badge glyph's colour: is anything actually carrying the load. */
  live: boolean;
};

export const supplyMeta = (
  feed: SiteFeed,
  role: SitePowerRole,
  gensetCount: number,
): SupplyMeta => {
  switch (feed.source) {
    case 'MAINS':
      return {label: 'On mains', icon: UtilityPoleIcon, live: true};
    case 'SOLAR':
      return {label: 'On solar', icon: SunMediumIcon, live: true};
    case 'BATTERY':
      return {label: 'On battery', icon: BatteryChargingIcon, live: true};
    case 'GENSET':
      return {
        label: hasBattery(role)
          ? 'Genset carrying'
          : role === 'DIESEL_PRIME'
            ? `1 of ${gensetCount} feeding`
            : 'On generator',
        icon: PlugZapIcon,
        live: true,
      };
    default:
      // Every configuration can reach this and it is an outage in all of them: the
      // grid is down and no set picked the load up, or there is no grid and
      // nothing is generating.
      return {label: 'Not served', icon: PlugZapIcon, live: false};
  }
};

/**
 * How the site is powered, in one line — `Mains + 2 gensets`, `Solar + battery + genset`.
 *
 * The zero cases are spelled out rather than falling out of the arithmetic,
 * because "Mains + 0 gensets" reads as a defect and "0 gensets, no mains" reads as
 * a bug rather than what it is: a site with nothing supplying it, which is a real
 * thing to be looking at and deserves saying plainly.
 */
export const supplyLabel = (role: SitePowerRole, gensetCount: number): string => {
  const sets = `${gensetCount} genset${gensetCount === 1 ? '' : 's'}`;

  if (hasMains(role)) return gensetCount === 0 ? 'Mains only' : `Mains + ${sets}`;

  if (hasBattery(role)) {
    const plant = hasSolar(role) ? 'Solar + battery' : 'Battery';
    return gensetCount === 0 ? `${plant}, no genset` : `${plant} + ${sets}`;
  }

  return gensetCount === 0 ? 'No supply' : `${sets}, no mains`;
};
