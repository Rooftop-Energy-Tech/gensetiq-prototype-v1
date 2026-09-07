import {hasSolar} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';
import {dayEnergyKwh, intradayKw, loadShape, siteEnergy} from './hybrid';
import type {SiteSeed} from './siteSeed';

/**
 * How a site spends a day: what it draws, what its set runs, and which source is
 * putting the surplus into the bank.
 *
 * ## Why these live on their own rather than in `siteOverview`
 *
 * Because three charts need them now. The load composition, the charge mix and the
 * **colour of the bank's level curve** are all readings of one dispatch — solar
 * serves the tower first, the set covers what is left, the surplus charges — and
 * that model was private to the file that happened to need it first. Once the level
 * chart had to name the source charging it, the alternative to a shared module was
 * `siteTrend` importing `siteOverview` while `siteOverview` imported `siteTrend`
 * for the load shape: a cycle, over a model neither of them owns.
 *
 * Nothing here is seeded and nothing is re-derived — every function is a reading
 * off `hybrid.ts`, which is the rule that file states about itself.
 */

const HOURS_PER_DAY = 24;

/** Midnight local on the day `at` falls in. */
const startOfDay = (at: number): number => {
  const day = new Date(at);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
};

/**
 * The whole of one day's solar energy, kWh — including a day still in progress.
 *
 * `dayEnergyKwh` under another name, and re-exported rather than re-derived: it
 * reads the day at a synthetic noon (the day's energy is a property of the day, not
 * of the hour asked about) and it keeps the last day it was asked for, which is
 * what makes a forty-eight sample walk one model run instead of forty-eight. See
 * its own note.
 */
export const fullDayKwh = dayEnergyKwh;

/**
 * What one genset block looks like at this site, and how long it has to run today.
 *
 * ## Why the genset is modelled here rather than read from its run log
 *
 * Because the run log cannot be made to balance. `history.ts` deals every genset a
 * history from a hash of its id — it has never heard of an array or a bank — and
 * `hybrid.ts` says so plainly in its own header, along with the rule that follows:
 * the two models never appear on one screen. The metric picker honours that by
 * showing them one at a time. **This chart cannot**, because its whole claim is
 * that the four series add up, and a genset curve dealt from an unrelated hash
 * would break that claim at every sample.
 *
 * So the block is derived from `siteEnergy`, which is the same chain the array and
 * the load come from:
 *
 * - **How hard it runs** is `gensetKwh / gensetHours` — the two figures
 *   `siteEnergy` already publishes together, so the loading here and the litres on
 *   the energy report are the same arithmetic rather than two guesses at it.
 * - **How long it runs** is whatever the day's array did not cover. A solar hybrid's
 *   genset is described in `site.type` as *the backstop for a run of dull days*, and
 *   this is that sentence as a function: a bright day needs no block at all, and a
 *   week of monsoon puts one in every morning.
 *
 * The consequence a reader should expect is that **this chart's genset and the
 * genset's own page disagree**, and that is the seam `hybrid.ts` already documents
 * rather than a new one. It is on the open-questions list.
 */
export const gensetDay = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  dayStart: number,
): {blockKw: number; hours: number} => {
  const energy = siteEnergy(seed, role, ratedKw);
  if (energy.gensetHours <= 0 || energy.gensetKwh <= 0) return {blockKw: 0, hours: 0};

  const blockKw = energy.gensetKwh / energy.gensetHours;

  /**
   * What the day needed *raised*, which is more than the tower drew.
   *
   * Read as a ratio off `siteEnergy` rather than restating the round-trip and
   * direct-share constants here — those live in `hybrid.ts` and a second copy of
   * them is how the two would come to disagree about how lossy the bank is.
   */
  const raise = energy.loadKwh > 0 ? energy.generationKwh / energy.loadKwh : 1;
  const neededKwh = seed.loadKw * HOURS_PER_DAY * raise;
  const solarKwh = hasSolar(role) ? fullDayKwh(seed, role, dayStart) : 0;

  const deficitKwh = Math.max(0, neededKwh - solarKwh);
  return {blockKw, hours: Math.min(HOURS_PER_DAY, deficitKwh / blockKw)};
};

