import {figure, numericDate} from '@/lib/format';

import type {AlertSeverity} from './alert.type';

/**
 * Servicing, and how a genset falls due for it.
 *
 * A genset is serviced on the same logic as a car: whichever comes first between
 * a number of run hours and a number of months. **Both counters run at once and
 * neither is converted into the other.** That is the one decision this file
 * exists to hold, and it is worth stating plainly because the tempting
 * alternative is wrong in a way that is hard to see afterwards.
 *
 * The alternative is to project the hours onto a calendar — take the unit's
 * recent duty rate, divide the hours remaining by it, and compare two dates.
 * It reads well and it lies. The duty rate of a standby set is noise: one long
 * outage triples it, a quiet fortnight halves it, and neither says anything
 * about the machine's condition. Worse, an idle set divides by something very
 * near zero. Two counters that are each honest in their own units beat one
 * number that is a forecast wearing a fact's clothes.
 *
 * So: hours are measured in hours against an hour interval, months are measured
 * in months against a month interval, and "due" is whichever crosses first.
 */

/**
 * One thing on the schedule — engine oil, the air filter, the battery — and how
 * often it is done.
 *
 * ## A list of items, as a car's book has (Jeff, 2026-10-05)
 *
 * Not every part is changed on every visit: oil every 250 h, coolant every two
 * years. So the schedule is a list, each item on its own interval, and each item
 * falls due on its own. It was one pair of intervals for the whole set until then.
 *
 * Either interval may be left out, but not both. A battery ages by the calendar
 * whether the set runs or not, so it has months only; an item with both is due on
 * whichever comes first, as the whole set was. The reasoning below for keeping the
 * two counters apart still holds item by item.
 */
export type ServiceItem = {
  /** Stable, so a record's `itemIds` still finds it after a rename. */
  id: string;
  name: string;
  /** Run hours between services. Absent: this item is on the calendar alone. */
  intervalHours?: number;
  /** Calendar months between services, run or not. Absent: run hours alone. */
  intervalMonths?: number;
  /** A standing note — the oil grade, a part number (Jeff, 2026-10-05). */
  remarks?: string;
};

/** How often this genset is serviced — its items, in the order the page lists them. */
export type ServiceSchedule = {
  items: Array<ServiceItem>;
};

/**
 * The document a service produced — the technician's filled-in checklist.
 *
 * `url` is nullable and that nullability is load-bearing rather than defensive.
 * Seeded records point at a PDF bundled in `public/` and always resolve; a PDF
 * attached by an operator in this session is an object URL that dies with the
 * tab. After a reload the record is still there and the file is not, so the row
 * shows the filename with the link inert — see `data/services.ts` for why it is
 * not base64'd into `localStorage` instead.
 */
export type ServiceDocument = {
  fileName: string;
  /** `null` once the object URL behind it is gone. */
  url: string | null;
};

/**
 * One service, as performed.
 *
 * The stored fields are exactly the ones the counters need plus the four the
 * history displays. Everything else a technician writes down — the twenty-eight
 * checklist items, the phase voltages, the remarks — lives in the attached
 * document. The app does not parse it and should not: a checklist is a record of
 * a person's judgement, and turning it into fields would invite the screen to
 * make claims the paper does not.
 */
export type ServiceRecord = {
  id: string;
  gensetId: string;
  /**
   * The site the genset stood at **when it was serviced**, stored rather than
   * looked up.
   *
   * `data/deployment.ts` lets a set be moved between yards. A record that pointed
   * at "the genset's site" would rewrite its own history every time a lorry
   * turned up, and last year's service at Paitan would silently reattribute
   * itself to wherever the machine is now.
   */
  siteId: string;
  /** ISO 8601 — the date *and* time on the sheet. Both are shown. */
  performedAt: string;
  technicianName: string;
  /**
   * The hour-meter reading at the moment of service.
   *
   * The load-bearing field, and the reason the paper form is enough to build
   * this on: the Dyna checklist already records it. With it, hours-since-service
   * is a subtraction. Without it, it is a guess — which is what the reading in
   * `data/detail.ts` used to be.
   */
  engineHoursAtService: number;
  document: ServiceDocument;
  /** The sheet's "Remarks" line, when there is one. */
  notes?: string;
  /**
   * The schedule items this visit did, by id. Absent means a full service, every
   * item — the seeded history, and any record logged before items existed.
   */
  itemIds?: Array<string>;
};

/** Whether this visit did this item. */
export const recordCovers = (record: ServiceRecord, itemId: string): boolean =>
  record.itemIds === undefined || record.itemIds.includes(itemId);

