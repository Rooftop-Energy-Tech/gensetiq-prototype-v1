import {useSyncExternalStore} from 'react';

import type {Genset, GensetActivity} from '../types/genset.type';
import type {ServiceRecord} from '../types/service.type';
import {gensetDeployments} from './deployments';
import {gensetRefuelOrders} from './refuelOrders';

/**
 * The activity log, assembled from the systems that actually witness events.
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
 *  - **Refuel order** — issue and completion, read off the same orders the
 *    Refuel pages list. The seeded "Refuelled to full" controller line is
 *    dropped in favour of these: two records of one delivery would drift.
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

const dispatchEntries = (genset: Genset): Array<GensetActivity> =>
  gensetDeployments(genset.id).flatMap((deployment) => {
    const entries: Array<GensetActivity> = [
      {
        id: `${deployment.id}-open`,
        kind: 'DEPLOY',
        message: `Deployed to ${deployment.locationLabel} — carried by ${deployment.lorryPlate}`,
        at: deployment.startedAt,
        source: 'Dispatch',
      },
    ];

    if (deployment.endedAt !== null) {
      entries.push({
        id: `${deployment.id}-close`,
        kind: 'DEPLOY',
        message: `Recalled from ${deployment.locationLabel}`,
        at: deployment.endedAt,
        source: 'Dispatch',
      });
    }

    return entries;
  });

const refuelEntries = (genset: Genset): Array<GensetActivity> =>
  gensetRefuelOrders(genset.id).flatMap((order) => {
    const litres = order.litres.toLocaleString('en-MY');
    const entries: Array<GensetActivity> = [
      {
        id: `${order.id}-issued`,
        kind: 'REFUEL',
        message: `Refuel order for ${litres} L issued by ${order.issuedBy}`,
        at: order.issuedAt,
        source: 'Refuel order',
      },
    ];

    if (order.refueledAt !== null) {
      entries.push({
        id: `${order.id}-done`,
        kind: 'REFUEL',
        message: `Refuelled ${litres} L`,
        at: order.refueledAt,
        source: 'Refuel order',
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
 * The controller's seeded refuel line is dropped here: completed refuel
 * orders carry the same event with an order behind it, and a delivery that
 * appeared twice with two figures would cost the feed its authority.
 */
export const gensetActivityLog = (
  genset: Genset,
  records: Array<ServiceRecord>,
  allNotes: Array<ActivityNote>,
): Array<GensetActivity> => {
  const controller = genset.activity
    .filter((event) => event.kind !== 'REFUEL')
    .map((event) => ({...event, source: event.source ?? 'Controller'}));

  return [
    ...controller,
    ...dispatchEntries(genset),
    ...refuelEntries(genset),
    ...serviceEntries(genset, records),
    ...noteEntries(genset, allNotes),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
};