/**
 * Is the set turning at `hour`, and at what output.
 *
 * ## Where the block is placed, and why it is not dealt at random
 *
 * A solar hybrid charges off the roof, so its genset only ever runs at the bottom of
 * the night — the block is laid so it **ends at first light**, which is both where
 * the bank is lowest and where an operator would expect to find it. A diesel hybrid
 * has no roof, so `hybrid.ts` gives it *two charging blocks a day* and its state of
 * charge is modelled on a twelve-hour cycle with two peaks; the two blocks here are
 * placed to match, one before dawn and one in the late afternoon, so the bank's
 * level on the picker and the bank's charging on this chart rise together instead
 * of at unrelated hours.
 *
 * Fixed hours rather than a spread on the site id, deliberately: the point of this
 * chart is that the four curves explain each other, and a block dealt to an
 * arbitrary hour would make the bank appear to charge for no visible reason.
 */
export const gensetKwAt = (
  role: SitePowerRole,
  block: {blockKw: number; hours: number},
  hour: number,
): number => {
  if (block.blockKw === 0 || block.hours === 0) return 0;

  const FIRST_LIGHT = 7;
  if (hasSolar(role)) {
    const from = Math.max(0, FIRST_LIGHT - block.hours);
    return hour >= from && hour < FIRST_LIGHT ? block.blockKw : 0;
  }

  // Two blocks, half the hours each, matching the diesel hybrid's two-peak cycle.
  const half = block.hours / 2;
  const morning = hour >= Math.max(0, FIRST_LIGHT - half) && hour < FIRST_LIGHT;
  const evening = hour >= 16 && hour < Math.min(24, 16 + half);
  return morning || evening ? block.blockKw : 0;
};


/**
 * Which source is charging the bank at `at`, if either is.
 *
 * The surplus, attributed. A source's output above what the tower is drawing is
 * what reaches the bank — the same clipping `siteOverview` draws as its charge mix
 * — and this is the one figure that composition reduces to: the name of whichever
 * source is putting the most in.
 *
 * ## Why it is the larger share rather than both
 *
 * Because it exists to colour a stretch of the level curve, and a curve is one
 * colour at a time. The two sources overlap for at most a few minutes at a solar
 * hybrid — the block ends at first light, which is roughly where the array picks
 * up — so "the larger" is nearly always "the only one", and the alternative was a
 * third colour for a state that lasts one sample.
 *
 * `undefined` where nothing has anything over: the bank is holding or discharging,
 * and the curve should stay in the bank's own colour.
 */
export const chargeSourceAt = (
  seed: SiteSeed,
  role: SitePowerRole,
  ratedKw: number,
  at: number,
): 'SOLAR' | 'GENSET' | undefined => {
  const dayStart = startOfDay(at);
  const hour = (at - dayStart) / 3_600_000;

  const solarKw = hasSolar(role) ? intradayKw(fullDayKwh(seed, role, dayStart), hour) : 0;
  const gensetKw = gensetKwAt(role, gensetDay(seed, role, ratedKw, dayStart), hour);
  const loadKw = seed.loadKw * loadShape(hour);

  // Dispatched in the order `siteOverview` dispatches them, so a sample this calls
  // charging from solar is a sample that chart draws as solar into the bank.
  const solarToLoad = Math.min(solarKw, loadKw);
  const gensetToLoad = Math.min(gensetKw, Math.max(0, loadKw - solarToLoad));

  const solarToBank = solarKw - solarToLoad;
  const gensetToBank = gensetKw - gensetToLoad;

  // A tenth of a kilowatt: below that a "source" is the last flicker of the shape
  // either side of first light, and colouring a segment for it would put a stripe
  // of the wrong hue on the curve every dawn.
  const FLOOR = 0.1;
  if (solarToBank < FLOOR && gensetToBank < FLOOR) return undefined;
  return solarToBank >= gensetToBank ? 'SOLAR' : 'GENSET';
};
