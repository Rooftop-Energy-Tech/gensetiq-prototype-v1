import {useSyncExternalStore} from 'react';

import type {Genset, GensetActivity} from '../types/genset.type';
import {scheduleFor, serviceStatus} from '../types/service.type';
import type {ServiceRecord, ServiceSchedule, ServiceStatus} from '../types/service.type';
import {GENSETS} from './fleet';
import {gensetDetail} from './detail';
import {serviceProfile} from './serviceSeed';

/**
 * The services each genset has had — the seeded history, plus whatever an
 * operator has logged in this browser.
 *
 * ## The same store pattern as `deployment.ts`
 *
 * Seed underneath, `localStorage` overrides on top, `useSyncExternalStore` to
 * push changes into React. A logged service is the same kind of fact as a
 * relocation — something a person did, with no backend to tell — and inventing a
 * second pattern for it would leave the app with two answers to "where does
 * operator-entered data live".
 *
 * The one difference is direction: deployment *replaces* a seeded value, and this
 * *appends* to a seeded list. So the store holds only the logged records and the
 * seed is concatenated on read, which means clearing site data returns the fleet
 * to the history the prototype was built against.
 *
 * ## Attachments do not persist, and that is deliberate
 *
 * A record's metadata goes into `localStorage`. Its PDF cannot: the sample
 * checklist is 1.2 MB, which base64-encodes to about 1.7 MB against a quota of
 * roughly 5 MB. The first attachment fits, the second probably fits, and the
 * third throws — mid-demo, on the write, with the record already half-committed.
 *
 * So a freshly attached PDF is held as an object URL in a module-level map and
 * lives as long as the tab does. After a reload the record survives and the file
 * does not, and the history row says so in as many words. A limit named on the
 * screen is a smaller problem than a quota cliff nobody saw coming.
 *
 * Seeded records point at a real PDF bundled in `public/`, so the demo path — open
 * a genset, read its history, open the report — never depends on any of this.
 */

const STORAGE_KEY = 'gensetiq.services';

/** Per-genset interval overrides, keyed by genset id. */
const SCHEDULE_KEY = 'gensetiq.serviceSchedules';

/**
 * One clock reading for the whole service layer, taken at module load.
 *
 * Same rule as `detail.ts` and `history.ts`: two units must not disagree about
 * what time it is. A fleet seeded across a midnight boundary would show one set
 * as five months since service and its neighbour as six, for no reason but the
 * order they were built in.
 */
const NOW = Date.now();

/** The bundled checklist every seeded record points at. */
const SAMPLE_REPORT_URL = '/sample-service-report.pdf';

/** What actually goes into `localStorage` — no object URL, since it cannot survive. */
type StoredRecord = Omit<ServiceRecord, 'document'> & {documentFileName: string};

const read = (): Array<StoredRecord> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? [] : (JSON.parse(raw) as Array<StoredRecord>);
  } catch {
    // Private mode, or a value written in some earlier shape. The seeded history
    // is a complete, correct answer — not worth taking the page down for.
    return [];
  }
};

/**
 * Object URLs for PDFs attached in this session, keyed by record id.
 *
 * Outside the persisted store on purpose — see the note above. A record whose id
 * is absent here has a filename and no file, which the history renders as an
 * inert link rather than a broken one.
 */
const attachments = new Map<string, string>();

const listeners = new Set<() => void>();

/**
 * The seeded history, built backwards from each unit's current hour meter.
 *
 * `engineHoursAtService = currentEngineHours − elapsedHours` — the direction
 * `history.ts` insists on, and the reason the Service tab's counter and the
 * `engine-hours` reading beside it cannot disagree.
 *
 * The site is the unit's **seeded** site rather than its current one. That is the
 * snapshot rule doing visible work: relocate a set in the app and its past
 * services still name the yard they were performed in.
 */
