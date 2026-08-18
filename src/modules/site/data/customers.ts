/**
 * Whose yards the sites are — for this demo, the utility's own distribution zones.
 *
 * ## Why the zone hangs off the site
 *
 * A genset is owned by the fleet and *stands* wherever it was dropped, and the
 * second of those is the one an operator asks about: "how many sets have we got
 * in Sandakan" means "at the Sandakan zone's yards". So a zone owns **sites**,
 * and a genset takes its zone from the site it is deployed to — the same
 * direction `locationLabel` already travels, and for the same reason. A zone id
 * seeded onto each genset would be a second copy of a fact the site already
 * states, and detaching a set would then leave a machine in the depot still
 * claiming a zone's name.
 *
 * The consequence is deliberate: **a set in the depot has no zone**, and the
 * summary cards count it under "Depot" rather than inventing an owner for it.
 *
 * ## Why the roster is a table rather than free text on the seed
 *
 * The cards group by zone and the filter chips key off it, so the identity has
 * to be stable across renames. Order here is the order the chips appear in,
 * which is deliberately *not* alphabetical and not by size: west to east, the
 * way the operations team reads the state, so the row doesn't reshuffle when a
 * site changes hands.
 *
 * These are **mock zones on mock sites**, the same standing as every other
 * figure in this prototype.
 */

export type CustomerId =
  | 'west-coast'
  | 'kudat'
  | 'interior'
  | 'sandakan'
  | 'lahad-datu'
  | 'tawau'
  | 'labuan';

export type Customer = {
  id: CustomerId;
  /** How the zone is written in full, for a tooltip or a detail line. */
  name: string;
  /** The short form the chips use — a card row has no space for "Distribution Zone". */
  shortName: string;
};

export const CUSTOMERS: Array<Customer> = [
  {id: 'west-coast', name: 'West Coast Distribution', shortName: 'West Coast'},
  {id: 'kudat', name: 'Kudat Distribution', shortName: 'Kudat'},
  {id: 'interior', name: 'Interior Distribution', shortName: 'Interior'},
  {id: 'sandakan', name: 'Sandakan Distribution', shortName: 'Sandakan'},
  {id: 'lahad-datu', name: 'Lahad Datu Distribution', shortName: 'Lahad Datu'},
  {id: 'tawau', name: 'Tawau Distribution', shortName: 'Tawau'},
  {id: 'labuan', name: 'Labuan Distribution', shortName: 'Labuan'},
];

const BY_ID: Record<CustomerId, Customer> = Object.fromEntries(
  CUSTOMERS.map((customer) => [customer.id, customer]),
) as Record<CustomerId, Customer>;

export const customer = (id: CustomerId): Customer => BY_ID[id];

/**
 * The short name, or the word for a genset standing at no site at all.
 *
 * One function rather than `customer(id).shortName` at each call site, because
 * every caller has the same `undefined` case to answer and they should answer it
 * the same way. "Depot" is the word the deployment screen already uses for a set
 * that is owned and not placed.
 */
export const customerShortName = (id: CustomerId | undefined): string =>
  id === undefined ? 'Depot' : BY_ID[id].shortName;
