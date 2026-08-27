import {useMemo} from 'react';

import {hybridPlant} from '@/modules/site/data/hybrid';
import {FALLBACK_POWER_ROLE, useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {SITE_SEED} from '@/modules/site/data/siteSeed';
import {hasBattery, hasSolar} from '@/modules/site/types/site.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * How much array and how much storage the estate is carrying, right now.
 *
 * The only data the two plant sections have while their pages are still empty:
 * enough for each shell to say what it is standing over, so the scaffold is
 * honest about scale before anybody designs a table for it.
 *
 * Read off the **live** roles rather than the seed, the same call `GensetsPage`
 * makes. A reader can flip a site to `SOLAR_HYBRID` on its settings tab and the
 * array count here follows on the next render — a header that disagreed with the
 * site pages would be the first thing to erode trust in both.
 *
 * There is no unit count here beyond one per site, because that is what the model
 * holds: `hybridPlant` gives a site one array and one bank. A real estate has
 * strings, inverters and racks, and when the registers below grow those, this is
 * the function that has to grow with them.
 */
export type PlantCount = {
  /** Sites with a PV array fitted. */
  arrays: number;
  /** Combined array nameplate, kWp. */
  kwp: number;
  /** Sites with a battery bank fitted — both hybrid configurations. */
  banks: number;
  /** Combined usable bank energy, kWh. */
  kwh: number;
};

export const plantCount = (roles: Record<string, SitePowerRole>): PlantCount =>
  SITE_SEED.reduce<PlantCount>(
    (total, seed) => {
      const role = roles[seed.id] ?? FALLBACK_POWER_ROLE;
      const plant = hybridPlant(seed, role);

      return {
        arrays: total.arrays + (hasSolar(role) ? 1 : 0),
        kwp: total.kwp + plant.pvKwp,
        banks: total.banks + (hasBattery(role) ? 1 : 0),
        kwh: total.kwh + plant.batteryKwh,
      };
    },
    {arrays: 0, kwp: 0, banks: 0, kwh: 0},
  );

export const usePlantCount = (): PlantCount => {
  const roles = useSitePowerRoles();
  return useMemo(() => plantCount(roles), [roles]);
};