/** How close to its interval a counter has to be before it is worth flagging. */
const DUE_SOON_FRACTION = 0.9;

/** Which of the two counters is talking. */
export type ServiceCounterKind = 'hours' | 'calendar';

export const SERVICE_SEVERITIES = ['OVERDUE', 'DUE_SOON', 'OK'] as const;

/** Ordered worst-first, like `ALERT_SEVERITIES` — this is the "worse wins" order. */
export type ServiceSeverity = (typeof SERVICE_SEVERITIES)[number];

/**
 * One counter's reading: how far it has got, out of how far it may go.
 *
 * `elapsed` and `interval` share a unit within a counter and share none across
 * them. That is why the pair is kept as two of these rather than flattened into
 * four numbers on the status — flattening them is the first step towards
 * comparing hours with months by accident.
 */
export type ServiceCounter = {
  kind: ServiceCounterKind;
  elapsed: number;
  interval: number;
  severity: ServiceSeverity;
};

/** How far past — or short of — the interval this counter sits. */
export const counterOvershoot = (counter: ServiceCounter): number =>
  counter.elapsed - counter.interval;

/**
 * Whether a genset is due, and on which counter.
 *
 * A tagged union because "never serviced" is not a severity. A set with no
 * recorded service has no baseline to subtract from, so it is neither OK nor
 * overdue — it is unmeasured, and saying `0 h of 250 h` about it would be
 * inventing a service that never happened. The screen has to be able to say "we
 * don't know", and a `severity` field with an `UNKNOWN` member would let every
 * reader forget to handle it.
 */
export type ItemStatus =
  | {kind: 'never-serviced'; item: ServiceItem}
  | {
      kind: 'tracked';
      item: ServiceItem;
      /** The newest visit that did this item — what its counters measure from. */
      lastService: ServiceRecord;
      /** Absent when the item has no hour interval. */
      hours?: ServiceCounter;
      /** Absent when the item has no month interval. */
      calendar?: ServiceCounter;
      /** The worse of its counters. */
      severity: ServiceSeverity;
      binding: ServiceCounterKind;
      /** How far through its interval the nearer counter is; >1 is overdue. */
      progress: number;
    };

/**
 * A genset's verdict: its most urgent item's, with every item's beside it.
 *
 * The top-level fields are that one item's, so a reader that wants one answer —
 * the strip tile, the fleet page, the `Due for service` filter — reads them as it
 * read the single schedule's, and `item` says which part it is about.
 */
export type ServiceStatus =
  | {kind: 'never-serviced'; schedule: ServiceSchedule; items: Array<ItemStatus>}
  | {
      kind: 'tracked';
      schedule: ServiceSchedule;
      items: Array<ItemStatus>;
      /** The item the verdict is about. */
      item: ServiceItem;
      lastService: ServiceRecord;
      hours?: ServiceCounter;
      calendar?: ServiceCounter;
      /** The worse of the item's counters. */
      severity: ServiceSeverity;
      /**
       * The counter that set the severity — what the page names as the reason.
       *
       * On a tie, hours win. Arbitrary, but it has to be decided somewhere, and
       * a set that has both run its interval *and* sat six months is more
       * naturally described by the work it did.
       */
      binding: ServiceCounterKind;
    };

const severityOf = (elapsed: number, interval: number): ServiceSeverity => {
  if (interval <= 0) return 'OK';
  if (elapsed >= interval) return 'OVERDUE';
  return elapsed >= interval * DUE_SOON_FRACTION ? 'DUE_SOON' : 'OK';
};

const worse = (left: ServiceSeverity, right: ServiceSeverity): ServiceSeverity =>
  SERVICE_SEVERITIES.indexOf(left) <= SERVICE_SEVERITIES.indexOf(right) ? left : right;

/**
 * Whole months between two instants, by calendar rather than by arithmetic.
 *
 * `elapsed / 30 days` would drift: six "months" of 30 days is 180 days, and six
 * calendar months is 181–184. A service done on 15 January is due on 15 July,
 * which is the date a person would write on the sheet — so the count has to be
 * the one a calendar gives, with the day-of-month deciding whether the final
 * month has actually completed.
 *
 * Returned fractionally so the counter can move between the 15ths rather than
 * jumping a whole month at midnight. The fraction is the part-month prorated
 * against that month's own length, which is why February does not stall it.
 */
