/**
 * Whose sites these are — for this white-label, the carrier's own network regions.
 *
 * ## Why the region hangs off the site
 *
 * A genset is owned by the estate and is *fitted* wherever it was commissioned,
 * and the second of those is the one an operator asks about: "how many sets have
 * we got in Sarawak" means "at the Sarawak region's sites". So a region owns
 * **sites**, and a genset takes its region from the site it stands at — the same
 * direction `locationLabel` already travels, and for the same reason. A region id
 * seeded onto each genset would be a second copy of a fact the site already
 * states, and detaching a set would then leave a machine in the workshop still
 * claiming a region's name.
 *
 * The consequence is deliberate: **a set not fitted anywhere has no region**, and
 * the summary cards count it under "Workshop" rather than inventing an owner.
 *
 * ## Why the roster is a table rather than free text on the seed
 *
 * The cards group by region and the filter chips key off it, so the identity has
 * to be stable across renames. Order here is the order the chips appear in,
 * deliberately *not* alphabetical and not by size: peninsular north to south, then
 * across to Borneo, the way a network operations team reads the country.
 *
 * ## Why the sun hours live here
 *
 * `peakSunHours` is a **regional** fact, not a site one, and putting it on each
 * site would be twenty-five copies of six numbers waiting to disagree. The
 * northern states genuinely out-yield the Klang Valley — Kedah and Perlis sit near
 * 3.7 where Selangor sits at 3.5 — and Borneo's cloud cover pulls Sabah and
 * Sarawak back again. It is the only input the solar figures on every hybrid site
 * are built from, so it is stated once.
 *
 * These are **mock regions on mock sites**, the same standing as every other
 * figure in this prototype.
 */

export type CustomerId =
  | 'northern'
  | 'central'
  | 'southern'
  | 'east-coast'
  | 'sabah'
  | 'sarawak';

export type Customer = {
  id: CustomerId;
  /** How the region is written in full, for a tooltip or a detail line. */
  name: string;
  /** The short form the chips use — a card row has no space for "Network Region". */
  shortName: string;
  /**
   * Daily peak sun hours, the P50 design figure the solar yield is built from.
   *
   * A P90 year is taken as 0.9 of this, which is where the conservative column on
   * the energy screen comes from.
   */
  peakSunHours: number;
};

export const CUSTOMERS: Array<Customer> = [
  {id: 'northern', name: 'Northern Region', shortName: 'Northern', peakSunHours: 3.7},
  {id: 'central', name: 'Central Region', shortName: 'Central', peakSunHours: 3.5},
  {id: 'southern', name: 'Southern Region', shortName: 'Southern', peakSunHours: 3.5},
  {id: 'east-coast', name: 'East Coast Region', shortName: 'East Coast', peakSunHours: 3.4},
  {id: 'sabah', name: 'Sabah Region', shortName: 'Sabah', peakSunHours: 3.4},
  {id: 'sarawak', name: 'Sarawak Region', shortName: 'Sarawak', peakSunHours: 3.3},
];

const BY_ID: Record<CustomerId, Customer> = Object.fromEntries(
  CUSTOMERS.map((customer) => [customer.id, customer]),
) as Record<CustomerId, Customer>;

export const customer = (id: CustomerId): Customer => BY_ID[id];

/**
 * The short name, or the word for a genset fitted at no site at all.
 *
 * One function rather than `customer(id).shortName` at each call site, because
 * every caller has the same `undefined` case to answer and they should answer it
 * the same way. "Workshop" is where a set that is owned and not fitted actually
 * is.
 */
export const customerShortName = (id: CustomerId | undefined): string =>
  id === undefined ? 'Workshop' : BY_ID[id].shortName;
