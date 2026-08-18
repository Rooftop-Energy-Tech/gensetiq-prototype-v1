import type {SitePowerRole} from '@/modules/site/types/site.type';
import {CUSTOMERS} from '@/modules/site/data/customers';
import type {CustomerId} from '@/modules/site/data/customers';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {FLEET_STATUSES, STATUS_META, gensetStatus} from './fleetStatus';
import type {FleetStatus} from './fleetStatus';
import type {Genset} from '../types/genset.type';

/**
 * What the cards above the fleet list count.
 *
 * Derived on every render from the list they sit over, and **never stored** — the
 * rule the rest of the data layer follows. A card is a reading of the same rows the
 * table is drawing, so it cannot claim a total the list does not contain.
 *
 * ## Why the counts are over the *whole* fleet, not the filtered one
 *
 * A card that shrinks to match the filter it applied says nothing: click "Prime"
 * and the duty card reads "Standby 0 · Prime 7", which is a tautology, and the way
 * back to the full picture disappears with the numbers. So the cards count the
 * fleet and the *chips* carry the selection — the numbers hold still while you
 * filter against them, which is what makes them worth reading twice.
 *
 * The one figure that does follow the filter is the headline's "showing N", because
 * that is the question the headline is answering.
 */

export type Tally<K extends string> = {key: K; label: string; count: number};

/** Which site a set stands at, as the two facts the cards group by. */
export const gensetCustomer = (genset: Genset): CustomerId | undefined =>
  genset.siteId === null ? undefined : siteSeed(genset.siteId)?.customer;

/**
 * A set's duty, taken from the yard it is standing in.
 *
 * `undefined` in the depot, and that is the honest answer rather than a third
 * bucket dressed up as a role: standby and prime are properties of an
 * *installation*, and a machine on a lorry has no installation. The card labels
 * that group "Depot" for the same reason the customer card does.
 *
 * `roles` is passed in rather than read from the store, so every set in one render
 * is judged against the same moment — and so this stays a pure function the page
 * can memoise.
 */
export const gensetPowerRole = (
  genset: Genset,
  roles: Record<string, SitePowerRole>,
): SitePowerRole | undefined =>
  genset.siteId === null ? undefined : roles[genset.siteId];

export type FleetSummary = {
  total: number;
  /** Distinct sites with at least one set standing on them. Not the estate's size. */
  siteCount: number;
  depotCount: number;
  byRole: Array<Tally<SitePowerRole | 'DEPOT'>>;
  /** The four buckets, worst first — see `fleetStatus.ts`. Always all four. */
  byStatus: Array<Tally<FleetStatus>>;
  /** Customers with at least one set, in roster order. Depot last, if occupied. */
  byCustomer: Array<Tally<CustomerId | 'DEPOT'>>;
};

const ROLE_LABEL: Record<SitePowerRole, string> = {STANDBY: 'Standby', PRIME: 'Prime'};

export const fleetSummary = (
  gensets: Array<Genset>,
  roles: Record<string, SitePowerRole>,
): FleetSummary => {
  const roleCounts: Record<string, number> = {STANDBY: 0, PRIME: 0, DEPOT: 0};
  const customerCounts = new Map<CustomerId | 'DEPOT', number>();
  const statusCounts: Record<FleetStatus, number> = {EMPTY: 0, ALARM: 0, REFUEL: 0, OK: 0};
  const sites = new Set<string>();

  for (const genset of gensets) {
    if (genset.siteId !== null) sites.add(genset.siteId);

    const role = gensetPowerRole(genset, roles);
    roleCounts[role ?? 'DEPOT'] += 1;

    const account = gensetCustomer(genset) ?? 'DEPOT';
    customerCounts.set(account, (customerCounts.get(account) ?? 0) + 1);

    statusCounts[gensetStatus(genset)] += 1;
  }

  const depotCount = roleCounts.DEPOT;

  return {
    total: gensets.length,
    siteCount: sites.size,
    depotCount,
    // Empty buckets are dropped rather than shown as zero. "Depot 0" is a row that
    // never says anything on a fleet that is fully deployed, and a card whose
    // shape changes with the data reads faster than one padded to a fixed height.
    byRole: [
      {key: 'STANDBY' as const, label: ROLE_LABEL.STANDBY, count: roleCounts.STANDBY},
      {key: 'PRIME' as const, label: ROLE_LABEL.PRIME, count: roleCounts.PRIME},
      {key: 'DEPOT' as const, label: 'Depot', count: depotCount},
    ].filter((tally) => tally.count > 0),
    // Every bucket is kept, zero or not. Unlike the role and customer rows, these
    // four are a fixed scale a reader learns once — dropping "Tank empty" on a good
    // day would move the other three and make the card read differently every load.
    byStatus: FLEET_STATUSES.map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      count: statusCounts[status],
    })),
    byCustomer: [
      ...CUSTOMERS.map((account) => ({
        key: account.id as CustomerId | 'DEPOT',
        label: account.shortName,
        count: customerCounts.get(account.id) ?? 0,
      })),
      {key: 'DEPOT' as const, label: 'Depot', count: customerCounts.get('DEPOT') ?? 0},
    ].filter((tally) => tally.count > 0),
  };
};
