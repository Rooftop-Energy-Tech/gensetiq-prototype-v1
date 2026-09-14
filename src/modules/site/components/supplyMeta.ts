import {BatteryChargingIcon, PlugZapIcon, SunMediumIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import type {SiteFeed} from '../data/sites';
import {hasBattery, hasMains, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';

/**
 * The supply badge, in one place because three screens draw it.
 *
 * The list, its preview panel and the site page's own header all answer "what has
 * the load right now", and they answered it in copies that had already begun to
 * differ — one of them said `1 of 2 feeding` at a prime site and the other did
 * not. Two readings of one fact is the bug this file exists to make impossible.
 *
 * ## Why the badge names the source and nothing else
 *
 * Because that is the question. The badge used to count sets at a diesel-prime
 * site — `1 of 2 feeding` — which answers *how the plant is arranged* rather than
 * *what is carrying the load*, and it made one column say two things in two
 * grammars: the other configurations named a source and this one reported a
 * fraction. A reader scanning the column for "who has it" had to parse a ratio to
 * find out it meant `On generator`.
 *
 * How many sets are fitted and how many are turning are real facts, and they are
 * the genset screens' — where a set is the object being looked at, not a
 * qualifier on a site's supply.
 *
 * At a hybrid a running genset is still worth its own word rather than the neutral
 * `On generator` a grid-backed site gets: there the backstop has been called on,
 * which is an event, not a configuration.
 */
export type SupplyMeta = {
  label: string;
  icon: LucideIcon;
  /** Drives the badge glyph's colour: is anything actually carrying the load. */
  live: boolean;
};

export const supplyMeta = (feed: SiteFeed, role: SitePowerRole): SupplyMeta => {
  switch (feed.source) {
    case 'MAINS':
      return {label: 'On mains', icon: UtilityPoleIcon, live: true};
    case 'SOLAR':
      return {label: 'On solar', icon: SunMediumIcon, live: true};
    case 'BATTERY':
      return {label: 'On battery', icon: BatteryChargingIcon, live: true};
    case 'GENSET':
      return {
        label: hasBattery(role) ? 'Genset carrying' : 'On generator',
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