export const monthsBetween = (fromIso: string, now: number): number => {
  const from = new Date(fromIso);
  const to = new Date(now);

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

  // The anniversary within the current month — 15 Jan → 15 Jul. Clamped by
  // `Date` itself for the 31st of a short month, which is the behaviour wanted:
  // a 31 January service is a month old on 28 February.
  const anniversary = new Date(from);
  anniversary.setFullYear(to.getFullYear(), to.getMonth(), from.getDate());

  if (to.getTime() < anniversary.getTime()) months -= 1;

  // Prorate the part-month against the gap to the next anniversary.
  const previous = new Date(anniversary);
  if (to.getTime() < anniversary.getTime()) previous.setMonth(previous.getMonth() - 1);
  const next = new Date(previous);
  next.setMonth(next.getMonth() + 1);

  const span = next.getTime() - previous.getTime();
  const into = to.getTime() - previous.getTime();

  return months + (span > 0 ? Math.min(1, Math.max(0, into / span)) : 0);
};

/** The date a calendar interval of `intervalMonths` falls due, from the service it counts from. */
export const calendarDueDate = (lastService: ServiceRecord, intervalMonths: number): Date => {
  const due = new Date(lastService.performedAt);
  due.setMonth(due.getMonth() + intervalMonths);
  return due;
};

/** The counter that set a tracked status's severity. Always present, by construction. */
export const bindingCounter = (status: {
  hours?: ServiceCounter;
  calendar?: ServiceCounter;
  binding: ServiceCounterKind;
}): ServiceCounter => {
  const counter = status.binding === 'hours' ? (status.hours ?? status.calendar) : (status.calendar ?? status.hours);
  // An item has at least one interval, so at least one counter.
  return counter as ServiceCounter;
};

const ratio = (counter: ServiceCounter | undefined): number =>
  counter === undefined || counter.interval <= 0 ? 0 : counter.elapsed / counter.interval;

/** One item's counters, from the newest visit that did it. */
export const itemStatus = (
  item: ServiceItem,
  records: Array<ServiceRecord>,
  currentEngineHours: number,
  now: number = Date.now(),
): ItemStatus => {
  // Newest first, as the store hands them out.
  const lastService = records.find((record) => recordCovers(record, item.id));
  if (lastService === undefined) return {kind: 'never-serviced', item};

  // Clamped at zero: a technician's written figure can land below the meter's
  // current value if the panel was replaced, and a negative "hours since
  // service" is a data-entry story, not a machine one.
  const hoursElapsed = Math.max(0, currentEngineHours - lastService.engineHoursAtService);
  const monthsElapsed = Math.max(0, monthsBetween(lastService.performedAt, now));

  const hours: ServiceCounter | undefined =
    item.intervalHours === undefined
      ? undefined
      : {
          kind: 'hours',
          elapsed: hoursElapsed,
          interval: item.intervalHours,
          severity: severityOf(hoursElapsed, item.intervalHours),
        };
  const calendar: ServiceCounter | undefined =
    item.intervalMonths === undefined
      ? undefined
      : {
          kind: 'calendar',
          elapsed: monthsElapsed,
          interval: item.intervalMonths,
          severity: severityOf(monthsElapsed, item.intervalMonths),
        };

  const severity = worse(hours?.severity ?? 'OK', calendar?.severity ?? 'OK');
  // On a tie, hours win — see `binding` on `ServiceStatus`.
  const binding: ServiceCounterKind =
    hours !== undefined && (calendar === undefined || hours.severity === severity) ? 'hours' : 'calendar';

  return {
    kind: 'tracked',
    item,
    lastService,
    hours,
    calendar,
    severity,
    binding,
    progress: Math.max(ratio(hours), ratio(calendar)),
  };
};

/**
 * Every item's counters, and the verdict — the most urgent item's.
 *
 * Most urgent is the worst severity, then the furthest through its interval. A
 * genset with no service on record at all is `never-serviced`, as before; one
 * whose only unmeasured items are new ones keeps the verdict of the items it has.
 *
 * `currentEngineHours` is passed in rather than read here because this file has
 * no business knowing where telemetry comes from — and because the caller has to
 * hold one clock reading and one meter reading for a whole page, or two rows
 * rendered a millisecond apart can disagree about the same machine.
 */
