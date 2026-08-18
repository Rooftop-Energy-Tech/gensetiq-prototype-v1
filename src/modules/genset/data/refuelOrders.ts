import type {RefuelOrder} from '../types/refuelOrder.type';
import {GENSETS} from './fleet';
import {gensetDeployments} from './deployments';
import {gensetStatus} from './fleetStatus';
import {historyStart, refuelsIn} from './history';
import {spread, spreadBetween} from './spread';

/**
 * The refuel log, in place of the work-order API this prototype doesn't have.
 *
 * The production model (Helios `RefuelLog`) is the shape being demonstrated: a
 * refuel is a **work order**, not a diary entry. It is *issued* — somebody in
 * the operations room books a tanker against a tank that is running down — and
 * later it is *completed*, when the fuel actually goes in. The two timestamps
 * are the two facts, and the status is derived from whether the second exists
 * yet, so an order cannot claim a state its own record contradicts.
 *
 * Two honesty rules, in the data layer's usual spirit:
 *
 *  1. **Completed orders are the ladder's own deliveries.** `refuelsIn()` reads
 *     every step-up off the fuel curve, so each completed order here is a
 *     delivery every fuel chart in the app already draws — same instant, same
 *     litres. An order log that disagreed with the tank chart beside it would
 *     be two records of one event.
 *  2. **Outstanding orders are the refuel bucket's own members.** A pending
 *     order exists exactly for the sets the overview counts as needing a
 *     tanker (below the reserve line, or dry), so the tile on the overview and
 *     the outstanding rows here are one fact in two places.
 *
 * Attribution mirrors production: an order carries the id of the posting its
 * delivery landed in, or `null` for a delivery between postings — the
 * inter-deployment case the dropdown in the real product exists for.
 */

const HOUR = 3_600_000;

/** Who issues orders in this mock — the operations room's roster. */
const ISSUERS = ['Hafiz', 'Rozita', 'Amir', 'Dayang', 'Farhana', 'Jeffry'];

const issuer = (gensetId: string, salt: string): string =>
  ISSUERS[Math.floor(spread(gensetId, salt) * ISSUERS.length)];

/** The posting whose window contains an instant, or `null` between postings. */
const deploymentAt = (gensetId: string, at: number): string | null => {
  for (const deployment of gensetDeployments(gensetId)) {
    const from = new Date(deployment.startedAt).getTime();
    const to =
      deployment.endedAt === null ? Number.POSITIVE_INFINITY : new Date(deployment.endedAt).getTime();
    if (at >= from && at <= to) return deployment.id;
  }
  return null;
};

const buildOrders = (): Array<RefuelOrder> => {
  const now = Date.now();
  const orders: Array<RefuelOrder> = [];

  for (const genset of GENSETS) {
    // Completed orders — one per delivery the fuel ladder already contains.
    const deliveries = refuelsIn(genset.id, historyStart(), now);
    deliveries.forEach((delivery, index) => {
      // Issued half a day to two days before the tanker arrived — the booking
      // lead time an operations room actually works with.
      const leadMs = spreadBetween(genset.id, `refuel/lead-${index}`, 12, 48) * HOUR;
      orders.push({
        id: `${genset.id}-ro-${index}`,
        gensetId: genset.id,
        deploymentId: deploymentAt(genset.id, delivery.at),
        litres: Math.round(delivery.litres),
        issuedAt: new Date(delivery.at - leadMs).toISOString(),
        issuedBy: issuer(genset.id, `refuel/issuer-${index}`),
        refueledAt: new Date(delivery.at).toISOString(),
      });
    });

    // The outstanding order, for exactly the sets the overview's refuel and
    // empty buckets count. Litres to order = the headroom in the tank.
    const status = gensetStatus(genset);
    if (status === 'REFUEL' || status === 'EMPTY') {
      const issuedHoursAgo = spreadBetween(genset.id, 'refuel/open-issued', 2, 20);
      orders.push({
        id: `${genset.id}-ro-open`,
        gensetId: genset.id,
        deploymentId: deploymentAt(genset.id, now),
        litres: Math.round(genset.fuelCapacityLitres - genset.fuelLitres),
        issuedAt: new Date(now - issuedHoursAgo * HOUR).toISOString(),
        issuedBy: issuer(genset.id, 'refuel/open-issuer'),
        refueledAt: null,
      });
    }
  }

  // Outstanding first (oldest booking at the head — it has waited longest),
  // then completed, newest delivery first.
  const outstanding = orders
    .filter((order) => order.refueledAt === null)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  const completed = orders
    .filter((order) => order.refueledAt !== null)
    .sort((a, b) => (b.refueledAt ?? '').localeCompare(a.refueledAt ?? ''));

  return [...outstanding, ...completed];
};

export const REFUEL_ORDERS: Array<RefuelOrder> = buildOrders();
