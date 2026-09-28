import {useMemo} from 'react';

import {malaysiaStateAt, malaysiaStateName} from '@/lib/geo/malaysiaStates';
import {gensetStateName} from '@/modules/genset/data/gensetState';
import {engineHoursOf, scheduleOf, useServiceRecords} from '@/modules/genset/data/services';
import type {Genset} from '@/modules/genset/types/genset.type';
import {calendarDueDate, serviceStatus} from '@/modules/genset/types/service.type';
import type {ServiceCounter, ServiceRecord, ServiceStatus} from '@/modules/genset/types/service.type';
import {siteSeed} from '@/modules/site/data/siteSeed';
import type {ServiceStanding} from '../types/view.type';

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

const ratio = (counter: ServiceCounter): number =>
  counter.interval > 0 ? counter.elapsed / counter.interval : 0;

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
    const latest = new Map<string, ServiceRecord>();
    // Records are newest first, as `gensetServices` hands them out.
    for (const record of records) if (!latest.has(record.gensetId)) latest.set(record.gensetId, record);

    return fleet
      .map((genset) => {
        const status = serviceStatus(latest.get(genset.id), scheduleOf(genset.id), engineHoursOf(genset.id), now);
        const nearer =
          status.kind === 'never-serviced'
            ? undefined
            : ratio(status.hours) >= ratio(status.calendar)
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

/** When the nearer counter comes due — a date for the calendar, hours for the meter. */
export const nextDue = (row: FleetServiceRow): {text: string; overdue: boolean} | undefined => {
  const {status, nearer} = row;
  if (status.kind === 'never-serviced' || nearer === undefined) return undefined;

  if (nearer.kind === 'hours') {
    const left = Math.round(nearer.interval - nearer.elapsed);
    return left <= 0
      ? {text: `${Math.abs(left).toLocaleString('en-MY')} h over`, overdue: true}
      : {text: `in ${left.toLocaleString('en-MY')} run h`, overdue: false};
  }

  const due = calendarDueDate(status.lastService, status.schedule);
  const date = due.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  return due.getTime() <= Date.now() ? {text: `was due ${date}`, overdue: true} : {text: date, overdue: false};
};

/** The state a service was done in — its site's, not where the set is today. */
export const recordStateName = (record: ServiceRecord, genset: Genset | undefined): string | undefined => {
  const site = siteSeed(record.siteId);
  if (site !== undefined) {
    const id = malaysiaStateAt(site.longitude, site.latitude);
    return id === undefined ? undefined : malaysiaStateName(id);
  }
  return genset === undefined ? undefined : gensetStateName(genset);
};
