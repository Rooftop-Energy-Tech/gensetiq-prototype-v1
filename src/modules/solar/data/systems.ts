import {useMemo} from 'react';

import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {assertedPlantAlarms} from '@/modules/genset/data/assertedAlarms';
import {spread, spreadBetween} from '@/modules/genset/data/spread';
import {isStanding} from '@/modules/genset/types/alarmState.type';
import {hybridPlant, hybridState, solarStep} from '@/modules/site/data/hybrid';
import {monitoringUnit} from '@/modules/site/data/monitoringUnit';
import {FALLBACK_POWER_ROLE, useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {siteSeed, siteSeeds} from '@/modules/site/data/siteSeed';
import {hasSolar} from '@/modules/site/types/site.type';
import type {AlarmHandling} from '@/modules/genset/types/alarmState.type';
import type {SiteSeed} from '@/modules/site/data/siteSeed';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import {faultedBoxes} from './junctionBoxes';
import type {ArrayWiring, SolarSystem, SystemState} from '../types/system.type';

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
 * One module's rating, watts — the invented figure, for the sites nobody has been to.
 *
 * A constant rather than a spread figure, because a roof is built from one pallet:
 * an estate whose module wattage varied site by site would be one nobody procured.
 * 580 W is an ordinary large-format bifacial panel of the generation these were
 * installed in, which is what makes a 29 kWp tower array come out at fifty panels
 * rather than at a number that reads like an error.
 *
 * It is now the **fallback**. `SURVEYED_MODULE_WATTS` is what is actually on the roof
 * at the four sites anybody has counted, and the "one pallet" argument above is the
 * reason this ought to end up as one number: the day a fifth site is surveyed and
 * also reads 540 W, 580 should go.
 */
const MODULE_WATTS = 580;

/**
 * What is actually on the roof, watts, and how it is wired — surveyed at SBH-1336
 * (Jeff, 2026-09-09) and asserted at the other three sites with a monitoring unit.
 *
 * Thirty 540 W panels, two to a string, four strings to a junction box, the boxes
 * combining into a `PVDU80A`. See `ArrayWiring` for the run drawn out.
 *
 * ## The ratios are the survey; the counts are this site's capacity
 *
 * Which is the instruction and worth being exact about, because it is what produces
 * the one figure on these pages that does not reconcile. Two panels to a string and
 * four strings to a box hold everywhere; the *number* of strings comes from `kwp`,
 * and `kwp` is still `hybridPlant`'s modelled 23–31 rather than the surveyed 16.2.
 *
 * So at SBH-1336 the page says `28 kWp` and `52 × 540 W`, and 52 × 540 is 28.1 kW —
 * those two agree. What does **not** agree is the survey: the roof has thirty panels,
 * not fifty-two. Keeping `kwp` was a deliberate call (see below) and this is its
 * price, stated here rather than left for a reader to find.
 *
 * ## Why `kwp` was not changed to 16.2
 *
 * Because `kwp` is the root of every solar figure in the app — generation today, the
 * month and year charts, expected-against-actual, the site diagram's solar node, and
 * the bank's own charge windows through `dayEnergyKwh`. Halving it moves all of them,
 * at the one site that is the estate's showpiece, and that is a change to make
 * deliberately rather than as a side effect of adding a details row.
 *
 * The wiring below is therefore the honest half of the survey and the capacity is
 * still the model. The day `kwp` becomes 16.2, everything here divides evenly: 30
 * panels, 15 strings, 4 boxes, and the four `PV N Array Fault` rows land one per box.
 */
const SURVEYED_MODULE_WATTS = 540;
const PANELS_PER_STRING = 2;
const STRINGS_PER_BOX = 4;
const DISTRIBUTION_UNIT = 'PVDU80A';

/**
 * The array's make-up: its module rating, how many, how they are strung, and into
 * what.
 *
 * Surveyed where there is a monitoring unit and modelled everywhere else, which is
 * the same split `monitoringUnit.ts` draws — and the reason `wiring` is nullable
 * rather than a constant every site borrows.
 *
 * The surveyed branch works **from the string rather than from the panel**, and that
 * ordering is the whole of it: a string is two panels in series, so a roof cannot
 * hold an odd number of them, and dividing `kwp` by one panel's rating produces
 * fifty-seven at SWK-0559 — twenty-eight strings and one panel with nothing to be in
 * series with. Rounding to whole strings first makes every count below exact by
 * construction.
 *
 * Boxes round **up**, because the last one is allowed to be short. That is not a
 * rounding convenience: SBH-1336's own fifteen strings fill three boxes and leave
 * three in a fourth.
 */
const arrayBuild = (
  siteId: string,
  kwp: number,
): {moduleWatts: number; modules: number; strings: number; wiring: ArrayWiring | null} => {
  if (monitoringUnit(siteId) === undefined) {
    return {
      moduleWatts: MODULE_WATTS,
      modules: Math.round((kwp * 1000) / MODULE_WATTS),
      strings: stringsOn(siteId, kwp),
      wiring: null,
    };
  }

  const stringWatts = SURVEYED_MODULE_WATTS * PANELS_PER_STRING;
  // Two at minimum, for `stringsOn`'s reason: a one-string array cannot lose a string
  // and stay up, and the health band exists to say how many went.
  const strings = Math.max(2, Math.round((kwp * 1000) / stringWatts));

  return {
    moduleWatts: SURVEYED_MODULE_WATTS,
    modules: strings * PANELS_PER_STRING,
    strings,
    wiring: {
      panelsPerString: PANELS_PER_STRING,
      stringsPerBox: STRINGS_PER_BOX,
      junctionBoxes: Math.ceil(strings / STRINGS_PER_BOX),
      feedsInto: DISTRIBUTION_UNIT,
    },
  };
};

/**
 * How many strings the array is wired in — **at the sites nobody has surveyed.**
 *
 * Strings are 6–10 kWp — a plausible number of modules in series for a 1000 V
 * string — and the count follows from the system's capacity. Two at minimum: a
 * one-string array cannot lose a string and stay up, and the whole point of the
 * health band is that it can say *how many* strings went.
 *
 * The spread is per site rather than per string, so a 23 kWp tower comes out at
 * three strings and a 1,333 kWp mini-grid at a hundred and sixty-odd, which are
 * both plants somebody could walk along.
 *
 * ## What used to be here, and why it went
 *
 * A branch returning `monitoringUnit(siteId).ssus` — four — on the argument that a
 * string and a conversion unit are the same count, "because that is how this plant is
 * built: each SSU takes one array, which is exactly what makes `PV N Array Fault`
 * locatable". It ended with the condition under which it would be wrong: *"On a plant
 * where several strings landed on one unit they would be two numbers."*
 *
 * That is the plant. SBH-1336's survey has fifteen strings landing in four junction
 * boxes, so the four rows index **boxes** and the strings are a separate, larger
 * count. `arrayBuild` owns every site that has a unit now, so the branch was
 * unreachable as well as wrong.
 *
 * Which leaves this function reachable only by a reader flipping a site to solar
 * hybrid on its settings tab: every site that has an array today has a unit. That is
 * why it survives rather than being deleted with the branch.
 */
const stringsOn = (siteId: string, kwp: number): number => {
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
 * How many strings are dark — **the deeper of what the output step implies and what the
 * registers assert.** This is the part worth checking.
 *
 * ## The step
 *
 * `hybrid.ts` gives a tired system a **step**: output drops in one month and
 * stays down, because that is what a fault looks like and what makes the chart
 * worth drawing at all. A step of that shape has one obvious physical cause on a
 * PV plant — strings have gone — and the arithmetic agrees: the model's steps are
 * 6–24%, and a string is a fifth to a seventeenth of the array.
 *
 * So part of the count is **computed from the depth of the step**, which is what keeps
 * the date the health band prints, the count of dark strings and the drop a reader can
 * see in the chart three readings of one event rather than three claims that happen to
 * agree.
 *
 * ## The registers, and why they had to be let in
 *
 * The step was the *whole* count until 2026-09-09, and it left the array page saying two
 * things that could not both be true: `SJB 1` carrying a standing `PV 1 Array Fault`, and
 * the same card reading `4 of 4` delivering with the same generation figure as its six
 * healthy neighbours (Jeff). The two facts came from sources with no wire between them —
 * this function read a curve, and `PV N Array Fault` is a register on the monitoring unit.
 *
 * There was a real defence for leaving it: one string of twenty-six is **3.8%** of the
 * array, the model's steps start at 6%, and `plantAlarms.ts` says this register is "the
 * only register in the poll set that separates cloud from a string being gone" — catching
 * what the curve cannot is its whole job. But a card that says a box has a critical fault
 * and that everything is delivering is not a subtle claim about instrumentation; it reads
 * as a bug, and the breakdown fails at exactly the box a reader came to look at.
 *
 * So a standing `PV N Array Fault` now **floors** the count at one string per faulted box.
 *
 * ## Why the deeper of the two rather than the sum
 *
 * Because they are two readings of one roof, not two losses. The step gives a magnitude
 * and the registers give places; whatever those boxes have lost is already inside the
 * step's depth. Adding them would inflate a loss the array's own output does not support,
 * and this file's rule is that it never claims more than the measurement carries.
 *
 * `junctionBoxes.placeDark` is the other half: it puts the floored strings **in the boxes
 * the registers name** and spreads only the remainder, so the count and its placement come
 * from the same argument.
 *
 * Never the whole array. Every string dark is a dead plant, which is a different
 * fault with a different fix, and the model has no way to tell the two apart — so
 * the page does not claim to.
 */
/**
 * How a caller says what has been cleared. It defaults to `{}` on both factories, and
 * the default is load-bearing rather than convenience: the section route's `loader`
 * builds a system to read its name for the breadcrumb, and a loader is not a component,
 * so it cannot subscribe to the alarm store. `{}` means "nothing cleared", which is the
 * right reading for a caller that has not asked — and the loader never looks at
 * `downStrings`. Every caller that draws a figure off it goes through the hooks below.
 */
type HandlingArg = Record<string, AlarmHandling>;

const darkStrings = (
  seed: SiteSeed,
  role: SitePowerRole,
  strings: number,
  now: number,
  handling: Record<string, AlarmHandling>,
): number => {
  const step = solarStep(seed, role, now);
  const stepped = step === undefined ? 0 : Math.max(1, Math.round(step.depth * strings));

  /* Standing only, and live: clearing `PV 1 Array Fault` on the Alarms tab puts the
     string back on the way out of the tab, which is the behaviour every other mark in
     this app has. That is the whole reason `handling` is threaded down here rather than
     the seeded set being read straight off `dealt` — a cleared row that still darkened a
     string would leave a card reading `3 of 4` with nothing on it saying why. */
  const flagged = faultedBoxes(
    assertedPlantAlarms(seed.id, role, 'SOLAR', handling).filter(isStanding),
  ).size;

  // At least one string stays live, so this is the most that can be dark.
  return Math.min(strings - 1, Math.max(stepped, flagged));
};

const systemFrom = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number,
  handling: Record<string, AlarmHandling>,
): SolarSystem => {
  const kwp = hybridPlant(seed, role).solarKwp;
  const {moduleWatts, modules, strings, wiring} = arrayBuild(seed.id, kwp);

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
    modules,
    moduleWatts,
    wiring,
    downStrings: darkStrings(seed, role, strings, now, handling),
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
  handling: HandlingArg = {},
): Array<SolarSystem> =>
  siteSeeds().filter((seed) => hasSolar(roles[seed.id] ?? FALLBACK_POWER_ROLE))
    .map((seed) => systemFrom(seed, roles[seed.id] ?? FALLBACK_POWER_ROLE, now, handling))
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
  handling: HandlingArg = {},
): SolarSystem | undefined => {
  const seed = siteSeed(systemId);
  if (seed === undefined) return undefined;

  const role = roles[systemId] ?? FALLBACK_POWER_ROLE;
  return hasSolar(role) ? systemFrom(seed, role, now, handling) : undefined;
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
  /* `downStrings` is floored by the standing `PV N Array Fault` rows, so it moves when a
     row is cleared — which makes the alarm store an input to the system model. Both hooks
     subscribe for that reason and for no other. `useAlarmHandling` is a
     `useSyncExternalStore` over one stable snapshot, so this is a reference in the memo's
     deps rather than a new object each render. */
  const handling = useAlarmHandling();
  return useMemo(() => solarSystems(roles, now, handling), [roles, now, handling]);
};

export const useSolarSystem = (systemId: string, now: number): SolarSystem | undefined => {
  const roles = useSitePowerRoles();
  const handling = useAlarmHandling();
  return useMemo(
    () => solarSystem(systemId, roles, now, handling),
    [systemId, roles, now, handling],
  );
};
