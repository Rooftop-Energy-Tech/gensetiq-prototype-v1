import {useMemo} from 'react';

import {spread, spreadBetween} from '@/modules/genset/data/spread';
import {hybridPlant, hybridState, solarStep} from '@/modules/site/data/hybrid';
import {FALLBACK_POWER_ROLE, useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {siteSeed, siteSeeds} from '@/modules/site/data/siteSeed';
import {hasSolar} from '@/modules/site/types/site.type';
import type {SiteSeed} from '@/modules/site/data/siteSeed';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import {systemState} from '../types/system.type';
import type {Inverter, InverterState, SolarSystem} from '../types/system.type';

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
 * many inverters carry the system, which box is on the wall, how the strings
 * divide between them, and when it was commissioned. Those are dealt from the
 * site's id, so they are stable across reloads and consistent between the screens
 * that show them, and they are mock in exactly the way the genset register's
 * models are.
 *
 * The one thing that is *not* dealt is which strings are dark. See below.
 */

/**
 * The inverters on this estate, smallest first.
 *
 * A real ladder rather than a token one, because the two brands span fifty to
 * one: a CelcomDigi tower is 23 kWp and SESB's largest mini-grid is **1,333
 * kWp**. The first version of this list stopped at 50 kW and had a `?? last`
 * fallback, so the mini-grid resolved to a single 50 kW box carrying 1.3 MW of
 * panel — a nameplate that contradicted its own DC/AC note and pegged every dial
 * on the page. Nobody had opened the SESB brand.
 *
 * Sizes are the ones actually specified in this market: small three-phase string
 * inverters for the towers, and 110 kW string inverters in parallel for anything
 * commercial, which is what has displaced central inverters at this scale.
 */
const INVERTERS = [
  {model: 'Victron MultiPlus-II 48/5000', kw: 5},
  {model: 'Sungrow SG10RT', kw: 10},
  {model: 'Huawei SUN2000-20KTL-M3', kw: 20},
  {model: 'Huawei SUN2000-30KTL-M3', kw: 30},
  {model: 'SMA Sunny Tripower CORE1 50', kw: 50},
  {model: 'Sungrow SG110CX', kw: 110},
] as const;

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

/** The biggest box on the ladder — what a system too large for one of anything is built from. */
const WORKHORSE = INVERTERS[INVERTERS.length - 1];

/**
 * How much DC sits behind one inverter kilowatt.
 *
 * Systems are deliberately oversized to their inverters — the DC/AC ratio —
 * because an array reaches nameplate for minutes a year and paying for inverters
 * that can pass those minutes is worse value than clipping them. 1.15–1.30 is the
 * ordinary band, spread across the estate so the column has a range to read
 * rather than one repeated quotient.
 */
const dcAcRatio = (siteId: string): number => spreadBetween(siteId, 'system/dc-ac', 1.15, 1.3);

/**
 * How the system is built: one box if one will carry it, otherwise as many
 * workhorses as it takes.
 *
 * The rule matches how these are actually specified. Up to about 130 kWp there is
 * a single string inverter that fits and you fit it; past that nobody hunts for a
 * bigger box, they put another 110 in parallel. A 1,333 kWp mini-grid comes out
 * as ten of them, which is a plant somebody could walk along.
 */
const inverterPlan = (siteId: string, kwp: number): {model: string; kw: number; count: number} => {
  const neededAc = kwp / dcAcRatio(siteId);
  const single = INVERTERS.find((one) => one.kw >= neededAc);

  return single !== undefined
    ? {model: single.model, kw: single.kw, count: 1}
    : {model: WORKHORSE.model, kw: WORKHORSE.kw, count: Math.ceil(neededAc / WORKHORSE.kw)};
};

/**
 * How many strings land on one box.
 *
 * Strings are 6–10 kWp — a plausible number of modules in series for a 1000 V
 * string — and the count follows from the DC behind that inverter. Two at
 * minimum: a one-string inverter cannot lose a string and stay up, and the whole
 * point of the health band is that it can say *which* string went.
 */
const stringsOn = (siteId: string, inverterKwp: number): number => {
  const perString = spreadBetween(siteId, 'system/string-kwp', 6, 10);
  return Math.max(2, Math.round(inverterKwp / perString));
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
 * Roughly one inverter in eight has stopped reporting.
 *
 * Worth having for the reason the fleet has an `OFFLINE` state: a screen on which
 * everything is always reachable never teaches a reader what an unreachable thing
 * looks like, and this is the state where every other figure about that box is
 * stale rather than wrong.
 *
 * Keyed on the **inverter**, not the system, which is the point of the whole
 * restructure. A silent box in a system of ten is a warning and a hole in
 * `reportingKwp`; a system whose every box has gone quiet is a critical fault and
 * a page that publishes nothing. The old model could only say the second.
 */
const isSilent = (inverterId: string): boolean => spread(inverterId, 'inverter/silent') < 0.13;

/**
 * A silent inverter has been silent for **at least a day**, and the floor is
 * load-bearing rather than cosmetic. Six hours is not offline — a box that missed
 * a poll over lunch is a box that missed a poll, and calling that `OFFLINE` on a
 * register teaches a reader to ignore the state. Past a day there is also nothing
 * of today left to publish from it, which is a state the page can state plainly.
 */
const heardFrom = (inverterId: string, silent: boolean, now: number): string =>
  new Date(
    now -
      (silent
        ? spreadBetween(inverterId, 'inverter/silence-hours', 26, 120) * 60 * 60 * 1000
        : spreadBetween(inverterId, 'inverter/heard', 0.5, 9) * 60 * 1000),
  ).toISOString();

/**
 * Which strings are dark, and on which box — **read off the step rather than
 * dealt beside it.** This is the part worth checking.
 *
 * `hybrid.ts` gives a tired system a **step**: output drops in one month and
 * stays down, because that is what a fault looks like and what makes the chart
 * worth drawing at all. A step of that shape has one obvious physical cause on a
 * PV plant — strings have gone — and the arithmetic agrees: the model's steps are
 * 6–24%, and a string is a fifth to a seventeenth of a box.
 *
 * So the count is **computed from the depth of the step**, and then
 * **concentrated on one inverter** rather than sprinkled evenly. That is both the
 * realistic failure — a combiner fuse, a blown MPPT input, one wet junction box —
 * and the far more useful drawing: nine boxes at their number and one at 60% is a
 * fault with an address, where ten boxes each a little short is weather.
 *
 * Never the whole of a box. An inverter with every string dark is a dead
 * inverter, which is a different fault with a different fix, and the model has no
 * way to tell the two apart — so the page does not claim to.
 */
const darkStrings = (
  seed: SiteSeed,
  role: SitePowerRole,
  strings: Array<number>,
  now: number,
): Array<number> => {
  const dark = strings.map(() => 0);

  const step = solarStep(seed, role, now);
  if (step === undefined) return dark;

  const total = strings.reduce((sum, count) => sum + count, 0);
  // Every box keeps at least one live string, so this is the most that can be dark.
  const room = strings.reduce((sum, count) => sum + (count - 1), 0);

  let left = Math.min(room, Math.max(1, Math.round(step.depth * total)));
  const start = Math.floor(spread(seed.id, 'system/faulted') * strings.length);

  for (let step = 0; step < strings.length && left > 0; step += 1) {
    const index = (start + step) % strings.length;
    const take = Math.min(left, strings[index] - 1);
    dark[index] = take;
    left -= take;
  }

  return dark;
};

const systemFrom = (seed: SiteSeed, role: SitePowerRole, now: number): SolarSystem => {
  const kwp = hybridPlant(seed, role).solarKwp;
  const plan = inverterPlan(seed.id, kwp);

  // The boxes' DC shares sum back to the system's nameplate exactly, with the
  // remainder on the last one. A register that printed 1,333 kWp over ten rows
  // adding to 1,330 would be a page failing its own arithmetic in public.
  const each = Math.round(kwp / plan.count);
  const shares = Array.from({length: plan.count}, (_, index) =>
    index === plan.count - 1 ? kwp - each * (plan.count - 1) : each,
  );

  const stringCounts = shares.map((share) => stringsOn(seed.id, share));
  const dark = darkStrings(seed, role, stringCounts, now);

  // The healthy strings decide how the system's output divides between its boxes,
  // so the faulted one visibly makes less. Apportioning by nameplate instead
  // would have put a row reading "12.4 kW · 3 of 8 strings down" beside nine
  // identical rows — a row contradicting itself in its own two columns.
  const healthy = stringCounts.map((count, index) => count - dark[index]);
  const healthyTotal = healthy.reduce((sum, count) => sum + count, 0);
  const {solarKw} = hybridState(seed, role, now);

  const inverters: Array<Inverter> = shares.map((share, index) => {
    const id = `${seed.id}-inv-${String(index + 1).padStart(2, '0')}`;
    const silent = isSilent(id);
    const generating = !silent && solarKw > 0;
    const state: InverterState = silent ? 'OFFLINE' : generating ? 'GENERATING' : 'IDLE';

    return {
      id,
      label: `Inverter ${index + 1}`,
      systemId: seed.id,
      model: plan.model,
      ratedKw: plan.kw,
      kwp: share,
      strings: stringCounts[index],
      downStrings: dark[index],
      state,
      lastUpdated: heardFrom(id, silent, now),
      outputKw:
        generating && healthyTotal > 0
          ? Math.round(solarKw * (healthy[index] / healthyTotal) * 10) / 10
          : 0,
      // Nearly every box is left on `AUTO`, which is the honest starting state: an
      // inverter in manual is one somebody is standing in front of.
      controlMode: spread(id, 'inverter/mode') < 0.12 ? 'MANUAL' : 'AUTO',
    };
  });

  const reporting = inverters.filter((one) => one.state !== 'OFFLINE');

  return {
    id: seed.id,
    siteId: seed.id,
    siteName: seed.name,
    locationLabel: seed.locationLabel,
    role,
    kwp,
    acKw: plan.kw * plan.count,
    inverters,
    strings: stringCounts.reduce((sum, count) => sum + count, 0),
    modules: Math.round((kwp * 1000) / MODULE_WATTS),
    moduleWatts: MODULE_WATTS,
    downStrings: dark.reduce((sum, count) => sum + count, 0),
    commissionedAt: commissionedAt(seed.id, now),
    lastUpdated: inverters
      .map((one) => one.lastUpdated)
      .reduce((latest, at) => (Date.parse(at) > Date.parse(latest) ? at : latest)),
    state: systemState(inverters),
    // Only the boxes we can hear. A system reporting the model's whole output
    // while one of its inverters has been silent for two days would be claiming a
    // measurement nobody took.
    outputKw: Math.round(reporting.reduce((sum, one) => sum + one.outputKw, 0) * 10) / 10,
    reportingKwp: reporting.reduce((sum, one) => sum + one.kwp, 0),
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
