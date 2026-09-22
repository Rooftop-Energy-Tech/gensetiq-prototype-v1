import {SITE_POWER_ROLE_LABEL, SITE_POWER_ROLES} from '@/modules/site/types/site.type';
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
 * *posting*, and a machine on a lorry has no posting. The card labels
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
  byRole: Array<Tally<SitePowerRole | 'WORKSHOP'>>;
  /** The four buckets, worst first — see `fleetStatus.ts`. Always all four. */
  byStatus: Array<Tally<FleetStatus>>;
  /** Customers with at least one set, in roster order. Depot last, if occupied. */
  byCustomer: Array<Tally<CustomerId | 'WORKSHOP'>>;
};

const ROLE_LABEL = SITE_POWER_ROLE_LABEL;

export const fleetSummary = (
  gensets: Array<Genset>,
  roles: Record<string, SitePowerRole>,
): FleetSummary => {
  const roleCounts: Record<string, number> = {
    GRID_BACKUP: 0,
    DIESEL_PRIME: 0,
    WORKSHOP: 0,
  };
  const customerCounts = new Map<CustomerId | 'WORKSHOP', number>();
  const statusCounts: Record<FleetStatus, number> = {ALARM: 0, REFUEL: 0, OK: 0};
  const sites = new Set<string>();

  for (const genset of gensets) {
    if (genset.siteId !== null) sites.add(genset.siteId);

    const role = gensetPowerRole(genset, roles);
    roleCounts[role ?? 'WORKSHOP'] += 1;

    const account = gensetCustomer(genset) ?? 'WORKSHOP';
    customerCounts.set(account, (customerCounts.get(account) ?? 0) + 1);

    statusCounts[gensetStatus(genset)] += 1;
  }

  const workshopCount = roleCounts.WORKSHOP;

  return {
    total: gensets.length,
    siteCount: sites.size,
    depotCount: workshopCount,
    // Empty buckets are dropped rather than shown as zero. "Workshop 0" is a row
    // that never says anything on an estate that is fully fitted, and a card whose
    // shape changes with the data reads faster than one padded to a fixed height.
    byRole: [
      ...SITE_POWER_ROLES.map((role) => ({
        key: role as SitePowerRole | 'WORKSHOP',
        label: ROLE_LABEL[role],
        count: roleCounts[role],
      })),
      {key: 'WORKSHOP' as SitePowerRole | 'WORKSHOP', label: 'Workshop', count: workshopCount},
    ].filter((tally) => tally.count > 0),
    // Every bucket is kept, zero or not. Unlike the role and customer rows, these
    // three are a fixed scale a reader learns once — dropping "Alarms raised" on a
    // good day would move the other two and make the card read differently every
    // load.
    byStatus: FLEET_STATUSES.map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      count: statusCounts[status],
    })),
    byCustomer: [
      ...CUSTOMERS.map((account) => ({
        key: account.id as CustomerId | 'WORKSHOP',
        label: account.shortName,
        count: customerCounts.get(account.id) ?? 0,
      })),
      {key: 'WORKSHOP' as const, label: 'Workshop', count: customerCounts.get('WORKSHOP') ?? 0},
    ].filter((tally) => tally.count > 0),
  };
};
