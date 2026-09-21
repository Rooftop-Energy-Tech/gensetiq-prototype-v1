/**
 * A site's own draw over time.
 *
 * ## Why this is one small file
 *
 * It is what survives of `hybrid.ts`, which modelled a solar array, a battery bank
 * and the dispatch between them across thirteen hundred lines. GensetIQ puts a
 * genset at a yard and nothing else, so the array, the bank, their charge cycles
 * and every figure derived from them went with the modules they belonged to.
 *
 * The load did not. A site draws what it draws whatever is feeding it, and both the
 * day curve and the bucketed views are measured against this one wave — so it stays,
 * on its own, named after the thing it actually describes.
 */

/** The load's slow wave completes one cycle in this many days — the Year window. */
const LOAD_WAVE_DAYS = 365;

/**
 * The shape of a site's own draw over time, as a multiplier on its metered kW.
 *
 * One ±10% sine across **a year**, not across a day. A site's load is radios and
 * rectifiers around the clock: within any one day it is constant to the eye, and
 * what actually moves it is seasonal — traffic and ambient heat over months. So the
 * Year tab shows the one full cycle; the Month tab shows a slice of it, a slow rise
 * or fall across its thirty days; and the Day tab is flat to the pixel, sitting
 * wherever that day lands on the wave.
 *
 * Takes an absolute timestamp (ms) and is anchored to the epoch, so a given date
 * always lands on the same point of the wave no matter which chart asks.
 * `seed.loadKw` stays the mean over any full cycle; a single day's or month's energy
 * honestly runs up to ±10% off it, which is the point.
 */
export const loadShape = (at: number): number =>
  1 + 0.1 * Math.sin((at / (LOAD_WAVE_DAYS * 86_400_000)) * 2 * Math.PI);
