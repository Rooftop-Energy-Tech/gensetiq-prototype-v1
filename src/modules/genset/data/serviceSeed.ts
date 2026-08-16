import {spread, spreadBetween} from './spread';

/**
 * How long it has been since each unit was last serviced — as **elapsed
 * amounts**, not as dates and meter readings.
 *
 * ## Why this file has no imports
 *
 * Same reason `site/data/siteSeed.ts` has none: it sits at the bottom of the
 * graph so two files above it can both read it without closing a loop.
 * `detail.ts` needs the elapsed hours (it publishes the `hours-since-service`
 * reading) and `services.ts` needs them too (it builds the actual records, and
 * needs `detail.ts` for the hour meter). If the profiles lived in either one,
 * the other could not have them.
 *
 * ## Why elapsed rather than absolute
 *
 * Because the present is a given, not an output — `history.ts` states the rule
 * and this file obeys it. The hour meter is already published by `detail.ts`, so
 * the seeded service is placed **backwards** from it:
 * `engineHoursAtService = currentEngineHours − elapsedHours`. Seeding an
 * absolute reading instead would let a unit's service claim an hour figure its
 * own meter has not reached.
 *
 * ## Why some units are pinned
 *
 * A fleet where everything is green does not exercise the screen. Five units are
 * placed by hand so every state the Service tab can render actually exists
 * somewhere in the prototype — including the two that are the whole point of
 * having two counters:
 *
 *  - `kln3355` is **overdue on hours with its calendar clock barely started** —
 *    a set worked hard since a recent service.
 *  - `kjg9048` is **overdue on calendar having hardly turned** — a standby set
 *    that has sat for seven months. A single hours-based rule would call it
 *    fine, which is exactly the failure the calendar interval exists to catch.
 *
 * Everything else is spread off its id, so a reload redraws the same fleet.
 */

/**
 * A seeded service, as a pair of elapsed amounts.
 *
 * `null` means **never serviced** — a real state with its own rendering, not a
 * gap to be filled in with zeros.
 */
export type ServiceProfile = {
  /** Run hours the unit has put on since it was last serviced. */
  elapsedHours: number;
  /** Calendar months since, which on a rarely-run set is the binding one. */
  elapsedMonths: number;
  technicianName: string;
  notes?: string;
} | null;

/**
 * The crew. Assigned by hash rather than by hand, except where a pinned unit
 * names one — `Fazlan` signed the checklist this feature was built from, so the
 * bundled sample report and the record pointing at it agree on who did the work.
 */
const TECHNICIANS = ['Fazlan', 'Hafiz Rahman', 'Ravi Kumaran', 'Wei Kang Lim', 'Syafiq Aziz'] as const;

const technicianFor = (gensetId: string): string =>
  TECHNICIANS[Math.floor(spread(gensetId, 'technician') * TECHNICIANS.length) % TECHNICIANS.length];

/**
 * The hand-placed units, and what each one is here to demonstrate.
 *
 * Against the default `250 h / 6 months`.
 */
const PINNED: Record<string, ServiceProfile> = {
  // Due soon on hours. The unit the design opens on, so the tab has something
  // to say on the first page anybody looks at — short of overdue, because this
  // unit already carries nine alarms and a tenth problem would bury them.
  brf9540: {
    elapsedHours: 232,
    elapsedMonths: 2.4,
    technicianName: 'Fazlan',
    notes: 'Refill diesel 600litre & pm genset',
  },

  // Overdue on hours; calendar barely started. Worked hard since a recent visit.
  kln3355: {elapsedHours: 291, elapsedMonths: 2.1, technicianName: 'Hafiz Rahman'},

  // Overdue on calendar; hardly turned. The case a mileage-only rule misses.
  kjg9048: {
    elapsedHours: 34,
    elapsedMonths: 7.4,
    technicianName: 'Ravi Kumaran',
    notes: 'Standby set, low utilisation. Battery on trickle charge.',
  },

  // Due soon on calendar, with plenty of hours left.
  amp8890: {elapsedHours: 88, elapsedMonths: 5.7, technicianName: 'Wei Kang Lim'},

  // Never serviced — commissioned and not yet visited.
  kbr4128: null,
};

/**
 * This unit's seeded service, or `null` if it has never had one.
 *
 * The unpinned majority land at 20–200 hours and 0.4–4.8 months, which is
 * comfortably inside both intervals: most of a real fleet is not due, and a
 * screen that says so is doing its job.
 */
export const serviceProfile = (gensetId: string): ServiceProfile => {
  if (gensetId in PINNED) return PINNED[gensetId];

  return {
    elapsedHours: Math.round(spreadBetween(gensetId, 'serviceHours', 20, 200)),
    elapsedMonths: Math.round(spreadBetween(gensetId, 'serviceMonths', 0.4, 4.8) * 10) / 10,
    technicianName: technicianFor(gensetId),
  };
};

/**
 * Hours since this unit's last service — the figure `detail.ts` publishes as the
 * `hours-since-service` reading.
 *
 * Zero for a never-serviced unit. That value is never rendered: the alerts
 * section drops the row entirely when there is no service to measure from, since
 * "0 hours since service" on a machine that has never been serviced is the exact
 * lie this feature was written to remove.
 */
export const seededHoursSinceService = (gensetId: string): number =>
  serviceProfile(gensetId)?.elapsedHours ?? 0;