export const serviceStatus = (
  records: Array<ServiceRecord>,
  schedule: ServiceSchedule,
  currentEngineHours: number,
  now: number = Date.now(),
): ServiceStatus => {
  const items = schedule.items.map((item) => itemStatus(item, records, currentEngineHours, now));
  const tracked = items.filter((status) => status.kind === 'tracked');
  const [worst] = [...tracked].sort(
    (left, right) =>
      SERVICE_SEVERITIES.indexOf(left.severity) - SERVICE_SEVERITIES.indexOf(right.severity) ||
      right.progress - left.progress,
  );
  if (worst === undefined) return {kind: 'never-serviced', schedule, items};

  return {
    kind: 'tracked',
    schedule,
    items,
    item: worst.item,
    lastService: worst.lastService,
    hours: worst.hours,
    calendar: worst.calendar,
    severity: worst.severity,
    binding: worst.binding,
  };
};

/**
 * A service falling due, as an alarm.
 *
 * ## The one alarm not from the register map (Jeff, 2026-10-05)
 *
 * `alert.type.ts` closes the controller's alarm list to the register map's bits,
 * and that still holds for the controller. This is the one kind raised by the app
 * instead: an item of the schedule falling due counts as an alarm being triggered.
 * It is not a bit on any panel — it is the app comparing a date and an hour meter
 * against the schedule — so it never pretends to be one. It prints `Service
 * schedule` where a controller row prints its register and bit, so a reader can
 * still tell at a glance which rows a panel asserted.
 *
 * Until that date it was a notice beside the alarms rather than one of them, on the
 * argument that one invented row makes every row suspect. The provenance line
 * answers that argument now: the row says where it came from.
 *
 * ## One per item, at two levels
 *
 * **Overdue is a `WARNING`** — a job to book, the same weight as a low tank. **Due
 * soon is `NEUTRAL`**, the lowest level, a note that does not move the condition
 * verdict. Each item raises its own, so a set with oil and the air filter both late
 * carries two. A never-serviced item raises nothing: it is unmeasured, not late,
 * and a row claiming otherwise would assert a service history that does not exist.
 */
export type ServiceNotice = {
  /**
   * The handling store's key. Starts with the genset id, which is how a job's pages
   * tell a machine's rows from the yard's. Carries the stage and the service it
   * counts from, so an acknowledgement does not outlive either: a due-soon row that
   * turns overdue, or an item serviced and late again, is a fresh alarm.
   */
  id: string;
  gensetId: string;
  item: ServiceItem;
  severity: AlertSeverity;
  /** Which counter is talking — what the message names as the reason. */
  binding: ServiceCounterKind;
  /** e.g. `Engine oil and filter overdue by 26 h`, `Battery due on 12/11/2026`. */
  message: string;
  /** The item's intervals, e.g. `Every 250 h or 6 months`. */
  rule: string;
  /** ISO 8601 — when the item crossed into its stage. See `crossedAt`. */
  raisedAt: string;
  /** Always the app. Printed where an alarm prints its register and bit. */
  source: 'Service schedule';
};

/** Service severity → alarm severity. `OK` raises nothing. */
export const ALARM_SEVERITY_OF_SERVICE: Record<Exclude<ServiceSeverity, 'OK'>, AlertSeverity> = {
  OVERDUE: 'WARNING',
  DUE_SOON: 'NEUTRAL',
};

/**
 * When a counter crossed `fraction` of its interval.
 *
 * By the calendar for months — the date a person would write on the sheet, with
 * the part-month prorated as `monthsBetween` counts it. For hours it is an
 * estimate: the meter is read at the service and now, nothing in between, so the
 * hours are taken as run evenly over that span. Good enough for a raised time;
 * never used to decide whether anything is due.
 */
const crossedAt = (
  lastService: ServiceRecord,
  counter: ServiceCounter,
  fraction: number,
  now: number,
): number => {
  const from = new Date(lastService.performedAt).getTime();
  const threshold = counter.interval * fraction;

  if (counter.kind === 'hours') {
    if (counter.elapsed <= 0) return now;
    return from + (now - from) * Math.min(1, threshold / counter.elapsed);
  }

  const whole = new Date(from);
  whole.setMonth(whole.getMonth() + Math.floor(threshold));
  const next = new Date(whole);
  next.setMonth(next.getMonth() + 1);
  return Math.min(now, whole.getTime() + (threshold % 1) * (next.getTime() - whole.getTime()));
};

const ruleOf = (item: ServiceItem): string =>
  `Every ${[
    item.intervalHours === undefined ? undefined : `${figure(item.intervalHours)} h`,
    item.intervalMonths === undefined ? undefined : `${item.intervalMonths} months`,
  ]
    .filter((part) => part !== undefined)
    .join(' or ')}`;

/**
 * One item's alarm, or `undefined` while it is inside its interval or unmeasured.
 *
 * `now` must be the clock the status was measured against, or the raised time and
 * the counters disagree about the same moment.
 */
