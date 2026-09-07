import {sfcLitresPerKwh} from '@/modules/genset/data/detail';
import {spread, spreadBetween} from '@/modules/genset/data/spread';
import {hasBattery, hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {customer} from './customers';
import {siteSeeds} from './siteSeed';
import type {SiteSeed} from './siteSeed';

/**
 * The hybrid plant at each site, and what it has done with the last thirty days.
 *
 * ## What this module is for
 *
 * The mobile-fleet build answers one question about power: is the machine
 * turning. That is the whole question when the machine is the only source. On
 * this estate three of the four configurations have something else on the bus, so
 * the question becomes **what carried the load**, and nothing in the genset module
 * can answer it — a controller reports its own output and knows nothing about the
 * array on the roof beside it.
 *
 * ## Everything here is derived from four givens
 *
 * The site's `loadKw`, its `powerRole`, its region's `peakSunHours`, and the
 * genset's own fuel curve. Nothing about the plant is seeded separately, and that
 * is deliberate rather than economical: a seeded PV size and a seeded solar share
 * can disagree, and the first thing a reader does with a hybrid dashboard is check
 * whether the second follows from the first.
 *
 * So the chain runs one way only:
 *
 *   load → daily energy → array size → generation → what the genset still owes →
 *   litres.
 *
 * The chain used to run one link further, into what the same site would have
 * burned on diesel alone and what that was worth in ringgit. That comparison has
 * been taken out and will come back as its own thing; what is left is a
 * measurement of what happened, with no counterfactual under it.
 *
 * Every figure on the energy screen is a link in that chain, which is why the
 * screen can show its own working.
 *
 * ## Why the fuel arithmetic reuses the genset's curve
 *
 * `sfcLitresPerKwh` is the module-wide statement that a diesel burns worse the
 * lighter it is loaded, and it is what the run log, the tank ladder and the
 * current-run card all cost their fuel with. Reading it here too — at the loading
 * a genset actually holds, rather than at a flat litres-per-kilowatt-hour — is
 * what keeps the litres this module reports and the burn rate a genset's own page
 * shows from drifting apart. A second constant here would have made the headline
 * number on the demo the one figure in the app that reconciles against nothing.
 *
 * ## The seam, stated rather than hidden
 *
 * This is a **site** model and the run log is a **machine** model, and the two are
 * not reconciled. `history.ts` deals every genset a run log from a hash of its
 * id — it knows nothing about arrays or banks — so a solar-hybrid site's genset
 * has a history in which it ran like any other machine, and the thirty-day
 * figures here say it barely ran at all.
 *
 * Reconciling them properly means the run log becoming a function of the site's
 * configuration, which is the right shape and a larger change than this white
 * label. Until then the rule is that the two never appear on one screen: the
 * report's **Overall** and **Solar** tabs and the site pages read this module,
 * while its **Genset** tab, the run log and the tank chart read `history.ts`, and
 * no figure is derived from both.
 *
 * The three reports sharing a section does not weaken that. A tab strip is a set
 * of screens, not one screen with three bands — which is most of why the reports
 * were consolidated as tabs rather than stacked into a single page.
 *
 * These are **mock sites**, the same standing as every other figure in this
 * prototype. The arithmetic is real; the estate is not.
 */

const HOURS_PER_DAY = 24;
const WINDOW_DAYS = 30;

/**
 * How much of a PV array's nameplate reaches the bus over a year.
 *
 * Soiling, temperature derate, cabling, conversion losses on the way to the bus.
 * 0.78 is the ordinary design assumption for a fixed rooftop array in this
 * climate, and it is applied
 * once here rather than folded into the sun hours, because the two are different
 * kinds of fact: sun hours are the weather, the ratio is the equipment.
 */
const PERFORMANCE_RATIO = 0.78;

/**
 * Round-trip efficiency of the battery, charge to discharge.
 *
 * Lithium iron phosphate with its own converter, so 0.9 rather than the 0.7 a
 * lead-acid bank would give. It is why generation always exceeds the load: some
 * of every kilowatt-hour is spent getting into and out of storage.
 */
const ROUND_TRIP = 0.9;

/**
 * The share of the load that never goes near the battery.
 *
 * At a solar site the array feeds the tower directly through the middle of the
 * day and only the surplus is stored; at a diesel-hybrid site the genset carries
 * the tower while it charges. Either way roughly a third of the day's energy
 * takes the direct path and pays no storage loss, which is what this fraction is
 * for.
 */
const DIRECT_SHARE = 0.35;

/** Loading a genset holds while charging a battery bank — near its best point. */
const CHARGING_LOAD_FRACTION = 0.78;

/**
 * The share of a bank's charge the tower never gets, `0`–`1`.
 *
 * The plant sheds load before the bank is empty. On the SMU these sites run, the
 * first low-voltage disconnect stage is set at **25% state of charge** and the
 * battery disconnect below it at 5%, so the bottom quarter of the dial is there to
 * keep the bank alive rather than to keep the tower up.
 *
 * It is here because runtime has to count down to the shed line and not to zero.
 * A page that counts to zero is not being optimistic by a rounding error — at 42%
 * charge it reports two and a half times the hours the site will actually get, and
 * it is wrongest exactly when somebody is deciding whether to drive out tonight.
 *
 * ⚠️ **A real plant needs the stage's mode read alongside this.** LLVD stages
 * disconnect on voltage, elapsed minutes *or* capacity, and the default is voltage
 * — a bank in Voltage Mode does not shed at 25% at all. One constant is the right
 * answer for a prototype and the wrong one for the ingest.
 */
const SHED_FLOOR = 0.25;

/**
 * What sort of shape this array is in, as a multiplier on what its glass would
 * otherwise raise, `0`–`1`+.
 *
 * The one figure here that is **not** derived from anything, because in a real
 * deployment it is not derived either: every cause of it is site-specific.
 * Soiling nobody has washed off, a string that tripped in March, a tree that has
 * grown, a cell derating in the heat.
 *
 * Spread 0.76–1.06 from the site id, so the estate has healthy arrays and tired
 * ones. That spread is what gives the fault model something to describe — a
 * `downStrings` count with an onset month behind it — rather than an estate on
 * which nothing has ever gone wrong.
 */
const solarPerformance = (seed: SiteSeed, role: SitePowerRole): number =>
  hasSolar(role) ? spreadBetween(seed.id, 'hybrid/array-health', 0.76, 1.06) : 1;

/**
 * The hybrid plant at a site: **a solar system, and a battery.**
 *
 * ## Capacities, not assets — and that is the whole point of this type
 *
 * Three numbers and no identity. This is a *sizing* answer, and everything
 * downstream of it is physics: `siteEnergy` turns it into generation, the site
 * diagram draws it as rows on the bus, `estateCount` sums it. None of those may
 * know that a system stopped reporting on Tuesday, or how many of its strings
 * went dark in March.
 *
 * The moment this returned the *asset* rather than its size, the energy model
 * would be able to see a comms failure — and an energy model that knows what is
 * talking is one that will eventually disagree with the telemetry on the same
 * screen. That is the seam the README names between `history.ts` and this file,
 * met from the other side.
 *
 * So the layering is: `hybridPlant` says how big, `solarSystem` in the solar
 * module says what it is and how it is doing. The second is built on the first.
 *
 * ## Why there is no array here
 *
 * There was briefly a `SolarArray` asset above this, with its own register and
 * detail page, and it was the wrong unit — but not for the reason first written
 * down. The argument then was that an array is the half of a PV system with no
 * electronics, so nothing reads from it and the box beside it does the reading.
 * On a telco site there is no box: the array feeds a −48 V DC bus and there is no
 * AC stage to invert to. `solarSystem` is the level that reports, and an array
 * under it would be a second name for the same thing.
 *
 * An array earns a place in a model for exactly one job, and it is **attribution
 * rather than measurement**: a sub-array is a plane with one tilt and one
 * azimuth, and naming it is how a shortfall gets pinned to a piece of roof rather
 * than left as a figure about the whole system. Every site on both estates here
 * is one plane, so there is nothing to attribute and the level would only ever
 * hold one child. When a customer turns up with an east and a west roof, the
 * thing to add is a `plane` under the system — not an `array`, which is too
 * overloaded a word to reintroduce.
 *
 * What survives of it is `solarKwp`, and that is not a leftover. DC nameplate is
 * the denominator of every performance figure in solar — specific yield is
 * kWh/kWp, a quote says 1.3 MWp — so the system simply has a size.
 */
export type HybridPlant = {
  /** The PV system's nameplate, kWp DC. `0` where no system is fitted. */
  solarKwp: number;
  /** Usable battery energy, kWh. `0` where no bank is fitted. */
  batteryKwh: number;
  /** Hours the bank alone can carry the site from full. */
  autonomyHours: number;
  /**
   * How much of its nameplate the bank still holds, `0`–`1`. `0` where no bank is
   * fitted.
   *
   * State of health, and the reason it sits here beside `batteryKwh` rather than
   * in `HybridState`: charge is where the level stands this minute, health is how
   * big the tank has become. One moves by the hour, the other over years and only
   * ever downwards, so health is a fact about the plant that is fitted.
   *
   * `batteryKwh` is deliberately **not** discounted by it. The kilowatt-hours this
   * model quotes are the bank's specification — what was procured, and what the
   * autonomy was sold against — and folding fade into them would silently restate
   * every capacity figure on the estate against a number the reader cannot see.
   * Reporting the two side by side is what makes the gap legible, which is the
   * whole reason for carrying health at all.
   */
  soh: number;
};

/**
 * What is fitted at this site.
 *
 * ## Why the array is sized to a *share* of the load rather than to all of it
 *
 * An array big enough to carry a tower through the worst week of the monsoon is
 * two to three times the one that carries it through an ordinary week, and the
 * whole of that difference is spilled for most of the year. Nobody builds that.
 * They build for two-thirds to three-quarters of the annual energy and leave the
 * genset to cover the rest, which is precisely why these sites are called hybrids
 * and still have a genset bolted to the plinth.
 *
 * The share varies 0.62–0.78 across the estate, from `spread()` on the site id, so
 * the solar column has a spread to read rather than one repeated number.
 *
 * ## Why the bank is sized in hours
 *
 * Because that is how the network team specifies it. A site is quoted an
 * autonomy — how long the tower stays up with nothing generating — and the
 * kilowatt-hours follow from the load. A diesel hybrid is given 10–14 hours,
 * enough to hold the tower between two charging blocks. A solar hybrid is given
 * 16–20, because it has to cover a night and part of a dull morning.
 *
 * ## Why health is a spread, and why the two ranges differ
 *
 * State of health is the figure the customer's complaint is actually about: banks
 * specified to carry three days losing most of that in one, at RM30,000 a unit. A
 * single estate-wide number would say nothing about that, so it is spread on the
 * site id like the two above — **0.78–0.93 where the bank is cycled by a genset's
 * charging blocks, 0.86–0.98 where an array takes it through one shallower cycle a
 * day.**
 *
 * The two ranges are the estate's own argument rather than decoration. Heavy
 * genset running and heavy battery cycling travel together, so the worst-health
 * banks land on the diesel side by construction, and a reader sorting the register
 * by health is reading the case for the conversion programme.
 */
export const hybridPlant = (seed: SiteSeed, role: SitePowerRole): HybridPlant => {
  if (!hasBattery(role)) return {solarKwp: 0, batteryKwh: 0, autonomyHours: 0, soh: 0};

  const autonomyHours = hasSolar(role)
    ? spreadBetween(seed.id, 'hybrid/autonomy-solar', 16, 20)
    : spreadBetween(seed.id, 'hybrid/autonomy-diesel', 10, 14);

  const batteryKwh = Math.round(seed.loadKw * autonomyHours);

  // Health follows the cycling regime rather than the size of the bank — see the
  // note above on why the diesel range sits lower than the solar one.
  const soh = hasSolar(role)
    ? spreadBetween(seed.id, 'hybrid/soh-solar', 0.86, 0.98)
    : spreadBetween(seed.id, 'hybrid/soh-diesel', 0.78, 0.93);

  if (!hasSolar(role)) {
    return {solarKwp: 0, batteryKwh, autonomyHours: Math.round(autonomyHours), soh};
  }

  const solarShare = spreadBetween(seed.id, 'hybrid/solar-share', 0.62, 0.78);
  const dailyLoadKwh = seed.loadKw * HOURS_PER_DAY;
  const sunHours = customer(seed.customer).peakSunHours;
  const solarKwp = Math.round((dailyLoadKwh * solarShare) / (sunHours * PERFORMANCE_RATIO));

  return {solarKwp, batteryKwh, autonomyHours: Math.round(autonomyHours), soh};
};

/**
 * What the plant is doing right now — the figures the site diagram puts under
 * its solar and battery nodes.
 *
 * The hour of day is the only input that is not a given about the site, and it is
 * read once per call rather than held, so the page shows the estate at the moment
 * it was opened. A solar site at 03:00 correctly shows an array making nothing and
 * a bank carrying the tower, which is the state most of a demo's audience has
 * never seen drawn.
 */
export type HybridState = {
  /** What the array is making, kW. `0` at night and at sites with no array. */
  solarKw: number;
  /** State of charge, `0`–`1`. */
  soc: number;
  /** Positive while the bank discharges into the bus, negative while charging. */
  batteryKw: number;
  /**
   * Hours the bank alone would carry this site **from where it is now**, to the
   * point the plant sheds load. `0` where no bank is fitted.
   *
   * The same quantity `HybridPlant.autonomyHours` states, read from the present
   * charge instead of from full, so the pair `13 h from full | 1.8 h left` is one
   * fact at two moments rather than two figures a reader has to reconcile.
   *
   * ## Why this is the number the site page should lead with
   *
   * Because a percentage has a denominator and it is not on screen. This estate's
   * banks run 38 kWh to 93 kWh and their health runs 78% to 98%, so two sites both
   * reading `42%` can differ four-fold in the energy behind it. Hours divide that
   * out, and they are the unit the network team specifies a bank in to begin with —
   * as well as what the genset half of the same screen already says about fuel.
   *
   * ## The two corrections in it
   *
   * **Health.** A BMS reports charge against the capacity the bank has *now*, so
   * `soc` is already relative to a faded pack — the fade has to be applied to the
   * kilowatt-hours to get back to real energy, and applied once. A bank at 80%
   * health has lost a fifth of every hour it was sold with.
   *
   * **The shed floor.** See `SHED_FLOOR`: the bottom quarter is not the tower's to
   * spend.
   *
   * Neither correction is visible in a percentage, which is most of the argument
   * for not leading with one.
   */
  hoursLeft: number;
};

const FIRST_LIGHT = 7;
const LAST_LIGHT = 19;

/**
 * The shape of a site's own draw across a day, as a multiplier on its metered kW.
 *
 * Deliberately shallow. A telecom site's load is air-conditioning and radios: it
 * does not switch off at night and it does not double at noon, so this runs between
 * about 0.88 and 1.12 with the peak in the afternoon when the cabinet is hottest.
 * A domestic double-peak profile would be the wrong shape borrowed from the wrong
 * kind of customer, and it would make the array look like it was missing an evening
 * demand that these sites do not have.
 *
 * `seed.loadKw` stays the day's mean by construction — the multiplier averages to
 * 1 over 24 hours — so this reshapes the metered figure without inventing energy.
 */
export const loadShape = (hour: number): number =>
  1 + 0.12 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);

