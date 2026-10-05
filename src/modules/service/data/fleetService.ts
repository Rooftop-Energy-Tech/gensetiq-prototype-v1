import {useMemo} from 'react';

import {figure, numericDate} from '@/lib/format';
import {malaysiaStateAt, malaysiaStateName} from '@/lib/geo/malaysiaStates';
import {gensetStateName} from '@/modules/genset/data/gensetState';
import {engineHoursOf, scheduleOf, useServiceRecords} from '@/modules/genset/data/services';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import type {Genset} from '@/modules/genset/types/genset.type';
import {calendarDueDate, serviceStatus} from '@/modules/genset/types/service.type';
import type {ServiceCounter, ServiceRecord, ServiceStatus} from '@/modules/genset/types/service.type';
import {siteSeed} from '@/modules/site/data/siteSeed';
import type {ServiceHistorySort, ServiceSort, ServiceSortDirection, ServiceStanding} from '../types/view.type';

/**
 * One genset's line on the fleet service page.
 *
 * `status` is exactly what the genset's own Service tab computes — same record, same
 * schedule, same meter — so the two pages cannot disagree about a machine.
 */
export type FleetServiceRow = {
  genset: Genset;
  status: ServiceStatus;
  standing: ServiceStanding;
  /** How far through its interval the nearer counter is; >1 is overdue. */
  progress: number;
  /** The counter nearer its limit — what `Next due` is about. `undefined` if never serviced. */
  nearer: ServiceCounter | undefined;
};

export const standingOf = (status: ServiceStatus): ServiceStanding => {
  if (status.kind === 'never-serviced') return 'never';
  return status.severity === 'OVERDUE' ? 'overdue' : status.severity === 'DUE_SOON' ? 'due-soon' : 'ok';
};

const ratio = (counter: ServiceCounter | undefined): number =>
  counter === undefined || counter.interval <= 0 ? 0 : counter.elapsed / counter.interval;

/**
 * Worst first: overdue, due soon, never serviced, then in service. A set with no
 * record sits above the healthy ones because it needs a visit to start its clock,
 * and below the due ones because nothing says it is worn. Within a band, further
 * through its interval first.
 */
const STANDING_RANK: Record<ServiceStanding, number> = {overdue: 0, 'due-soon': 1, never: 2, ok: 3};

export const useFleetService = (fleet: Array<Genset>): Array<FleetServiceRow> => {
  const records = useServiceRecords();

  return useMemo(() => {
    const now = Date.now();
    // Records are newest first, as `gensetServices` hands them out, and stay so per set.
    const byGenset = new Map<string, Array<ServiceRecord>>();
    for (const record of records) byGenset.set(record.gensetId, [...(byGenset.get(record.gensetId) ?? []), record]);

    return fleet
      .map((genset) => {
        const status = serviceStatus(byGenset.get(genset.id) ?? [], scheduleOf(genset.id), engineHoursOf(genset.id), now);
        // The most urgent item's nearer counter. An item on one interval has only that one.
        const nearer =
          status.kind === 'never-serviced'
            ? undefined
            : status.calendar === undefined || (status.hours !== undefined && ratio(status.hours) >= ratio(status.calendar))
              ? status.hours
              : status.calendar;
        return {genset, status, standing: standingOf(status), progress: nearer ? ratio(nearer) : 0, nearer};
      })
      .sort(
        (left, right) =>
          STANDING_RANK[left.standing] - STANDING_RANK[right.standing] || right.progress - left.progress,
      );
  }, [fleet, records]);
};

/**
 * What each Due-table header sorts by. `undefined` is a set with nothing to sort on
 * (never serviced, or in no state) and goes last whichever way the header runs, as a
 * stateless set does on the gensets register.
 */