export const serviceNoticeOf = (
  gensetId: string,
  status: ItemStatus,
  now: number,
): ServiceNotice | undefined => {
  if (status.kind !== 'tracked' || status.severity === 'OK') return undefined;

  const counter = bindingCounter(status);
  const overshoot = counterOvershoot(counter);
  const overdue = status.severity === 'OVERDUE';
  const name = status.item.name;

  const message = overdue
    ? counter.kind === 'hours'
      ? `${name} overdue by ${figure(Math.round(overshoot))} h`
      : `${name} overdue by ${overshoot.toFixed(1)} months`
    : counter.kind === 'hours'
      ? `${name} due in ${figure(Math.round(-overshoot))} h`
      : `${name} due on ${numericDate(calendarDueDate(status.lastService, counter.interval).getTime())}`;

  // The earliest crossing among the counters at this stage — an item late on both
  // has been late since the first of them went.
  const fraction = overdue ? 1 : DUE_SOON_FRACTION;
  const crossings = [status.hours, status.calendar]
    .filter((candidate): candidate is ServiceCounter => candidate?.severity === status.severity)
    .map((candidate) => crossedAt(status.lastService, candidate, fraction, now));

  return {
    id: `${gensetId}-service-${status.item.id}-${overdue ? 'overdue' : 'due-soon'}:${status.lastService.id}`,
    gensetId,
    item: status.item,
    severity: ALARM_SEVERITY_OF_SERVICE[status.severity],
    binding: status.binding,
    message,
    rule: ruleOf(status.item),
    raisedAt: new Date(Math.min(...crossings)).toISOString(),
    source: 'Service schedule',
  };
};

/** Every item's alarm on one genset, in schedule order. */
export const serviceNotices = (
  gensetId: string,
  status: ServiceStatus,
  now: number,
): Array<ServiceNotice> =>
  status.items.flatMap((item) => serviceNoticeOf(gensetId, item, now) ?? []);

/**
 * "Due in 63 h", "Overdue by 41 h", "Not recorded" — service, in a strip tile.
 *
 * The strip carries one figure per column and service has two counters, so this
 * reports the **binding** one: the counter that set the severity is the counter
 * that will send somebody, and naming the other would be answering a question
 * nobody asked of a summary. The Service tab shows both.
 *
 * A never-serviced set reads `Not recorded` rather than a number. It is
 * unmeasured, not due — the same distinction `serviceNoticeOf` refuses to collapse,
 * and a tile printing `0 h of 250 h` would assert a service that never happened.
 */
export const serviceHeadline = (status: ServiceStatus): string => {
  if (status.kind === 'never-serviced') return 'Not recorded';

  const overshoot = counterOvershoot(bindingCounter(status));
  const remaining = -overshoot;

  if (status.binding === 'hours') {
    const hours = figure(Math.round(Math.abs(overshoot)));
    return overshoot >= 0 ? `Overdue by ${hours} h` : `Due in ${hours} h`;
  }

  return overshoot >= 0
    ? `Overdue by ${overshoot.toFixed(1)} months`
    : `Due in ${remaining.toFixed(1)} months`;
};

/**
 * The default schedule, and the per-model table that overrides it.
 *
 * **These intervals are typical diesel-genset figures standing in for the
 * operations team's.** Engine oil and its filter at `250 h / 6 months` is the
 * single interval the whole set ran on until 2026-10-05, so a fleet on the
 * defaults reads exactly as it did. The rest are the usual longer items. They land
 * here, in one table, and nothing else in the app has to move when they change.
 */
export const DEFAULT_SCHEDULE: ServiceSchedule = {
  items: [
    {id: 'engine-oil', name: 'Engine oil and filter', intervalHours: 250, intervalMonths: 6},
    {id: 'fuel-filter', name: 'Fuel filter', intervalHours: 500, intervalMonths: 12},
    {id: 'air-filter', name: 'Air filter', intervalHours: 500, intervalMonths: 12},
    {id: 'belts', name: 'Drive belts', intervalHours: 1000, intervalMonths: 12},
    {id: 'coolant', name: 'Coolant', intervalHours: 2000, intervalMonths: 24},
    {id: 'battery', name: 'Battery', intervalMonths: 24},
  ],
};

const SCHEDULE_BY_MODEL: Record<string, ServiceSchedule> = {};

export const scheduleFor = (model: string): ServiceSchedule =>
  SCHEDULE_BY_MODEL[model] ?? DEFAULT_SCHEDULE;