/**
 * The shape of a solar day, unnormalised: `0` before first light, `1` at noon.
 *
 * A **cubed** sine rather than a plain one. The plain sine was here first and it
 * is too broad: spread across twelve hours it implies a peak of only about a
 * third of what an array actually reaches at noon, because it puts far too much
 * of the day's energy into the first and last hours. Cubing narrows it to
 * something like a real clear-sky curve, which lands the peak near half of
 * nameplate and leaves the shoulders where they belong.
 *
 * The point is that the shape is *right* — nothing before 07:00, nothing after
 * 19:00, a peak at one o'clock — not that the 14:00 value is accurate to a
 * percent.
 */
const solarShape = (hour: number): number => {
  if (hour < FIRST_LIGHT || hour > LAST_LIGHT) return 0;
  return Math.sin(((hour - FIRST_LIGHT) / (LAST_LIGHT - FIRST_LIGHT)) * Math.PI) ** 3;
};

/**
 * Hours the shape integrates to — the divisor that turns a day's energy into a
 * power curve.
 *
 * `∫ sin³` over a half period has a mean of `4/3π`, so twelve hours of this shape
 * come to about 5.09 "peak hours". Dividing a day's kilowatt-hours by it gives
 * the peak kilowatts that day would have had, and multiplying back by the shape
 * gives every point in between. **That is what makes the intraday curve and the
 * monthly totals the same fact**: the area under the curve is the day's energy by
 * construction, not by coincidence.
 */