const SORT_KEY: Record<ServiceSort, (row: FleetServiceRow) => number | string | undefined> = {
  standing: (row) => STANDING_RANK[row.standing] - row.progress / 1000,
  name: (row) => gensetLabel(row.genset),
  location: (row) => gensetStateName(row.genset),
  due: (row) => (row.nearer === undefined ? undefined : row.progress),
  hours: (row) => (row.status.kind === 'tracked' && row.status.hours !== undefined ? ratio(row.status.hours) : undefined),
  time: (row) =>
    row.status.kind === 'tracked' && row.status.calendar !== undefined ? ratio(row.status.calendar) : undefined,
  last: (row) => (row.status.kind === 'tracked' ? Date.parse(row.status.lastService.performedAt) : undefined),
};

/** Both tables' sort: by one key, `undefined` last either way, stable on ties. */
const sortBy = <T,>(
  items: Array<T>,
  key: (item: T) => number | string | undefined,
  direction: ServiceSortDirection,
): Array<T> => {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((left, right) => {
    const a = key(left);
    const b = key(right);
    if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1;
    return sign * (typeof a === 'string' ? a.localeCompare(String(b)) : a - Number(b));
  });
};

/** The Due rows in the header's order. Ties keep the worst-first ranking, since the sort is stable. */
export const sortFleetService = (
  rows: Array<FleetServiceRow>,
  sort: ServiceSort,
  direction: ServiceSortDirection,
): Array<FleetServiceRow> => sortBy(rows, SORT_KEY[sort], direction);

/**
 * The History rows in the header's order (Jeff, 2026-10-05). The log arrives newest
 * first and the sort is stable, so ties — one plate, one technician — stay newest first.
 * A record whose set has left the fleet sorts by the id it is listed under.
 */
export const sortServiceHistory = (
  records: Array<ServiceRecord>,
  byId: Map<string, Genset>,
  sort: ServiceHistorySort,
  direction: ServiceSortDirection,
): Array<ServiceRecord> => {
  const key: Record<ServiceHistorySort, (record: ServiceRecord) => number | string> = {
    name: (record) => {
      const genset = byId.get(record.gensetId);
      return genset === undefined ? record.gensetId : gensetLabel(genset);
    },
    date: (record) => Date.parse(record.performedAt),
    technician: (record) => record.technicianName,
    hours: (record) => record.engineHoursAtService,
  };
  return sortBy(records, key[sort], direction);
};

/**
 * When the nearer counter comes due — a date for the calendar, hours for the meter —
 * and which schedule item it is (2026-10-05).
 */
export const nextDue = (row: FleetServiceRow): {text: string; overdue: boolean; item: string} | undefined => {
  const {status, nearer} = row;
  if (status.kind === 'never-serviced' || nearer === undefined) return undefined;

  if (nearer.kind === 'hours') {
    const left = Math.round(nearer.interval - nearer.elapsed);
    // `63 h`, the app's one unit for run hours (2026-10-05). It was spelled out as
    // `running hours` from 2026-09-30, when `run h` read as a unit code; the column
    // is headed `Run hours` now, so the bare unit has its noun beside it.
    const hours = (count: number) => `${figure(count)} h`;
    return left <= 0
      ? {text: `${hours(Math.abs(left))} over`, overdue: true, item: status.item.name}
      : {text: `In ${hours(left)}`, overdue: false, item: status.item.name};
  }

  const due = calendarDueDate(status.lastService, nearer.interval);
  const date = numericDate(due.getTime());
  // `Due on` / `Was due on` so a bare date is not left to explain itself.
  return due.getTime() <= Date.now()
    ? {text: `Was due on ${date}`, overdue: true, item: status.item.name}
    : {text: `Due on ${date}`, overdue: false, item: status.item.name};
};

/** The state a service was done in — its site's, not where the set is today. */
export const recordStateName = (record: ServiceRecord, genset: Genset | undefined): string | undefined => {
  // Done in the depot: no yard, so no state — not the state the set is in today.
  if (record.siteId === '') return undefined;
  const site = siteSeed(record.siteId);
  if (site !== undefined) {
    const id = malaysiaStateAt(site.longitude, site.latitude);
    return id === undefined ? undefined : malaysiaStateName(id);
  }
  return genset === undefined ? undefined : gensetStateName(genset);
};
