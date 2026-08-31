import {useSyncExternalStore} from 'react';

import type {SolarSystem} from '../types/system.type';
import type {SystemDetail} from './systemDetail';

/**
 * One system's history, assembled the way the genset's is: **every line derived
 * from a record something else already owns**, plus one store this module keeps
 * itself for the note an operator types.
 *
 * `activity.ts` next door makes the argument in full and it holds here — a feed
 * that is one seeded list per asset is a display with no inlet, and nothing a
 * reader does anywhere in the app can ever appear in it.
 *
 * ## Why the note store is a second store rather than the genset's
 *
 * Its rows are typed `gensetId`, and filing a system's note under that field
 * because the ids happen not to collide is the kind of shortcut that is
 * discovered years later by somebody counting gensets. The two stores hold
 * different subjects, are never merged and are never summed, so there is no
 * figure they can drift into disagreeing about — which is the usual reason this
 * codebase refuses a copy, and it does not apply.
 */

export type SystemActivityKind = 'COMMISSION' | 'FAULT' | 'CLEAN' | 'SILENCE' | 'NOTE';

export type SystemActivity = {
  id: string;
  kind: SystemActivityKind;
  message: string;
  /** ISO 8601. */
  at: string;
  /** Where the line came from. Absent on a note, which prints its author instead. */
  source?: string;
};

export type SystemNote = {
  id: string;
  systemId: string;
  message: string;
  at: string;
  by: string;
};

const STORAGE_KEY = 'gensetiq.solarNotes';

const listeners = new Set<() => void>();

const read = (): Array<SystemNote> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? [] : (JSON.parse(raw) as Array<SystemNote>);
  } catch {
    return [];
  }
};

let notes: Array<SystemNote> = read();

const write = (next: Array<SystemNote>) => {
  notes = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the note lives for the session and that is all.
  }
  for (const listener of listeners) listener();
};

export const addSystemNote = (systemId: string, message: string, by: string): void => {
  const trimmed = message.trim();
  if (trimmed === '') return;

  write([
    {
      id: `note-${systemId}-${Date.now()}`,
      systemId,
      message: trimmed,
      at: new Date().toISOString(),
      by,
    },
    ...notes,
  ]);
};

export const useSystemNotes = (): Array<SystemNote> =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notes,
    () => notes,
  );

/**
 * The feed, newest first.
 *
 * Four derived kinds and the typed note. Each of the four is a **restatement of
 * something else on this page** rather than a new claim: the commissioning date
 * is the header's, the fault is the health band's and names the same box, the
 * wash is the reading the soiling rule watches, and a silence is a state the
 * inverter list is showing. That is deliberate — a log whose entries cannot be
 * checked against anything is a list — and it is why there is no dealt "firmware
 * updated" line here, plausible as one would look.
 */
export const systemActivityLog = (
  system: SolarSystem,
  detail: SystemDetail,
  notesForSystem: Array<SystemNote>,
  now: number = Date.now(),
): Array<SystemActivity> => {
  const boxes =
    system.inverters.length === 1
      ? system.inverters[0].model
      : `${system.inverters.length} × ${system.inverters[0].model}`;

  const events: Array<SystemActivity> = [
    {
      id: `${system.id}-commissioned`,
      kind: 'COMMISSION',
      message: `${system.kwp} kWp commissioned on ${system.strings} strings, ${boxes}.`,
      at: system.commissionedAt,
      source: 'Asset register',
    },
  ];

  const cleaned = detail.readings.find((reading) => reading.key === 'days-since-clean');
  if (cleaned !== undefined) {
    events.push({
      id: `${system.id}-cleaned`,
      kind: 'CLEAN',
      message: 'Modules washed.',
      at: new Date(now - cleaned.value * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Service schedule',
    });
  }

  if (detail.onsetAt !== undefined && system.downStrings > 0) {
    // Named to the box, because that is the whole value of the line. "Output
    // stepped down" is a fact; "Output stepped down — 9 of 13 strings on
    // Inverter 4" is somewhere to send a technician.
    const faulted = system.inverters.filter((one) => one.downStrings > 0);
    const where = faulted.map((one) => `${one.downStrings} on ${one.label}`).join(', ');

    events.push({
      id: `${system.id}-string-out`,
      kind: 'FAULT',
      message: `Output stepped down — ${system.downStrings} of ${system.strings} strings stopped delivering (${where}).`,
      at: detail.onsetAt,
      source: 'Design benchmark',
    });
  }

  for (const inverter of system.inverters) {
    if (inverter.state !== 'OFFLINE') continue;

    events.push({
      id: `${system.id}-silence-${inverter.id}`,
      kind: 'SILENCE',
      message: `Last contact with ${inverter.label}.`,
      at: inverter.lastUpdated,
      source: 'Inverter',
    });
  }

  for (const note of notesForSystem) {
    events.push({id: note.id, kind: 'NOTE', message: note.message, at: note.at, source: note.by});
  }

  return events.sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
};