const SHAPE_HOURS =
  ((LAST_LIGHT - FIRST_LIGHT) * 4) / (3 * Math.PI);

/**
 * What an array making `dayKwh` across the whole day is putting out at `hour`, kW.
 *
 * Exported because the array's analysis tab draws a *history* of this quantity
 * and there is exactly one right way to get it: the day's energy over the day's
 * shape. Rebuilding the curve in the solar module — which is what would have
 * happened — is how the diagram's live `SOLAR` node came to disagree with the
 * energy model by a factor of two and a half. One function, one answer.
 */
export const intradayKw = (dayKwh: number, hour: number): number =>
  (dayKwh / SHAPE_HOURS) * solarShape(hour);

/**
 * How much of a day's energy has arrived by `hour`, `0`–`1`.
 *
 * The shape integrated from first light to now, over the whole day's integral. It
 * replaces a flat 0.55 that stood in for "today is partly done" — which was wrong
 * twice over: it did not move with the clock, and it was being applied to the
 * day's total *and* then read again as the height of the intraday curve, so a
 * portfolio putting out 53 kW at noon reported 32.
 *
 * A day's energy does not accrue evenly. By nine in the morning an array has made
 * about a twelfth of its day, not a fifth, because the sun is still low. This is
 * the curve saying so.
 */
const elapsedShare = (hour: number): number => {
  if (hour <= FIRST_LIGHT) return 0;
  if (hour >= LAST_LIGHT) return 1;

  // Numeric rather than closed-form: `∫sin³` has one, and a loop of 240 steps is
  // clearer than it and exact enough for a chart.
  const STEPS = 240;
  const step = (LAST_LIGHT - FIRST_LIGHT) / STEPS;
  let sofar = 0;
  let whole = 0;
  for (let index = 0; index < STEPS; index += 1) {
    const at = FIRST_LIGHT + (index + 0.5) * step;
    const value = solarShape(at) * step;
    whole += value;
    if (at <= hour) sofar += value;
  }
  return whole === 0 ? 0 : sofar / whole;
};

/**
 * The hours of the day the bank is on charge, and nothing else about them.
 *
 * Placed to match where the charts put the power that does the charging — see
 * `gensetKwAt` for the genset blocks and `intradayKw` for the array — because the
 * level curve is drawn beside a chart of what charged it, and a bank that climbed
 * at an hour nothing was generating would be the page contradicting itself.
 *
 * Fixed windows rather than a phase spread on the site id. The estate is spread by
 * how *deep* each bank cycles instead (see `bankCycle`), which varies the levels
 * without moving a site's charging to an hour its plant is not running.
 */
