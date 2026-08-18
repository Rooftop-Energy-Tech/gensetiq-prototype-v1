/**
 * A refuel is a **work order**: issued by the operations room, completed by a
 * tanker. Mirrors the production model (Helios `RefuelLog`), where the two
 * timestamps are the record and the status is derived — *issued* while
 * `refueledAt` is null, *completed* once it is set — so an order cannot claim
 * a state its own record contradicts.
 */
export type RefuelOrder = {
  id: string;
  gensetId: string;
  /**
   * The posting the delivery landed in, or `null` for a refuel between
   * postings — a tank topped up in the depot before the next job.
   */
  deploymentId: string | null;
  /** Litres — ordered while outstanding, delivered once completed. */
  litres: number;
  /** ISO 8601 — when the order was raised. */
  issuedAt: string;
  /** Who raised it. */
  issuedBy: string;
  /** ISO 8601 — when the fuel went in, or `null` while the tanker is owed. */
  refueledAt: string | null;
};

export type RefuelOrderStatus = 'ISSUED' | 'COMPLETED';

/** Derived, never stored: the record *is* the status. */
export const orderStatus = (order: RefuelOrder): RefuelOrderStatus =>
  order.refueledAt === null ? 'ISSUED' : 'COMPLETED';