const buildSeeded = (): Array<ServiceRecord> =>
  GENSETS.flatMap((genset) => {
    const profile = serviceProfile(genset.id);
    if (profile === null) return [];

    const engineHours = gensetDetail(genset.id)?.readings['engine-hours'].value ?? 0;

    const performedAt = new Date(NOW);
    // Whole months back, then the fractional part in days against a 30-day
    // month. The fraction only exists so a seeded fleet does not have every
    // service falling on the same day of the month.
    const wholeMonths = Math.floor(profile.elapsedMonths);
    performedAt.setMonth(performedAt.getMonth() - wholeMonths);
    performedAt.setDate(performedAt.getDate() - Math.round((profile.elapsedMonths % 1) * 30));
    // A service happens in a working day, not at whatever o'clock the page was
    // opened. 9am–4pm, stable per unit.
    performedAt.setHours(9 + (genset.tag.codePointAt(0) ?? 0) % 8, (genset.tag.codePointAt(1) ?? 0) % 60, 0, 0);

    return [
      {
        id: `${genset.id}-service-seed`,
        gensetId: genset.id,
        siteId: genset.siteId ?? '',
        performedAt: performedAt.toISOString(),
        technicianName: profile.technicianName,
        engineHoursAtService: Math.round((engineHours - profile.elapsedHours) * 10) / 10,
        document: {fileName: 'Genset inspection checklist.pdf', url: SAMPLE_REPORT_URL},
        notes: profile.notes,
      },
    ];
  });

const SEEDED: Array<ServiceRecord> = buildSeeded();

/** A stored record rehydrated — its file attached if this session still has it. */
const hydrate = (stored: StoredRecord): ServiceRecord => {
  const {documentFileName, ...rest} = stored;
  return {
    ...rest,
    document: {fileName: documentFileName, url: attachments.get(stored.id) ?? null},
  };
};

const compose = (stored: Array<StoredRecord>): Array<ServiceRecord> =>
  [...SEEDED, ...stored.map(hydrate)].sort(
    (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
  );

/**
 * The intervals, where a genset has been given its own.
 *
 * Overrides only — a unit absent from this map uses `scheduleFor(model)`, which
 * is the same arrangement `deployment.ts` uses for placements and for the same
 * reason: the store then holds only genuine decisions, and clearing site data
 * returns the fleet to the schedule the prototype ships with rather than to
 * whatever the last person typed.
 *
 * It matters more here than there, because the shipped defaults are a
 * placeholder. `250 h / 6 months` is standing in for an answer the operations
 * team has not given yet, so the fleet-wide value has to stay changeable in one
 * place while individual sets can already be corrected in the UI.
 */
type ScheduleOverrides = Record<string, ServiceSchedule>;

const readSchedules = (): ScheduleOverrides => {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as ScheduleOverrides);
  } catch {
    return {};
  }
};

let stored: Array<StoredRecord> = read();
let schedules: ScheduleOverrides = readSchedules();
let snapshot: Array<ServiceRecord> = compose(stored);

const emit = () => {
  stored = read();
  schedules = readSchedules();
  snapshot = compose(stored);
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Every service on record, newest first.
 *
 * The array identity is stable between changes, which is what keeps
 * `useSyncExternalStore` from looping.
 */
export const serviceRecords = (): Array<ServiceRecord> => snapshot;

/** One genset's history, newest first. The head is what the counters measure from. */
export const gensetServices = (gensetId: string): Array<ServiceRecord> =>
  serviceRecords().filter((record) => record.gensetId === gensetId);

/**
 * The whole log, live.
 *
 * Filtering to one genset is left to the caller: the store cannot memoise a
 * per-id slice without keeping a cache keyed by id, and `useSyncExternalStore`
 * demands a stable snapshot — a fresh `filter()` on every read would loop.
 */
export const useServiceRecords = (): Array<ServiceRecord> =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );

/**
 * A genset's current engine-hour reading — the figure the run-hour counter is
 * measured down from.
 */
export const engineHoursOf = (gensetId: string): number =>
  gensetDetail(gensetId)?.readings['engine-hours'].value ?? 0;