const chargeWindows = (
  seed: SiteSeed,
  role: SitePowerRole,
  dayKwh: number,
): Array<{from: number; to: number}> => {
  if (!hasSolar(role)) {
    // Two blocks a day, before dawn and in the late afternoon — the placement
    // `gensetKwAt` uses, which is why this bank has two peaks a day.
    return [
      {from: FIRST_LIGHT - 3.5, to: FIRST_LIGHT},
      {from: 16, to: 19.5},
    ];
  }

  const windows: Array<{from: number; to: number}> = [];

  /**
   * A pre-dawn block on a day the roof cannot cover, and none on a day it can.
   *
   * The same test `gensetDay` makes, in energy rather than in hours: the day needs
   * its load raised for what storage loses on the way through, and whatever the
   * array does not raise, diesel does. A bright day gets no block and the bank's
   * night is a straight run down to first light.
   */
  const neededKwh =
    seed.loadKw * HOURS_PER_DAY * (DIRECT_SHARE + (1 - DIRECT_SHARE) / ROUND_TRIP);
  if (dayKwh < neededKwh) windows.push({from: FIRST_LIGHT - 2.5, to: FIRST_LIGHT});

  /**
   * And the middle of the day, where the array makes more than the tower draws.
   *
   * Scanned rather than solved. The crossing depends on the day's energy, the
   * cubed-sine shape and the load's own shallow curve, and a quarter-hour scan
   * finds it in 96 steps without any of the three having to be inverted.
   */
  let from: number | undefined;
  let to: number | undefined;
  for (let hour = 0; hour < HOURS_PER_DAY; hour += 0.25) {
    if (intradayKw(dayKwh, hour) > seed.loadKw * loadShape(hour)) {
      from ??= hour;
      to = hour + 0.25;
    }
  }
  if (from !== undefined && to !== undefined) windows.push({from, to});

  return windows;
};

/**
 * The day's solar energy, kept for the next sample of the same day.
 *
 * `todayFullKwh` is the expensive call in this file — it goes through `solarDays`,
 * which models twelve months and then weights every day of one of them — and it is
 * asked for *the same day* once per sample by every chart that walks a clock. The
 * bank's mean level over a year is 2,880 samples across 365 days; this makes it 365
 * reads instead of 2,880, and the year view of that chart goes from seconds to
 * something a reader does not notice.
 *
 * Read at a synthetic **noon**, which is what makes it a property of the day: the
 * function divides by the share of the day that has elapsed, so it answers `0` at
 * any hour before first light. Noon is the same trick `dayTrend` uses. Nothing
 * downstream can tell the difference — the intraday shape is zero outside daylight
 * either way — and the cycle below *needs* one answer per day rather than a
 * different one every half-hour of the same night.
 *
 * One slot, because the access pattern is a walk: a day is asked for repeatedly and
 * then never again. A miss recomputes exactly what a hit returns, so this is not
 * state a reader could observe.
 */
let dayEnergyCache: {key: string; kwh: number} | undefined;

export const dayEnergyKwh = (seed: SiteSeed, role: SitePowerRole, dayStart: number): number => {
  const key = `${seed.id}|${role}|${dayStart}`;
  if (dayEnergyCache?.key === key) return dayEnergyCache.kwh;

  const kwh = todayFullKwh(seed, role, dayStart + 12 * 3_600_000);
  dayEnergyCache = {key, kwh};
  return kwh;
};

/**
 * And the windows that follow from it, on the same terms.
 *
 * Kept for the same reason and keyed the same way: the crossing where the array
 * overtakes the tower is a property of the day, and scanning for it once per sample
 * was ninety-six steps to arrive at the answer the last sample already had.
 */
let windowCache: {key: string; windows: Array<{from: number; to: number}>} | undefined;

const windowsForDay = (
  seed: SiteSeed,
  role: SitePowerRole,
  dayStart: number,
): Array<{from: number; to: number}> => {
  const key = `${seed.id}|${role}|${dayStart}`;
  if (windowCache?.key === key) return windowCache.windows;

  /**
   * The day's solar energy, read at a synthetic **noon**.
   *
   * `todayFullKwh` divides by the share of the day that has elapsed, so it answers
   * `0` at any hour before first light — which would have this function compute a
   * different cycle for every sample of the same night, and the curve would be
   * assembled from twenty different models. Noon of the day in question is the same
   * trick `dayTrend` uses, and for the same reason: the day's energy is a property
   * of the day, not of the hour being asked about.
   */
  const windows = chargeWindows(seed, role, dayEnergyKwh(seed, role, dayStart));
  windowCache = {key, windows};
  return windows;
};

/**
 * State of charge, as **two straight lines**: one rate up, a different rate down.
 *
 * ## Why it is not a sine any more
 *
 * Because a bank does not charge and discharge at the same rate, and a cosine says
 * it does. The cycle here was `0.5 − 0.5cos(…)`, which is symmetric by
 * construction: every site's bank fell as gently as it rose, spent the same eight
 * hours doing each, and had no hour where anything in particular was happening. A
 * real telecom bank does the opposite — it is charged hard for a few hours by
 * something rated to charge it, and then trickles down for the rest of the day at
 * whatever the tower draws. That asymmetry is the shape of the whole day, and it
 * was the one thing the old curve could not show.
 *
 * So: **a constant rate inside a charging window, a different constant rate
 * outside it.** Both linear, which is what a bank looks like at half-hour
 * resolution; the interesting number is the *ratio* between them, and it is not a
 * parameter — it is `discharge hours / charge hours`, which falls out of the
 * windows. A diesel hybrid charging for seven hours and coasting for seventeen
 * climbs about two and a half times faster than it falls, and the curve says so
 * without being told.
 *
 * ## The swing, and the one place this is scaled rather than derived
 *
 * The honest discharge rate is `loadKw / usable kWh` — the tower's draw out of the
 * energy the pack still holds. At these sites that comes to nearly the whole bank
 * across a night, which would run every site down to its shed line by dawn and
 * flatten the bottom of every curve against it. What a plant actually does then is
 * start its set earlier; what this prototype does is **fit the cycle to the bank's
 * operating window** — the swing is capped at floor-to-ceiling and both rates are
 * scaled by the same factor, so the shape, the ratio and the two straight lines all
 * survive and only the absolute slope is compressed. It is stated here rather than
 * hidden because it is the one figure on the curve that is not a measurement.
 *
 * The floor is where the estate is spread: banks at different sites sit at
 * different depths, which is what the phase offset used to be for.
 */
