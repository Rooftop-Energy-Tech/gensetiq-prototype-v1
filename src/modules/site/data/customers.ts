import {DATASET} from '@/brands';
import type {BrandCustomer, CustomerId} from '@/brands';

/**
 * Whose sites these are — the divisions the active dataset's estate is split into.
 *
 * A carrier's network regions on one dataset, a utility's distribution zones on
 * another. This file used to *be* one of those two, which is why the estate could
 * only ever be swapped by branching; it is now a view onto whichever dataset the
 * brand named. The roster, the labels and the sun hours live in
 * `brands/datasets/*.ts`.
 *
 * ## Why the division hangs off the site
 *
 * A genset is owned by the estate and is *fitted* wherever it was commissioned,
 * and the second of those is the one an operator asks about: "how many sets have
 * we got in Sarawak" means "at the Sarawak region's sites". So a division owns
 * **sites**, and a genset takes its division from the site it stands at — the same
 * direction `locationLabel` already travels, and for the same reason. An id seeded
 * onto each genset would be a second copy of a fact the site already states, and
 * detaching a set would then leave a machine in the workshop still claiming a
 * region's name.
 *
 * The consequence is deliberate: **a set not fitted anywhere has no division**,
 * and the summary cards count it under "Workshop" rather than inventing an owner.
 *
 * ## Why the order is not alphabetical
 *
 * The cards group by division and the filter chips key off it, so the order here is
 * the order the chips appear in — deliberately not alphabetical and not by size,
 * but the way an operations team reads its own patch. On the carrier estate that is
 * peninsular north to south then across to Borneo; on the utility estate it is west
 * coast, the northern tip, the interior, then down the east coast.
 *
 * ## Why the sun hours live on the division
 *
 * `peakSunHours` is a **regional** fact, not a site one, and putting it on each
 * site would be twenty-five copies of six numbers waiting to disagree. It is the
 * only input the solar figures on every hybrid site are built from, so it is
 * stated once.
 *
 * These are mock divisions on mock sites, the same standing as every other figure
 * in this prototype.
 */
export type Customer = BrandCustomer;

export type {CustomerId};

export const CUSTOMERS: ReadonlyArray<Customer> = DATASET.customers;

/**
 * How this estate's divisions are named in a card heading — "By region" on a
 * carrier's network, "By zone" on a utility's. Read from the dataset so the three
 * summary cards that show it do not each have to know which brand is loaded.
 */
export const CUSTOMER_GROUPING_LABEL: string = DATASET.groupingLabel;

const BY_ID: Record<CustomerId, Customer> = Object.fromEntries(
  CUSTOMERS.map((entry) => [entry.id, entry]),
);

/**
 * The division a site belongs to.
 *
 * Throws on an unknown id rather than returning `undefined`. Every caller reached
 * here from a seed row that `assertDatasetIntegrity` already validated, so an
 * unknown id means the dataset changed underneath the app — and the alternative is
 * `NaN` peak sun hours propagating silently into every solar figure on the page.
 */
export const customer = (id: CustomerId): Customer => {
  const found = BY_ID[id];
  if (found === undefined) {
    throw new Error(`No such division "${id}" in the ${DATASET.label} roster.`);
  }
  return found;
};

/**
 * The short name, or the word for a genset fitted at no site at all.
 *
 * One function rather than `customer(id).shortName` at each call site, because
 * every caller has the same `undefined` case to answer and they should answer it
 * the same way. "Workshop" is where a set that is owned and not fitted actually
 * is.
 */
export const customerShortName = (id: CustomerId | undefined): string =>
  id === undefined ? 'Workshop' : customer(id).shortName;
