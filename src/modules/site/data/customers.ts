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
 * **Sabah and Sarawak first**, because twenty-one of the twenty-five sites are
 * there and the four peninsular regions are the baseline they are read against; on
 * the utility estate it is the order its states are listed in (Kuala Lumpur,
 * Selangor, Perak, Pulau Pinang, Johor, Negeri Sembilan, Pahang, Kedah, Perlis).
 *
 * ## The sun hours that used to live here
 *
 * `peakSunHours` was a **regional** fact on each division, the only input the solar
 * figures were built from. It went with the solar model.
 *
 * These are mock divisions on mock sites, the same standing as every other figure
 * in this prototype.
 */
export type Customer = BrandCustomer;

export type {CustomerId};

export const CUSTOMERS: ReadonlyArray<Customer> = DATASET.customers;

/**
 * How this estate's divisions are named in a card heading — "By region" on a
 * carrier's network, "By state" on Express Mission's. Read from the dataset so the three
 * summary cards that show it do not each have to know which brand is loaded.
 */
export const CUSTOMER_GROUPING_LABEL: string = DATASET.groupingLabel;

/**
 * The same word on its own — `Region`, `State` — for a field label or a chip.
 *
 * Derived from the card heading rather than declared beside it, so a dataset states
 * the vocabulary once and the two can never drift into calling the same thing by
 * two names on one screen. `By region` is the only shape the field takes, and a
 * dataset that wrote something else falls back to the heading whole, which reads
 * oddly but says nothing false.
 */
export const CUSTOMER_TERM: string = CUSTOMER_GROUPING_LABEL.startsWith('By ')
  ? CUSTOMER_GROUPING_LABEL.slice(3, 4).toUpperCase() + CUSTOMER_GROUPING_LABEL.slice(4)
  : CUSTOMER_GROUPING_LABEL;

const BY_ID: Record<CustomerId, Customer> = Object.fromEntries(
  CUSTOMERS.map((entry) => [entry.id, entry]),
);

/**
 * The division a site belongs to.
 *
 * Throws on an unknown id rather than returning `undefined`. Every caller reached
 * here from a seed row that `assertDatasetIntegrity` already validated, so an
 * unknown id means the dataset changed underneath the app — and the alternative is
 * a division that reads as `undefined` in every chip and card that names it.
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