const bankCycle = (
  seed: SiteSeed,
  role: SitePowerRole,
  plant: HybridPlant,
  hour: number,
  dayStart: number,
): {soc: number; kw: number} => {
  const windows = windowsForDay(seed, role, dayStart);

  const chargeHours = windows.reduce((sum, window) => sum + (window.to - window.from), 0);
  const dischargeHours = HOURS_PER_DAY - chargeHours;

  // Never a full bank and never an empty one: a lithium bank is held inside its
  // window, and a demo that showed 100% would be showing a system with nowhere to
  // put the next kilowatt-hour.
  const CEILING = 0.9;
  const floor = 0.34 + spread(seed.id, 'hybrid/soc-floor') * 0.14;

  const usableKwh = plant.batteryKwh * plant.soh;
  if (chargeHours <= 0 || dischargeHours <= 0 || usableKwh <= 0) {
    return {soc: floor, kw: 0};
  }

  const swing = CEILING - floor;
  const rawDischarge = seed.loadKw / usableKwh;
  // Capped so the cycle fits the window rather than running into the shed line —
  // see the note above. The ratio between the two rates is untouched by this.
  const dischargeRate = Math.min(rawDischarge, swing / dischargeHours);
  const chargeRate = (dischargeRate * dischargeHours) / chargeHours;

  const charging = windows.some((window) => hour >= window.from && hour < window.to);

  /** Charge gained less charge spent between midnight and `at`, as a fraction. */
  const raw = (at: number): number => {
    let charged = 0;
    for (const window of windows) {
      charged += Math.max(0, Math.min(window.to, at) - window.from);
    }
    return charged * chargeRate - (at - charged) * dischargeRate;
  };

  /**
   * The day's low, so the floor can be pinned to it.
   *
   * `raw` only ever turns upward at the start of a charging window, so its minimum
   * is at one of those or at midnight — four values to check rather than a walk of
   * the day. The walk sums to zero over 24 hours by construction, so pinning the
   * low also makes the cycle repeat.
   */
  const low = Math.min(0, ...windows.map((window) => raw(window.from)));

  return {
    soc: Math.min(CEILING, floor + raw(hour) - low),
    kw: (charging ? chargeRate : -dischargeRate) * usableKwh,
  };
};

export const hybridState = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): HybridState => {
  const plant = hybridPlant(seed, role);
  if (plant.batteryKwh === 0) return {solarKw: 0, soc: 0, batteryKw: 0, hoursLeft: 0};

  const asked = new Date(now);
  const hour = asked.getHours() + asked.getMinutes() / 60;
  const dayStart = new Date(asked.getFullYear(), asked.getMonth(), asked.getDate()).getTime();
  // Read off **today's own energy**, not off nameplate.
  //
  // This used to be `solarKwp × performanceRatio × shape`, which was a different
  // model from the one every other figure here uses and disagreed with it by a
  // factor of two and a half: the diagram showed a 29 kWp array putting out
  // 22 kW while the energy model had the same array making 70 kWh across the
  // whole day, which is a peak of about 14. One of them was wrong and it was the
  // one with no day's energy behind it. Now the curve is the day's kilowatt-hours
  // spread over the day's shape, so the node on the diagram, the bar on the daily
  // chart and the month's total are three readings of one quantity.
  const solarKw = Math.round(intradayKw(dayEnergyKwh(seed, role, dayStart), hour) * 10) / 10;

  const cycle = bankCycle(seed, role, plant, hour, dayStart);
  const soc = cycle.soc;

  /**
   * The bank's own flow, from the cycle rather than from the array alone.
   *
   * It used to be `solar − load`, which was right at a solar hybrid in daylight
   * and wrong everywhere else: at a diesel hybrid it has no solar term at all, so
   * it reported the bank discharging at the site's load *while the set was
   * charging it* — the badge on the battery page said `Discharging 3 kW` at four in
   * the morning, over a curve climbing steeply. Reading it off the same cycle that
   * draws the curve is what makes the node on the diagram, the badge and the slope
   * three readings of one quantity.
   */
  const batteryKw = Math.round(-cycle.kw * 10) / 10;

  // Energy the tower can actually have: the bank's specified kilowatt-hours, taken
  // down to what the pack still holds, then down again to the shed line. Divided by
  // the site's own draw, because "the bank alone" is what autonomy has always meant
  // here — an array carrying part of the load at two in the afternoon does not make
  // the bank's reserve any longer.
  const usableKwh = plant.batteryKwh * plant.soh * Math.max(0, soc - SHED_FLOOR);
  const hoursLeft = Math.round((usableKwh / seed.loadKw) * 10) / 10;

  return {solarKw, soc, batteryKw, hoursLeft};
};

/**
 * Thirty days of energy at one site, and the diesel it did or did not cost.
 *
 * `solarKwh` and `gensetKwh` are **generation**, not what served the load. They
 * add up to more than the load did, and the difference is the storage loss —
 * which is the honest way to draw it: a battery is not a source, it is a delay.
 * An earlier sketch of this reported a three-way "solar / battery / diesel" split
 * of the load, and it double-counted every kilowatt-hour that passed through the
 * bank.
 */
export type SiteEnergy = {
  /** What the tower drew, kWh. */
  loadKwh: number;
  /** Generation that had to be raised to serve it, load plus storage losses. */
  generationKwh: number;
  /** What the array made, kWh — the meter. */
  solarKwh: number;
  gensetKwh: number;
  /** Grid import, kWh — only ever non-zero at a grid-backed site. */
  mainsKwh: number;
  /** Diesel the genset actually burned, litres. */
  litres: number;
  /** Solar's share of generation, `0`–`1`. */
  solarShare: number;
  /** Engine hours over the window. */
  gensetHours: number;
};

/**
 * The loading a genset holds at this site while it is running.
 *
 * At a hybrid it is charging, so it sits near its best point by design. At a
 * prime or grid-backed site it carries the tower and takes whatever loading that
 * happens to be — which is what makes the litres real, so it is derived from the
 * two real figures rather than assumed.
 */
const runningLoadFraction = (seed: SiteSeed, role: SitePowerRole, ratedKw: number): number => {
  if (hasBattery(role)) return CHARGING_LOAD_FRACTION;
  return ratedKw > 0 ? Math.min(1, seed.loadKw / ratedKw) : CHARGING_LOAD_FRACTION;
};

