/**
 * Who the sites belong to.
 *
 * ## Why the customer hangs off the site
 *
 * A genset is owned by whoever bought it and *stands* wherever it was dropped, and
 * the second of those is the one an operator asks about: "how many sets have we got
 * at Maxis" means "at Maxis's yards". So a customer owns **sites**, and a genset
 * takes its customer from the site it is deployed to — the same direction
 * `locationLabel` already travels, and for the same reason. A `customerId` seeded
 * onto each genset would be a second copy of a fact the site already states, and
 * detaching a set would then leave a machine in the depot still claiming a
 * customer's name.
 *
 * The consequence is deliberate: **a set in the depot has no customer**, and the
 * summary cards count it under "Depot" rather than inventing an owner for it.
 *
 * ## Why the roster is a table rather than free text on the seed
 *
 * The cards group by customer and the filter chips key off it, so the identity has
 * to be stable across renames — `redtone` stays `redtone` when its display name
 * gains a "Sdn Bhd". Order here is the order the chips appear in, which is
 * deliberately *not* alphabetical and not by size: it is the order the account team
 * reads them in, so the row doesn't reshuffle when a site changes hands.
 *
 * These are **mock accounts on mock sites**, the same standing as every other
 * figure in this prototype.
 */

export type CustomerId =
  | 'maxis'
  | 'redtone'
  | 'sapura'
  | 'tm'
  | 'kpj'
  | 'malaysia-airports'
  | 'lotuss';

export type Customer = {
  id: CustomerId;
  /** How the account is written in full, for a tooltip or a detail line. */
  name: string;
  /** The short form the chips use — a card row has no space for "Telekom Malaysia". */
  shortName: string;
};

export const CUSTOMERS: Array<Customer> = [
  {id: 'maxis', name: 'Maxis Broadband', shortName: 'Maxis'},
  {id: 'redtone', name: 'REDtone Digital', shortName: 'REDtone'},
  {id: 'sapura', name: 'Sapura Energy', shortName: 'Sapura'},
  {id: 'tm', name: 'Telekom Malaysia', shortName: 'TM'},
  {id: 'kpj', name: 'KPJ Healthcare', shortName: 'KPJ'},
  {id: 'malaysia-airports', name: 'Malaysia Airports', shortName: 'MAHB'},
  {id: 'lotuss', name: "Lotus's Malaysia", shortName: "Lotus's"},
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
