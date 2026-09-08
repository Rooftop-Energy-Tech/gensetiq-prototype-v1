import {useMemo} from 'react';

import {spread, spreadBetween} from '@/modules/genset/data/spread';
import {hybridPlant, hybridState, solarStep} from '@/modules/site/data/hybrid';
import {monitoringUnit} from '@/modules/site/data/monitoringUnit';
import {FALLBACK_POWER_ROLE, useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {siteSeed, siteSeeds} from '@/modules/site/data/siteSeed';
import {hasSolar} from '@/modules/site/types/site.type';
import type {SiteSeed} from '@/modules/site/data/siteSeed';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import type {SolarSystem, SystemState} from '../types/system.type';

/**
 * The solar register's rows, built from the estate rather than dealt beside it.
 *
 * ## Read off live roles, never the seed
 *
 * The same call `estateCount` and `GensetsPage` make, and for the same reason: a
 * reader can flip a site to `SOLAR_HYBRID` on its settings tab, and a system that
 * did not then appear in this list would be the first thing to make them distrust
 * both screens. Every function here takes `roles` rather than reaching for the
 * store, so the register, the system page and the count in the rail are three
 * readings of one input.
 *
 * ## What is derived and what is invented
 *
 * Capacity and output come from `hybrid.ts` and are shared with the site page and
 * the generation report — three screens, one model, and they cannot disagree.
 *
 * What this file adds is the **plant an energy model has no opinion about**: how
 * the array is wired into strings, how many modules that is, and when it was
 * commissioned. Those are dealt from the site's id, so they are stable across
 * reloads and consistent between the screens that show them, and they are mock in
 * exactly the way the genset register's models are.
 *
 * ## What is no longer here
 *
 * A ladder of inverters, a plan that chose one box or ten workhorses in parallel,
 * a DC/AC oversizing ratio, and a per-box apportionment of the system's output.
 * All of it modelled an AC stage that does not exist on a telco site: a tower
 * runs a −48 V DC bus and its loads are DC, so the array feeds the bus and there
 * is nothing to invert to. `system.type.ts` says what went with the boxes.
 *
 * Strings stayed, because a string is modules in series — a physical run on the
 * roof — and it is a fact about the array whatever it terminates in.
 *
 * The one thing that is *not* dealt is which strings are dark. See below.
 */

/**
 * One module's rating, watts.
 *
 * A constant rather than a spread figure, because a roof is built from one pallet:
 * an estate whose module wattage varied site by site would be one nobody procured.
 * 580 W is an ordinary large-format bifacial panel of the generation these were
 * installed in, which is what makes a 29 kWp tower array come out at fifty panels
 * rather than at a number that reads like an error.
 */
const MODULE_WATTS = 580;

/**
 * How many strings the array is wired in.
 *
 * Strings are 6–10 kWp — a plausible number of modules in series for a 1000 V
 * string — and the count follows from the system's capacity. Two at minimum: a
 * one-string array cannot lose a string and stay up, and the whole point of the
 * health band is that it can say *how many* strings went.
 *
 * The spread is per site rather than per string, so a 23 kWp tower comes out at
 * three strings and a 1,333 kWp mini-grid at a hundred and sixty-odd, which are
 * both plants somebody could walk along.
 */
const stringsOn = (siteId: string, kwp: number): number => {
  /**
   * Except at the one site with a **real monitoring unit on the wall**, where the
   * count is hardware.
   *
   * Its poll table carries one `SSU N Fault` and one `PV N Array Fault` per
   * conversion unit — four of each — and identity there is positional, so slot 3 is
   * reliably SSU 3. An array reported as three strings under an alarm list that
   * names four is a page contradicting the page beside it, and the alarm rows are
   * the half that cannot move: they are addresses on a device.
   *
   * A string and a conversion unit are the same count here because that is how this
   * plant is built — each SSU takes one array, which is exactly what makes `PV N
   * Array Fault` locatable. On a plant where several strings landed on one unit they
   * would be two numbers, and this would be the wrong place to reconcile them.
   *
   * The system's kWp is untouched, as the bank's kWh is: what changes is only how the
   * same array is divided. See `battery/data/banks.ts` for the same argument at
   * greater length.
   */
  const fitted = monitoringUnit(siteId)?.ssus;
  if (fitted !== undefined && fitted >= 2) return fitted;

  const perString = spreadBetween(siteId, 'system/string-kwp', 6, 10);
  return Math.max(2, Math.round(kwp / perString));
};

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * When the system went in.
 *
 * One to four years back. The lower bound matters: every yield figure here is
 * measured over twelve months, and a system commissioned last month would carry a
 * header date that contradicted the chart under it.
 */
const commissionedAt = (siteId: string, now: number): string =>
  new Date(now - spreadBetween(siteId, 'system/commissioned', 1, 4) * YEAR_MS).toISOString();

/**
 * Roughly one system in eight has stopped reporting.
 *
 * Worth having for the reason the fleet has an `OFFLINE` state: a screen on which
 * everything is always reachable never teaches a reader what an unreachable thing
 * looks like, and this is the state where every other figure about that plant is
 * stale rather than wrong.
 *
 * Keyed on the **system**, which it was not before. A silence used to be per box,
 * so a plant could be four-fifths visible and the register said so; with no boxes
 * there is one comms link to the site and it is either up or it is not. That is a
 * loss and `system.type.ts` records it as one.
 *
 * ## Why the salt is `site/silent` and not `system/silent`
 *
 * Because moving the key up a level nearly deleted the state. Keyed per box, one
 * in eight over a mini-grid's ten inverters meant the estate reliably had a silent
 * one to look at; keyed per site, one in eight over **three or four** solar
 * systems is a coin that comes up empty most of the time, and it did on both
 * estates — every system reporting, the `OFFLINE` badge unreachable, and the whole
 * withheld-figures path on the system page dead code nobody could see.
 *
 * So the salt is chosen rather than arbitrary: under `site/silent` exactly one
 * system on each estate is quiet, and neither is the largest — the 1,333 kWp
 * mini-grid stays live, because a showpiece that is permanently offline is a
 * different kind of unhelpful. That is the same thing `solarPerformance` does when
 * it spreads 0.76–1.06 "so the estate has healthy arrays and tired ones": a seeded
 * estate exists to have one of each, and picking the seed that gives you one is
 * the work, not a thumb on the scale.
 */
const isSilent = (systemId: string): boolean => spread(systemId, 'site/silent') < 0.13;

/**
 * A silent system has been silent for **at least a day**, and the floor is
 * load-bearing rather than cosmetic. Six hours is not offline — a plant that
 * missed a poll over lunch is a plant that missed a poll, and calling that
 * `OFFLINE` on a register teaches a reader to ignore the state. Past a day there
 * is also nothing of today left to publish from it, which is a state the page can
 * state plainly.
 */
const heardFrom = (systemId: string, silent: boolean, now: number): string =>
  new Date(
    now -
      (silent
        ? spreadBetween(systemId, 'system/silence-hours', 26, 120) * 60 * 60 * 1000
        : spreadBetween(systemId, 'system/heard', 0.5, 9) * 60 * 1000),
  ).toISOString();

/**
 * How many strings are dark — **read off the step rather than dealt beside it.**
 * This is the part worth checking.
 *
 * `hybrid.ts` gives a tired system a **step**: output drops in one month and
 * stays down, because that is what a fault looks like and what makes the chart
 * worth drawing at all. A step of that shape has one obvious physical cause on a
 * PV plant — strings have gone — and the arithmetic agrees: the model's steps are
 * 6–24%, and a string is a fifth to a seventeenth of the array.
 *
 * So the count is **computed from the depth of the step**, which is what keeps the
 * date the health band prints, the count of dark strings and the drop a reader can
 * see in the chart three readings of one event rather than three claims that
 * happen to agree.
 *
 * Never the whole array. Every string dark is a dead plant, which is a different
 * fault with a different fix, and the model has no way to tell the two apart — so
 * the page does not claim to.
 */
const darkStrings = (
  seed: SiteSeed,
  role: SitePowerRole,
  strings: number,
  now: number,
): number => {
  const step = solarStep(seed, role, now);
  if (step === undefined) return 0;

  // At least one string stays live, so this is the most that can be dark.
  return Math.min(strings - 1, Math.max(1, Math.round(step.depth * strings)));
};

const systemFrom = (seed: SiteSeed, role: SitePowerRole, now: number): SolarSystem => {
  const kwp = hybridPlant(seed, role).solarKwp;
  const strings = stringsOn(seed.id, kwp);

  const silent = isSilent(seed.id);
  const {solarKw} = hybridState(seed, role, now);
  const generating = !silent && solarKw > 0;
  const state: SystemState = silent ? 'OFFLINE' : generating ? 'GENERATING' : 'IDLE';

  return {
    id: seed.id,
    siteId: seed.id,
    siteName: seed.name,
    locationLabel: seed.locationLabel,
    latitude: seed.latitude,
    longitude: seed.longitude,
    customer: seed.customer,
    role,
    kwp,
    strings,
    modules: Math.round((kwp * 1000) / MODULE_WATTS),
    moduleWatts: MODULE_WATTS,
    downStrings: darkStrings(seed, role, strings, now),
    commissionedAt: commissionedAt(seed.id, now),
    lastUpdated: heardFrom(seed.id, silent, now),
    state,
    // Nothing at all from a system nobody can hear. Publishing the model's output
    // under a page that says it has heard nothing for two days would be claiming
    // a measurement nobody took.
    outputKw: generating ? solarKw : 0,
  };
};

/** Every solar system on the estate, by name. The register re-sorts by condition. */
export const solarSystems = (
  roles: Record<string, SitePowerRole>,
  now: number = Date.now(),
): Array<SolarSystem> =>
  siteSeeds().filter((seed) => hasSolar(roles[seed.id] ?? FALLBACK_POWER_ROLE))
    .map((seed) => systemFrom(seed, roles[seed.id] ?? FALLBACK_POWER_ROLE, now))
    .sort((left, right) => left.siteName.localeCompare(right.siteName));

/**
 * One system, or `undefined` if that site has none.
 *
 * The second half is the part that matters: a site whose role has been changed
 * away from `SOLAR_HYBRID` still has a routable id, and this is what turns
 * `/solar/telco-004` into a 404 rather than a page of zeroes.
 */
export const solarSystem = (
  systemId: string,
  roles: Record<string, SitePowerRole>,
  now: number = Date.now(),
): SolarSystem | undefined => {
  const seed = siteSeed(systemId);
  if (seed === undefined) return undefined;

  const role = roles[systemId] ?? FALLBACK_POWER_ROLE;
  return hasSolar(role) ? systemFrom(seed, role, now) : undefined;
};

/**
 * `now` is required on both hooks, and that is the point of them taking it.
 *
 * A default of `Date.now()` would be re-evaluated on every render, which busts the
 * memo and — worse — lets one page read two different clocks: the header's
 * `Telemetry · 4 minutes ago` and the curve underneath it would be measured from
 * instants a render apart. Every caller holds one `const [now] = useState(() =>
 * Date.now())` for the whole page, the way `GensetHome` does, and passes it in.
 */
export const useSolarSystems = (now: number): Array<SolarSystem> => {
  const roles = useSitePowerRoles();
  return useMemo(() => solarSystems(roles, now), [roles, now]);
};

export const useSolarSystem = (systemId: string, now: number): SolarSystem | undefined => {
  const roles = useSitePowerRoles();
  return useMemo(() => solarSystem(systemId, roles, now), [systemId, roles, now]);
};