/**
 * @param ratedKw Nameplate of the plant standing at this site, from the fleet.
 *   Passed in rather than read here, because this module knows about places and
 *   the fleet knows about machines — and a site with nothing fitted has to be
 *   able to report its energy anyway.
 */
export const siteEnergy = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
): SiteEnergy => {
  const loadKwh = seed.loadKw * HOURS_PER_DAY * WINDOW_DAYS;

  // Generation has to cover the load plus whatever the stored share loses on the
  // way through. A site with no bank loses nothing, which is why this collapses to
  // the load itself at a prime or grid-backed site.
  const storedShare = hasBattery(role) ? 1 - DIRECT_SHARE : 0;
  const generationKwh = Math.round(
    loadKwh * (1 - storedShare) + (loadKwh * storedShare) / ROUND_TRIP,
  );

  const plant = hybridPlant(seed, role);
  const sunHours = customer(seed.customer).peakSunHours;

  // What the physics says this much glass raises: nameplate × sun hours ×
  // performance ratio × days. Capped at what the site can actually use, because
  // spill is real at a solar site and counting it would report generation no
  // meter downstream of the array ever saw — this is energy the tower could take,
  // not energy that fell on the roof.
  //
  // Local, and it stays local. It is the *generator* of the figure below, not a
  // number this app publishes: nothing outside this function is allowed to hold
  // it up beside the measurement and call the gap a verdict.
  const rawSolarKwh = Math.min(
    generationKwh,
    Math.round(plant.solarKwp * sunHours * PERFORMANCE_RATIO * WINDOW_DAYS),
  );

  // What it actually made. `solarPerformance` is the state of the roof — see its
  // own note — and the genset below picks up whatever the array did not, so a
  // poorly performing site burns more diesel for the same load. Clamped for the
  // same reason the figure above it is.
  const solarKwh =
    rawSolarKwh === 0
      ? 0
      : Math.min(generationKwh, Math.round(rawSolarKwh * solarPerformance(seed, role)));

  // The grid carries a backed-up site apart from the few hours a year it doesn't.
  // 0.4% is roughly a day and a half of outage across a month, which is the order
  // of a Malaysian distribution feeder in a bad month.
  const mainsKwh = role === 'GRID_BACKUP' ? Math.round(generationKwh * 0.996) : 0;
  const gensetKwh = Math.max(0, generationKwh - solarKwh - mainsKwh);

  const loadFraction = runningLoadFraction(seed, role, ratedKw);
  const litres = Math.round(gensetKwh * sfcLitresPerKwh(loadFraction));

  // Engine hours follow from the energy and the loading, which is the only way
  // they can agree with the litres above them.
  const gensetHours =
    ratedKw > 0 && loadFraction > 0
      ? Math.round(gensetKwh / (ratedKw * loadFraction))
      : 0;

  return {
    loadKwh: Math.round(loadKwh),
    generationKwh,
    solarKwh,
    gensetKwh,
    mainsKwh,
    litres,
    solarShare: generationKwh > 0 ? solarKwh / generationKwh : 0,
    gensetHours,
  };
};

export type EstateEnergy = {
  /** Sites with a battery — the ones this screen has anything to say about. */
  hybridSites: number;
  solarSites: number;
  dieselSites: number;
  solarKwh: number;
  gensetKwh: number;
  litres: number;
  /** Solar's share of off-grid generation, `0`–`1`. */
  solarShare: number;
};

/**
 * The same arithmetic across the estate, for the overview's energy band.
 *
 * **Grid-backed sites are excluded from every figure here.** They burn almost no
 * diesel and generate almost nothing, so including them would dilute the
 * programme's own figures with a pile of sites it was never about — a solar share
 * that falls every time the carrier builds a tower in a town.
 */
export const estateEnergy = (
  roles: Record<string, SitePowerRole>,
  ratedKwBySite: Record<string, number>,
): EstateEnergy => {
  let solarKwh = 0;
  let gensetKwh = 0;
  let litres = 0;
  let hybridSites = 0;
  let solarSites = 0;
  let dieselSites = 0;

  for (const seed of siteSeeds()) {
    const role = roles[seed.id] ?? seed.powerRole;
    if (role === 'GRID_BACKUP') continue;

    if (hasSolar(role)) solarSites += 1;
    if (hasBattery(role)) hybridSites += 1;
    else dieselSites += 1;

    const energy = siteEnergy(seed, role, ratedKwBySite[seed.id] ?? 0);
    solarKwh += energy.solarKwh;
    gensetKwh += energy.gensetKwh;
    litres += energy.litres;
  }

  const generation = solarKwh + gensetKwh;

  return {
    hybridSites,
    solarSites,
    dieselSites,
    solarKwh,
    gensetKwh,
    litres,
    solarShare: generation > 0 ? solarKwh / generation : 0,
  };
};

// ─── The generation chart's series ───────────────────────────────────────────

/**
 * How much of a year's irradiance falls in each month, as a multiple of the
 * annual average.
 *
 * Malaysia's seasonality is mild and it is real: the north-east monsoon takes
 * November and December down about a tenth, and February and March are the best
 * months of the year. It is stated month by month for exactly this reason: one
 * flat annual rate would make every site look poor every December and strong
 * every March, when all that has changed is the sky.
 *
 * The twelve factors sum to 12, so a year of them comes to the same total as
 * twelve months at the annual-average rate. That is what keeps the chart's yearly
 * figure and the thirty-day one on the tiles above it talking about the same
 * array.
 */
const MONTH_FACTOR = [0.98, 1.06, 1.07, 1.03, 1.01, 1.02, 1.03, 1.02, 0.99, 0.97, 0.92, 0.9];

const DAYS_IN_MONTH = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

/**
 * One bar on a generation chart, at whatever grain the chart is drawn at.
 *
 * One series and one only. This type used to carry a nullable `expectedKwh`
 * beside the measurement, and every chart, caption and legend downstream of it
 * had a second, conditional half. All of it is gone: the charts draw **what the
 * array made**, and nothing on screen holds that up against a target.
 *
 * `SolarMonth` is the monthly case, so a `SolarMonth` is usable anywhere a
 * `SolarBucket` is asked for.
 */
export type SolarBucket = {
  at: string;
  label: string;
  actualKwh: number;
  inProgress: boolean;
};

