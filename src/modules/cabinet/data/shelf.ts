import {hybridPlant} from '@/modules/site/data/hybrid';
import {isMonitored} from '@/modules/site/data/monitoringUnit';
import type {SiteSeed} from '@/modules/site/data/siteSeed';
import {hasSolar} from '@/modules/site/types/site.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';

/**
 * What is in a subrack where nobody has counted it — the shelf, sized.
 *
 * ## Why a sizing model is allowed here and was not before
 *
 * `monitoringUnit.ts` argues at length that a shelf sized from the load is the wrong
 * kind of number, and while SBH-1336 was the only cabinet in the app it was right:
 * that site has **seventeen alarm rows that are addresses on a device**, and a sized
 * shelf beside them would have put four `SSU N Fault` rows against three SSUs. The
 * counts there are not negotiable because the alarm list indexes them.
 *
 * That argument is about *contradiction*, and it has nothing to contradict at the
 * other three solar hybrids. They have no monitoring unit, so they have no rows
 * indexing a slot, so a sized shelf is the only kind of shelf they can have — the
 * same footing as their bank, which `hybridPlant` sizes from an autonomy, and their
 * array, which it sizes from peak sun hours. This estate is derived throughout; the
 * one exception is the site somebody has actually visited.
 *
 * So the rule is the rule the rest of the app already follows: **defer to the unit
 * where there is one, model where there is not, and say on the page which it is.**
 * See `SubrackCabinet.shelf`.
 *
 * ## The model reproduces the shelf we know
 *
 * Sized against SBH-1336's own figures this returns **six rectifiers at 4 kW and four
 * SSUs** — exactly what `monitoringUnit.ts` states for that site from the firmware's
 * reasoning about the real plant. That agreement is the whole reason to trust it
 * anywhere else, and it is worth re-checking if any constant below is touched: a
 * model that no longer lands on the one shelf anybody has counted has stopped being
 * a model of this estate.
 *
 * ## Why the duty is the bank, not the tower
 *
 * Sizing rectifiers to the tower alone gets it badly wrong, and the error is not
 * small: a 5 kW tower needs two 4 kW modules and this plant has six. The shelf is not
 * built for the tower — it is built for **recharging the bank while also carrying the
 * tower**, which is what it does through every genset block and what it must finish
 * before the next night. A 93 kWh bank put back in a working day is 12 kW on its own,
 * three times the tower it sits beside.
 *
 * That is also why the shelf reads N+4 against the tower and only N+1 against its
 * real duty. The apparent over-provision is an artefact of measuring it against the
 * wrong load.
 */

/** The rectifier module this estate fits, kW. */
const RECTIFIER_KW = 4;

/**
 * The solar conversion unit in the same shelf, kW.
 *
 * Back-figured from SBH-1336, where four SSUs carry a 28 kWp array. A rating that put
 * a fifth SSU in that shelf would contradict its four `SSU N Fault` addresses.
 */
const SSU_KW = 7;

/**
 * The window a flat bank has to come back up in, hours.
 *
 * A working day, and the figure the shelf's size is most sensitive to — it is what
 * turns "how big is the bank" into "how much conversion does it take". Eight hours is
 * what reproduces the real shelf; six would put a seventh module in it.
 */
const RECHARGE_HOURS = 8;

/** Modules in the shelf where nobody has counted them. */
export type SizedShelf = {
  rectifiers: number;
  rectifierKw: number;
  ssus: number;
};

/**
 * Whether this site has a DC plant worth a page.
 *
 * **Every solar hybrid**, because the SSUs are what make the shelf worth opening: a
 * site whose array and whose rectifiers share one subrack has a box where two
 * different conversions meet, and that is the thing the cabinet page is about.
 *
 * **Plus any site with a monitoring unit**, whatever its role. That clause is not
 * belt-and-braces — the role is editable on the site's own Settings tab, and flipping
 * SBH-1336 to a diesel yard would otherwise take away the page that seventeen of its
 * alarm rows are routed to, which is exactly the homelessness the cabinet was added
 * to fix.
 */
export const siteHasCabinet = (siteId: string, role: SitePowerRole): boolean =>
  hasSolar(role) || isMonitored(siteId);

/**
 * The shelf at a site with no unit on its wall.
 *
 * `Math.ceil` then `+ 1` is N+1 on the **duty**, not on the tower — see the file
 * header. The SSUs get no redundancy: an SSU short is a share of the array unharvested
 * and the rectifiers pick the tower up, which is a bad afternoon rather than an
 * outage, and the one shelf we have counted has no spare one either.
 */
export const sizedShelf = (seed: SiteSeed, role: SitePowerRole): SizedShelf => {
  const plant = hybridPlant(seed, role);
  const dutyKw = seed.loadKw + plant.batteryKwh / RECHARGE_HOURS;

  return {
    rectifiers: Math.ceil(dutyKw / RECTIFIER_KW) + 1,
    rectifierKw: RECTIFIER_KW,
    ssus: Math.max(1, Math.ceil(plant.solarKwp / SSU_KW)),
  };
};
