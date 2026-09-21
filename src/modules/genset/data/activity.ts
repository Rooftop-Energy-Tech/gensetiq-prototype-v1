import {useSyncExternalStore} from 'react';

import type {Genset, GensetActivity} from '../types/genset.type';
import type {ServiceRecord} from '../types/service.type';
import {gensetDeployments} from './deployments';

/**
 * The activity log, assembled from the systems that actually witness events.
 *
 * **Nothing renders this any more.** The "Activity" band closed the genset home
 * page and the fleet panel; both are gone, the same way `/solar`'s feed went.
 * The derivation, the note store and `ActivityFeed` are all still here and still
 * correct, unreferenced, if it is wanted back.
 *
 * The feed used to be one seeded list per genset, which made it a display with
 * no inlet: nothing an operator did anywhere in the app could put a line in
 * it. Now every entry is derived from a record another screen already owns,
 * plus one store this module owns itself — the manual note. Each entry names
 * its source, because an audit trail whose lines cannot say who put them
 * there is a list rather than a log.
 *
 * The sources, and what each contributes:
 *
 *  - **Controller** — the machine's own event stream: starts with their
 *    reason, stops, faults. Seeded in `fleet.ts`, as telemetry would be.
 *  - **Dispatch** — one line when a posting opens, one when it closes, read
 *    off the same `DeploymentSession` rows the dispatch feed lists.
 *  - **Service log** — one line per recorded service, as before.
 *  - **Manual** — an operator's own note, typed on the dashboard and held in
 *    `localStorage` with the same posture as every other override store in
 *    this prototype: overrides only, no backend, a fresh browser starts
 *    clean.
 */

// ─── Manual notes ─────────────────────────────────────────────────────────────

export type ActivityNote = {
  id: string;
  gensetId: string;
  message: string;
  /** ISO 8601 — when the note was logged. */
  at: string;
  /** Who logged it — the signed-in session's email. */
  by: string;
};

const STORAGE_KEY = 'gensetiq.activityNotes';

const listeners = new Set<() => void>();

const read = (): Array<ActivityNote> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? [] : (JSON.parse(raw) as Array<ActivityNote>);
  } catch {
    return [];
  }
};

let notes: Array<ActivityNote> = read();

const write = (next: Array<ActivityNote>) => {
  notes = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the note lives for the session and that is all.
  }
  for (const listener of listeners) listener();
};

export const addActivityNote = (gensetId: string, message: string, by: string): void => {
  const trimmed = message.trim();
  if (trimmed === '') return;

  write([
    {
      id: `note-${gensetId}-${Date.now()}`,
      gensetId,
      message: trimmed,
      at: new Date().toISOString(),
      by,
    },
    ...notes,
  ]);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useActivityNotes = (): Array<ActivityNote> =>
  useSyncExternalStore(subscribe, () => notes);

// ─── The merged log ───────────────────────────────────────────────────────────

/**
 * The posting's own two entries: dropped here, and collected if it ever
 * was.
 *
 * On this estate the first of those is years old and the second has not
 * happened, so a set's feed opens with one line at the very bottom and nothing
 * else from this source. That is the correct amount of noise for a fact that
 * changes once a decade — and it is still worth a line, because "since when has
 * this machine been the one on this plinth" is the question a fault report
 * starts with.
 */
const deploymentEntries = (genset: Genset): Array<GensetActivity> =>
  gensetDeployments(genset.id).flatMap((deployment) => {
    const entries: Array<GensetActivity> = [
      {
        id: `${deployment.id}-open`,
        kind: 'DEPLOY',
        message: `Deployed to ${deployment.locationLabel} on ${deployment.lorryPlate}`,
        at: deployment.startedAt,
        source: 'Asset register',
      },
    ];

    if (deployment.endedAt !== null) {
      entries.push({
        id: `${deployment.id}-close`,
        kind: 'DEPLOY',
        message: `Collected from ${deployment.locationLabel}`,
        at: deployment.endedAt,
        source: 'Asset register',
      });
    }

    return entries;
  });

const serviceEntries = (genset: Genset, records: Array<ServiceRecord>): Array<GensetActivity> =>
  records
    .filter((record) => record.gensetId === genset.id)
    .map((record) => ({
      id: `${record.id}-activity`,
      kind: 'SERVICE' as const,
      message: `Service completed by ${record.technicianName}`,
      at: record.performedAt,
      source: 'Service log',
    }));

const noteEntries = (genset: Genset, all: Array<ActivityNote>): Array<GensetActivity> =>
  all
    .filter((note) => note.gensetId === genset.id)
    .map((note) => ({
      id: note.id,
      kind: 'NOTE' as const,
      message: note.message,
      at: note.at,
      source: `Logged by ${note.by}`,
    }));

/**
 * Everything known to have happened to this machine, newest first.
 *
 * The controller's own "Refuelled to full" line is the delivery record again. It
 * used to be filtered out in favour of a completed refuel order, which carried the
 * same event with a booking behind it; with the order log gone (GEN-25) the
 * controller is the only witness left, and one record of one delivery is the point.
 */
export const gensetActivityLog = (
  genset: Genset,
  records: Array<ServiceRecord>,
  allNotes: Array<ActivityNote>,
): Array<GensetActivity> => {
  const controller = genset.activity.map((event) => ({
    ...event,
    source: event.source ?? 'Controller',
  }));

  return [
    ...controller,
    ...deploymentEntries(genset),
    ...serviceEntries(genset, records),
    ...noteEntries(genset, allNotes),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
};