export type SolarMonth = {
  /** First of the month, ISO — the key, and what a tooltip stamps. */
  at: string;
  /** `Mar`, and `Mar 26` in January so a twelve-month axis reads unambiguously. */
  label: string;
  /** What the array made. Partial in the running month. */
  actualKwh: number;
  /**
   * This month is still running.
   *
   * Carried rather than inferred by the chart, because a month eleven days old
   * has made eleven days of energy and stands next to eleven whole ones. It is
   * drawn hatched and left out of every total, so a reader is never invited to
   * compare it with the bar beside it.
   */
  inProgress: boolean;
};

/**
 * When this array's output stepped down, as a month index into the series, or
 * `null` for one that never did.
 *
 * The reason the chart is worth drawing rather than tabulating. An array that has
 * been flat all year is one thing; one that ran at a level until May and has been
 * a fifth below it since is a fault with a date on it, and somebody can go and
 * look at what happened that month.
 *
 * Arrays in good shape never stepped: their month-to-month wobble is weather, and
 * inventing an event for it would put a date on noise.
 */
const healthOnsetMonth = (seed: SiteSeed, health: number): number | null =>
  health > 0.95 ? null : 3 + Math.floor(spread(seed.id, 'hybrid/onset') * 6);

/**
 * The step in this array's output: when it happened, and how deep it is.
 *
 * Exported because the **fault model reads it**. `darkStrings` in the solar
 * module turns the depth of the step into a count of dark strings, and the health
 * band dates its string alert from `label`. Handing both
 * the seeded fact directly is what keeps the count, the date and the shape of the
 * series three readings of one event rather than three derivations of it.
 *
 * `depth` is `0`–`1`: the share of output the array lost at the step. An array
 * that never stepped returns `undefined` rather than a depth of zero — those are
 * different claims, and only one of them dates a fault.
 */
export type SolarStep = {
  /** First of the month it stepped, ISO. */
  at: string;
  /** `Mar` — the same label the series uses, so the two cannot disagree. */
  label: string;
  depth: number;
};

/**
 * How far output has to drop before the drop is a **fault** rather than a dip.
 *
 * `healthOnsetMonth` fires at anything below 0.95, and that is the right gate for
 * the *series*: an array a few points off should visibly sag, because arrays do.
 * It is the wrong gate for the fault model. Month-to-month weather here runs
 * ±7%, so a 4% step is inside the noise — calling it dark strings would put a
 * fault with an address on every array on the estate, which is exactly what it
 * did when this threshold was missing.
 *
 * A tenth is the line, and it is the one the old design comparison drew from the
 * other side: a month more than a tenth short that never recovered. The test has
 * moved from reading a quotient back off the series to asking the seed, and the
 * threshold came with it so the estate reads the same.
 */
const STEP_IS_A_FAULT = 0.1;

export const solarStep = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): SolarStep | undefined => {
  if (!hasSolar(role)) return undefined;

  const health = solarPerformance(seed, role);
  const onset = healthOnsetMonth(seed, health);
  if (onset === null) return undefined;

  const depth = Math.max(0, 1 - health);
  if (depth < STEP_IS_A_FAULT) return undefined;

  const months = solarMonths(seed, role, now);
  const month = months[onset];
  if (month === undefined) return undefined;

  return {at: month.at, label: month.label, depth};
};

/**
 * Twelve months of generation, oldest first.
 *
 * Monthly and no finer at this level, because that is the grain the seasonality
 * is stated at — `MONTH_FACTOR` — and the daily series below is derived from
 * these totals rather than dealt beside them.
 */
/**
 * The last twelve months, kept for the next caller who asks on the same date.
 *
 * The third slot of the same kind, and the one that pays for the other two: this
 * function is what `solarDays` runs to place a single day, so a chart walking a
 * year of days ran the whole twelve-month model once per day. It depends on `now`
 * only to know which month is running and how much of it has passed — day
 * granularity — so the date is the whole of the key.
 *
 * Returned **by reference**, which is the one thing to be careful about: callers
 * read these buckets and must not write to them. Every one of them maps or sums.
 */
let monthsCache: {key: string; months: Array<SolarMonth>} | undefined;