/**
 * Whether this genset is due, live.
 *
 * `now` is a parameter so a page rendering several of these measures them all
 * against one clock reading. Defaulted, because most callers render one genset
 * and threading a timestamp through for that would be ceremony.
 */
export const useServiceStatus = (gensetId: string, now: number = NOW): ServiceStatus => {
  const records = useServiceRecords();
  const history = records.filter((record) => record.gensetId === gensetId);

  return serviceStatus(history[0], scheduleOf(gensetId), engineHoursOf(gensetId), now);
};

/**
 * This genset's intervals — its own if it has been given any, the model's
 * default otherwise.
 */
export const scheduleOf = (gensetId: string): ServiceSchedule => {
  const override = schedules[gensetId];
  if (override !== undefined) return override;

  const genset = GENSETS.find((candidate) => candidate.id === gensetId);
  return scheduleFor(genset?.model ?? '');
};

/**
 * Set this genset's intervals.
 *
 * Both are floored at 1. A zero interval means "due the instant it is serviced",
 * which is not a schedule anybody wants and which `severityOf` would have to
 * special-case anyway; refusing to store it is cheaper than teaching every
 * reader to expect it.
 */
export const setSchedule = (gensetId: string, schedule: ServiceSchedule) => {
  const next: ScheduleOverrides = {
    ...schedules,
    [gensetId]: {
      intervalHours: Math.max(1, Math.round(schedule.intervalHours)),
      intervalMonths: Math.max(1, Math.round(schedule.intervalMonths)),
    },
  };

  try {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — the change just won't survive a reload. */
  }
  emit();
};

/**
 * A genset's activity feed with its services folded in, newest first.
 *
 * The feed used to carry a hardcoded "Scheduled 250-hour service completed" from
 * `fleet.ts`, on every unit, eight days ago. That line is gone: a service in the
 * feed is now the same service the log holds, so the two cannot say different
 * things about the same visit — and a service logged in this session appears in
 * the feed the moment it is saved, which a seeded string could never do.
 */
export const withServiceActivity = (
  genset: Genset,
  records: Array<ServiceRecord>,
): Array<GensetActivity> => {
  const services: Array<GensetActivity> = records
    .filter((record) => record.gensetId === genset.id)
    .map((record) => ({
      id: `${record.id}-activity`,
      kind: 'SERVICE' as const,
      message: `Service completed by ${record.technicianName}`,
      at: record.performedAt,
    }));

  return [...genset.activity, ...services].sort(
    (left, right) => new Date(right.at).getTime() - new Date(left.at).getTime(),
  );
};

/** What the log-service form collects. The record's id and document are made here. */
export type ServiceInput = {
  gensetId: string;
  siteId: string;
  performedAt: string;
  technicianName: string;
  engineHoursAtService: number;
  /** The attached PDF, or `null` if the operator did not attach one. */
  file: File | null;
  notes?: string;
};

/**
 * Record a service.
 *
 * The record is appended rather than replacing anything: a genset's history is
 * the list of visits it has had, and the counters read the newest one. Logging a
 * service dated *before* the current head is therefore possible and harmless —
 * it lands in the history where it belongs and the counters do not move, which
 * is the correct behaviour for entering a visit somebody forgot to write up.
 */
export const logService = (input: ServiceInput): ServiceRecord => {
  const id = `${input.gensetId}-service-${Date.now().toString(36)}`;

  const record: StoredRecord = {
    id,
    gensetId: input.gensetId,
    siteId: input.siteId,
    performedAt: input.performedAt,
    technicianName: input.technicianName,
    engineHoursAtService: input.engineHoursAtService,
    documentFileName: input.file?.name ?? 'No report attached',
    notes: input.notes === undefined || input.notes.trim() === '' ? undefined : input.notes.trim(),
  };

  if (input.file !== null) attachments.set(id, URL.createObjectURL(input.file));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...stored, record]));
  } catch {
    /* Private mode, or quota — the service just won't survive a reload. */
  }
  emit();

  return hydrate(record);
};
