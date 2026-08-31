import {useMemo} from 'react';

import {hybridPlant} from '@/modules/site/data/hybrid';
import {FALLBACK_POWER_ROLE, useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {SITE_SEED} from '@/modules/site/data/siteSeed';
import {hasBattery, hasSolar} from '@/modules/site/types/site.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * How much solar and how much storage the estate is carrying, right now.
 *
 * The only data the two plant sections have while their pages are still empty:
 * enough for each shell to say what it is standing over, so the scaffold is
 * honest about scale before anybody designs a table for it.
 *
 * Read off the **live** roles rather than the seed, the same call `GensetsPage`
 * makes. A reader can flip a site to `SOLAR_HYBRID` on its settings tab and the
 * system count here follows on the next render — a header that disagreed with the
 * site pages would be the first thing to erode trust in both.
 *
 * ## What has happened to the note that used to be here
 *
 * It said there was no unit count beyond one per site, because `hybridPlant` gave
 * a site one array and one bank, and that a real estate has strings, inverters and
 * racks which this function would have to grow with when the registers below grew
 * them. Half of that has happened: `/solar` now models the **inverters** and the
 * strings on them, in `solar/data/systems.ts`.
 *
 * This function deliberately did **not** grow with it. What it counts is *how much
 * plant the estate is carrying* — kWp and kWh, for a line under a nav item — and
 * that is a capacity question, which `hybridPlant` answers without knowing how
 * many boxes it is divided between. The moment this counted inverters it would
 * have to know which of them are reporting, and a figure in the rail that moved
 * when a box went quiet is not the figure the rail is for.
 *
 * `batteryKwh` is still one bank per site, and that half of the note stands.
 */
export type PlantCount = {
  /** Sites with a PV system fitted. */
  systems: number;
  /** Combined system nameplate, kWp. */
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
        systems: total.systems + (hasSolar(role) ? 1 : 0),
        kwp: total.kwp + plant.solarKwp,
        banks: total.banks + (hasBattery(role) ? 1 : 0),
        kwh: total.kwh + plant.batteryKwh,
      };
    },
    {systems: 0, kwp: 0, banks: 0, kwh: 0},
  );

export const usePlantCount = (): PlantCount => {
  const roles = useSitePowerRoles();
  return useMemo(() => plantCount(roles), [roles]);
};