export const solarMonths = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): Array<SolarMonth> => {
  const plant = hybridPlant(seed, role);
  if (plant.solarKwp === 0) return [];

  const asked = new Date(now);
  const key = `${seed.id}|${role}|${asked.getFullYear()}-${asked.getMonth()}-${asked.getDate()}`;
  if (monthsCache?.key === key) return monthsCache.months;

  const sunHours = customer(seed.customer).peakSunHours;
  const health = solarPerformance(seed, role);
  const onset = healthOnsetMonth(seed, health);

  const today = new Date(now);
  const months: Array<SolarMonth> = [];

  for (let index = 0; index < 12; index += 1) {
    // Walk back from the running month, so the series always ends on today.
    const cursor = new Date(today.getFullYear(), today.getMonth() - (11 - index), 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const days = DAYS_IN_MONTH(year, month);
    const inProgress = index === 11;

    // What this much glass raises in an ordinary month of this month's weather.
    // Local: it is the generator of the figure below and is never published.
    const baseKwh = plant.solarKwp * sunHours * PERFORMANCE_RATIO * days * MONTH_FACTOR[month];

    // Weather on top, health underneath. The two stay separate multipliers: one is
    // a month that was cloudier than usual and the other is the array itself, and
    // folding them together would lose the *step* — the one shape in this series
    // that means somebody should go and look.
    const weather = spreadBetween(seed.id, `hybrid/weather-${year}-${month}`, 0.93, 1.07);
    const healthNow = onset === null || index < onset ? 1 : health;

    // The running month is prorated to the days it has actually had. It is the one
    // bar on the chart that is not comparable to the one beside it, which is why
    // `inProgress` travels with it.
    const elapsed = inProgress ? today.getDate() / days : 1;

    months.push({
      at: cursor.toISOString(),
      label:
        month === 0
          ? `${cursor.toLocaleDateString('en-MY', {month: 'short'})} ${String(year).slice(2)}`
          : cursor.toLocaleDateString('en-MY', {month: 'short'}),
      actualKwh: Math.round(baseKwh * weather * healthNow * elapsed),
      inProgress,
    });
  }

  monthsCache = {key, months};
  return months;
};

// ─── The daily grain ─────────────────────────────────────────────────────────

/**
 * How a month's generation is spread across its days.
 *
 * A weight per day from the site id and the date, then **normalised so the days
 * sum back to the month's own total**, to within the rounding of a whole
 * kilowatt-hour per day. The normalisation is the rule that matters: it means a
 * reader can switch the chart from 12M to 30D and the bars they are looking at
 * still belong to the same figure on the tile above. A daily series dealt
 * independently of the monthly one would drift by a real margin, and the first
 * person to add up a week would find the two disagreeing.
 *
 * The spread is wide — a day can be a third of a good one — because that is what
 * daily solar in this climate does. A monsoon afternoon is not a rounding error,
 * and a daily chart drawn with monthly smoothness would tell a reader their array
 * was faultless on a day it was rained off.
 */
const dayWeight = (siteId: string, at: Date): number =>
  spreadBetween(
    siteId,
    `hybrid/day-${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`,
    0.35,
    1.25,
  );

/**
 * Daily generation across a window, oldest first.
 *
 * Today is marked `inProgress` for the same reason the running month is — the sun
 * has not finished setting on it — so it is hatched and left out of any total.
 */
export const solarDays = (
  seed: SiteSeed,
  role: SitePowerRole,
  fromMs: number,
  toMs: number,
  now: number = Date.now(),
): Array<SolarBucket> => {
  const months = solarMonths(seed, role, now);
  if (months.length === 0) return [];

  // The month's actual, by `year-month`, so each day can be scaled into its own
  // month's total rather than into an average one.
  const monthTotal = new Map<string, number>();
  for (const month of months) {
    const at = new Date(month.at);
    monthTotal.set(`${at.getFullYear()}-${at.getMonth()}`, month.actualKwh);
  }

  const buckets: Array<SolarBucket> = [];
  const today = new Date(now);
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  for (let cursor = new Date(fromMs); cursor.getTime() <= toMs; cursor.setDate(cursor.getDate() + 1)) {
    const day = new Date(cursor);
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const total = monthTotal.get(key);
    if (total === undefined) continue;

    // Normalise against every day of *this* month, not against the window, so the
    // same day reads the same whether the reader asked for a week or a month.
    const days = DAYS_IN_MONTH(day.getFullYear(), day.getMonth());
    let weightSum = 0;
    for (let index = 1; index <= days; index += 1) {
      weightSum += dayWeight(seed.id, new Date(day.getFullYear(), day.getMonth(), index));
    }

    const isToday = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` === todayKey;
    // Today's bar is the energy that has actually arrived, which is the day's
    // shape integrated to now rather than a fraction of the clock. See
    // `elapsedShare`.
    const arrived = isToday
      ? elapsedShare(today.getHours() + today.getMinutes() / 60)
      : 1;
    // A month still running has already been prorated to the days it has had, so
    // its daily total has to be shared over those days rather than over all of
    // them, or every day of the current month reads short by the same fraction.
    const elapsed = day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth()
      ? today.getDate() / days
      : 1;

    buckets.push({
      at: day.toISOString(),
      label: day.toLocaleDateString('en-MY', {day: 'numeric', month: 'short'}),
      actualKwh: Math.round((total / elapsed / weightSum) * dayWeight(seed.id, day) * arrived),
      inProgress: isToday,
    });
  }

  return buckets;
};

/**
 * What this array will make across the **whole** of today, kWh.
 *
 * The full day, not the part of it that has happened. That distinction is the one
 * this pair of functions exists to keep straight: the intraday curve needs the
 * whole day's energy to know how tall it is at noon, and the daily bar needs the
 * part that has arrived. Deriving the second from the first — `× elapsedShare` —
 * is what stops the two disagreeing, which they did when a flat 0.55 stood in for
 * both.
 */
export const todayFullKwh = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): number => {
  const share = elapsedShare(new Date(now).getHours() + new Date(now).getMinutes() / 60);
  return share <= 0 ? 0 : todaySoFarKwh(seed, role, now) / share;
};

/**
 * What this array has made **so far today**, kWh — today's bar on the daily chart.
 *
 * Exported because two screens print it beside the intraday curve, and the
 * obvious way to get it there is to integrate the curve in the component. That is
 * how the figure ended up 7% adrift of the bar in the chart above it: adding up
 * half-hourly readings as rectangles overshoots a rising curve, so the readout
 * and the bar were two different arithmetic of the same day. One function, one
 * answer, and the curve is drawn from the same day's energy.
 */
export const todaySoFarKwh = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): number => {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return solarDays(seed, role, start, start, now)[0]?.actualKwh ?? 0;
};

/** A point on the intraday power curve. */
export type SolarPoint = {
  /** Hours since midnight, `6`–`20`. */
  hour: number;
  /** `13:30`. */
  label: string;
  /** Output at this moment, kW. `null` after now — the day has not happened yet. */
  kw: number | null;
  /**
   * What this array does at this time on an ordinary day lately, kW.
   *
   * **The array's own baseline.** Built from the array's own recent output, so
   * it answers "has this thing changed" — the only comparison a half-hourly curve
   * can honestly carry, and the only one this app makes anywhere.
   */
  typicalKw: number;
};

/**
 * Today's power curve, half-hourly from first light to last.
 *
 * `kw` is `null` after the current moment rather than `0`, so the line stops
 * where the record does. A curve drawn to zero across the rest of the afternoon
 * reports an array that has failed, which at 10am is every array on the estate.
 */
export const solarIntraday = (
  seed: SiteSeed,
  role: SitePowerRole,
  now: number = Date.now(),
): Array<SolarPoint> => {
  const plant = hybridPlant(seed, role);
  if (plant.solarKwp === 0) return [];

  const today = new Date(now);
  const nowHour = today.getHours() + today.getMinutes() / 60;
  const dayKwh = todayFullKwh(seed, role, now);

  // The baseline is the month's own average day, which is the array's recent
  // normal by construction — the month's actual energy divided by the days it
  // has had. Today is excluded from it: a day cannot be its own normal.
  const months = solarMonths(seed, role, now);
  const running = months[months.length - 1];
  // The running month's actual is already prorated to the days it has had, so
  // scaling it back up by `days / date` recovers the month's own daily average
  // rather than an average diluted by the days it has not reached.
  const days = DAYS_IN_MONTH(today.getFullYear(), today.getMonth());
  const typicalKwh =
    running === undefined ? dayKwh : (running.actualKwh * (days / today.getDate())) / days;

  const points: Array<SolarPoint> = [];
  for (let hour = FIRST_LIGHT - 1; hour <= LAST_LIGHT + 1; hour += 0.5) {
    points.push({
      hour,
      label: `${String(Math.floor(hour)).padStart(2, '0')}:${hour % 1 === 0 ? '00' : '30'}`,
      kw: hour <= nowHour ? Math.round(intradayKw(dayKwh, hour) * 10) / 10 : null,
      typicalKw: Math.round(intradayKw(typicalKwh, hour) * 10) / 10,
    });
  }

  return points;
};
