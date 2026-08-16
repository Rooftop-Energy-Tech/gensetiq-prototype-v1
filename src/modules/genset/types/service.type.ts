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
 * How often this genset is serviced — the two intervals, always both.
 *
 * Not optional individually. A schedule with only an hour interval would let a
 * set that never runs go unserviced forever, and one with only a calendar
 * interval would let a set worked around the clock run three intervals' worth of
 * hours between visits. The pair is the schedule; either alone is a different and
 * worse policy.
 */
export type ServiceSchedule = {
  /** Run hours between services. */
  intervalHours: number;
  /** Calendar months between services, run or not. */
  intervalMonths: number;
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
};

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
export type ServiceStatus =
  | {kind: 'never-serviced'; schedule: ServiceSchedule}
  | {
      kind: 'tracked';
      schedule: ServiceSchedule;
      lastService: ServiceRecord;
      hours: ServiceCounter;
      calendar: ServiceCounter;
      /** The worse of the two counters. */
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

/** The date this genset's calendar interval falls due, from its last service. */
export const calendarDueDate = (lastService: ServiceRecord, schedule: ServiceSchedule): Date => {
  const due = new Date(lastService.performedAt);
  due.setMonth(due.getMonth() + schedule.intervalMonths);
  return due;
};

/**
 * The two counters and the verdict, from the last service and the hour meter.
 *
 * `currentEngineHours` is passed in rather than read here because this file has
 * no business knowing where telemetry comes from — and because the caller has to
 * hold one clock reading and one meter reading for a whole page, or two rows
 * rendered a millisecond apart can disagree about the same machine.
 */
export const serviceStatus = (
  lastService: ServiceRecord | undefined,
  schedule: ServiceSchedule,
  currentEngineHours: number,
  now: number = Date.now(),
): ServiceStatus => {
  if (lastService === undefined) return {kind: 'never-serviced', schedule};

  // Clamped at zero: a technician's written figure can land below the meter's
  // current value if the panel was replaced, and a negative "hours since
  // service" is a data-entry story, not a machine one.
  const hoursElapsed = Math.max(0, currentEngineHours - lastService.engineHoursAtService);
  const monthsElapsed = Math.max(0, monthsBetween(lastService.performedAt, now));

  const hours: ServiceCounter = {
    kind: 'hours',
    elapsed: hoursElapsed,
    interval: schedule.intervalHours,
    severity: severityOf(hoursElapsed, schedule.intervalHours),
  };

  const calendar: ServiceCounter = {
    kind: 'calendar',
    elapsed: monthsElapsed,
    interval: schedule.intervalMonths,
    severity: severityOf(monthsElapsed, schedule.intervalMonths),
  };

  const severity = worse(hours.severity, calendar.severity);

  return {
    kind: 'tracked',
    schedule,
    lastService,
    hours,
    calendar,
    severity,
    binding: hours.severity === severity ? 'hours' : 'calendar',
  };
};

/**
 * An overdue service, as something the alerts section can render.
 *
 * ## Why this is not a `GensetAlert`
 *
 * Because `alert.type.ts` says what a `GensetAlert` is, and it is not this: "an
 * alert is a **bit in the controller's alarm map**, and the set of them is
 * closed … Invented alarms are not allowed here, however plausible they read."
 * Every alert card on the home page names the Modbus register and bit it came
 * from, which is what lets a reader trace any row back to the sheet.
 *
 * A service falling overdue is not a bit on any panel. It is the app comparing a
 * date and an hour meter against a policy — a real thing worth showing in the
 * same place, and a different *kind* of thing. Adding it to the alarm list would
 * have been one line and would have cost the alerts page the only invariant it
 * actually defends: once one row on it is invented, none of them can be trusted
 * to be real.
 *
 * So it renders alongside the alarms, in the same section, visibly sourced from
 * the app. `source` is what the card prints where an alarm prints its register.
 */
export type ServiceNotice = {
  id: string;
  gensetId: string;
  severity: ServiceSeverity;
  /** Which counter is overdue — what the card names as the reason. */
  binding: ServiceCounterKind;
  /** e.g. `Service overdue by 41 run hours`. */
  message: string;
  /** Always the app. Printed where an alarm card prints its register and bit. */
  source: 'Service schedule';
};

/**
 * The notice for a genset, or `undefined` when there is nothing to say.
 *
 * Only `OVERDUE` produces one. `DUE_SOON` deliberately does not: the alerts
 * section is what an operator scans to decide where to send somebody today, and
 * a fleet that puts a row there for every set within 10% of its interval trains
 * people to skim past the section. Due-soon is on the Service tab, which is
 * where somebody planning next week's work is already looking.
 *
 * A never-serviced genset gets no notice either. It is unmeasured, not late, and
 * a red row claiming otherwise would be asserting a service history that does
 * not exist.
 */
export const serviceNotice = (
  gensetId: string,
  status: ServiceStatus,
): ServiceNotice | undefined => {
  if (status.kind !== 'tracked' || status.severity !== 'OVERDUE') return undefined;

  const counter = status.binding === 'hours' ? status.hours : status.calendar;
  const overshoot = counterOvershoot(counter);

  return {
    id: `${gensetId}-service-overdue`,
    gensetId,
    severity: status.severity,
    binding: status.binding,
    message:
      status.binding === 'hours'
        ? `Service overdue by ${Math.round(overshoot).toLocaleString('en-MY')} run hours`
        : `Service overdue by ${overshoot.toFixed(1)} months`,
    source: 'Service schedule',
  };
};

/**
 * The default schedule, and the per-model table that overrides it.
 *
 * **`250 h / 6 months` is a placeholder standing in for an answer nobody has
 * given yet.** The questions that settle it — does it vary by set size, is there
 * a tiered minor/major schedule, do prime sites differ — are listed in this
 * change's `design.md` for the operations team. They land here, in one table,
 * and nothing else in the app has to move when they do.
 */
export const DEFAULT_SCHEDULE: ServiceSchedule = {intervalHours: 250, intervalMonths: 6};

const SCHEDULE_BY_MODEL: Record<string, ServiceSchedule> = {};

export const scheduleFor = (model: string): ServiceSchedule =>
  SCHEDULE_BY_MODEL[model] ?? DEFAULT_SCHEDULE;
