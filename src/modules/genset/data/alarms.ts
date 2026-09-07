import {useSyncExternalStore} from 'react';

import {ALERT_SEVERITIES} from '../types/alert.type';
import type {GensetAlert} from '../types/alert.type';
import {UNHANDLED, byUrgency, isStanding} from '../types/alarmState.type';
import type {AlarmHandling, TrackedAlarm} from '../types/alarmState.type';
import {gensetDetail} from './detail';

/**
 * Who has acknowledged what, and what has been cleared.
 *
 * ## The same store pattern as `services.ts` and `deployment.ts`
 *
 * Seed underneath, `localStorage` on top, `useSyncExternalStore` to push changes
 * into React. Acknowledging an alarm is the same kind of fact as logging a
 * service — something a person did, with no backend to tell — and a third pattern
 * for it would leave the app with three answers to "where does operator-entered
 * data live".
 *
 * The seed here is *empty*, which is the one difference worth naming. A service
 * has a history the prototype ships with; an acknowledgement does not, because
 * seeding one would claim a colleague looked at an alarm that was generated at
 * module load thirty seconds ago. Every alarm therefore starts unacknowledged and
 * standing, and clearing site data returns it there.
 *
 * ## Why the handling lives here and not in the alarm
 *
 * Because on the real thing it would have to. Huawei's northbound API is a read
 * replica: `getAlarmList` returns active alarms and there is no endpoint that
 * acknowledges, clears or assigns one. Whatever an operator does in *our* UI is
 * ours to keep, keyed by the alarm's identity, or it is not kept at all. That is
 * inconvenient for one vendor and a genuine advantage across several — the same
 * store works for a Solis or a Sungrow feed without either of them having to
 * agree with Huawei about anything.
 *
 * ## What clearing does and does not mean
 *
 * It marks the alarm finished with *here*. It cannot reach the controller, and on
 * a live panel a fault still asserting its bit would raise again on the next poll
 * — which is exactly what Huawei's manual clear is for: a fault that has been
 * rectified but whose alarm did not go on its own. In this prototype the bits are
 * a fixture and never change, so a cleared alarm stays cleared. The Alarms page
 * says so on the screen rather than leaving a reader to discover it.
 */

const STORAGE_KEY = 'gensetiq.alarmHandling';

/** Keyed by `GensetAlert.id` — `brf9540-earth-fault`, unique across the fleet. */
type HandlingByAlarm = Record<string, AlarmHandling>;

const listeners = new Set<() => void>();

const read = (): HandlingByAlarm => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as HandlingByAlarm);
  } catch {
    // Private mode, or a value written in some earlier shape. Every alarm
    // unhandled is a complete, correct answer — not worth taking the page down
    // for.
    return {};
  }
};

/**
 * Memoised, because `useSyncExternalStore` compares snapshots by identity and a
 * fresh `JSON.parse` on every read is an infinite render loop. Same trap, and
 * same fix, as `session.ts`.
 */
let snapshot: HandlingByAlarm = read();

const emit = () => {
  snapshot = read();
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The whole handling map, live.
 *
 * Returned whole rather than sliced per genset for the reason `useServiceRecords`
 * is: the store cannot memoise a per-id slice without a cache keyed by id, and a
 * fresh object on every read would loop. Callers pair it with `trackedAlarms`
 * below, which is a pure join over what they are given.
 */
export const useAlarmHandling = (): HandlingByAlarm =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );

/** One alarm's handling, or the unhandled state it starts in. */
export const handlingOf = (alarmId: string): AlarmHandling => snapshot[alarmId] ?? UNHANDLED;

/**
 * The register map's alarms for this genset, each carrying its handling.
 *
 * Pure over `handling`, so a component can subscribe with `useAlarmHandling()`
 * and call this without the store having to memoise anything. Callers that only
 * need a one-off reading — `machineCondition` and the fleet counts — pass nothing
 * and get the current snapshot.
 */
export const trackedAlarms = (
  gensetId: string,
  handling: HandlingByAlarm = snapshot,
): Array<TrackedAlarm> =>
  (gensetDetail(gensetId)?.alerts ?? []).map((alert) => ({
    ...alert,
    handling: handling[alert.id] ?? UNHANDLED,
  }));

/**
 * The ones still standing — **this is the reading every screen should use** where
 * it used to read `detail.alerts`.
 *
 * `detail.alerts` remains the register map's raw list and stays correct for what
 * it is: the analysis chart draws a threshold line from it, and a line is a
 * property of the rule rather than of whether anybody has dismissed today's
 * instance of it.
 */
export const standingAlarms = (
  gensetId: string,
  handling: HandlingByAlarm = snapshot,
): Array<GensetAlert> => trackedAlarms(gensetId, handling).filter(isStanding);

/** Worst severity first, unclaimed rows above claimed ones. */
export const orderedStanding = (
  gensetId: string,
  handling: HandlingByAlarm = snapshot,
): Array<TrackedAlarm> =>
  trackedAlarms(gensetId, handling)
    .filter(isStanding)
    .sort(byUrgency((alarm) => ALERT_SEVERITIES.indexOf(alarm.severity)));

/** The cleared ones, most recently cleared first — the log half of the page. */
export const clearedAlarms = (
  gensetId: string,
  handling: HandlingByAlarm = snapshot,
): Array<TrackedAlarm> =>
  trackedAlarms(gensetId, handling)
    .filter((alarm) => !isStanding(alarm))
    .sort(
      (left, right) =>
        new Date(right.handling.clearedAt ?? 0).getTime() -
        new Date(left.handling.clearedAt ?? 0).getTime(),
    );

const write = (next: HandlingByAlarm) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode, or quota — the change just won't survive a reload. */
  }
  emit();
};

/**
 * Take an alarm on.
 *
 * Idempotent: acknowledging twice keeps the first stamp, because the useful
 * question is *when did somebody first pick this up* and re-stamping it would
 * quietly reset the clock every time a page was opened. It says nothing about the
 * fault — the alarm stays standing and stays in the active list, which is the
 * whole point of the second axis.
 */
export const acknowledgeAlarm = (alarmId: string, by: string): void => {
  const current = handlingOf(alarmId);
  if (current.acknowledgedAt !== null) return;

  write({
    ...snapshot,
    [alarmId]: {...current, acknowledgedAt: new Date().toISOString(), acknowledgedBy: by},
  });
};

/**
 * Hand an alarm back to the queue.
 *
 * The undo for `acknowledgeAlarm`, and the reason acknowledgement is worth
 * recording at all: a claim nobody can release is a claim that goes stale the
 * first time somebody clicks it on the wrong row, or takes an alarm on and then
 * finds it belongs to the crew on the other shift. Dropping the stamps puts the
 * row back at the top of the standing list, where an unclaimed alarm belongs.
 *
 * **Only while the alarm still stands.** A cleared alarm's acknowledgement is
 * part of the log rather than a live claim, and unacknowledging one would leave a
 * row reading "nobody ever saw this, and then it was closed" — exactly the hole
 * `clearAlarm` fills in on the way past. Reopen it first if that is really what
 * was meant; the two clicks say two different things.
 *
 * The stamps are dropped rather than kept beside a `false`, because the record
 * this store keeps is *who is on it now*, not the history of who was. A
 * prototype that wanted the history would need an event log, and that is a
 * different shape from a handling map keyed by alarm.
 */
export const unacknowledgeAlarm = (alarmId: string): void => {
  const current = handlingOf(alarmId);
  if (current.acknowledgedAt === null || current.clearedAt !== null) return;

  write({...snapshot, [alarmId]: {...current, acknowledgedAt: null, acknowledgedBy: null}});
};

/**
 * Mark an alarm finished with.
 *
 * **Clearing acknowledges as well, where nobody had.** Huawei's own list allows
 * clearing an unacknowledged alarm, and the result is a row that reads "nobody
 * ever saw this, and then it was closed" — which is either untrue, since somebody
 * plainly did, or a hole in the audit trail. Recording the clearer as the
 * acknowledger is the honest reading of the same click, and it keeps the two
 * columns from disagreeing about whether a human was involved.
 */
export const clearAlarm = (alarmId: string, by: string): void => {
  const current = handlingOf(alarmId);
  if (current.clearedAt !== null) return;

  const at = new Date().toISOString();

  write({
    ...snapshot,
    [alarmId]: {
      acknowledgedAt: current.acknowledgedAt ?? at,
      acknowledgedBy: current.acknowledgedBy ?? by,
      clearedAt: at,
      clearedBy: by,
    },
  });
};

/**
 * Put a cleared alarm back on the active list.
 *
 * The undo for a misplaced click, and nothing more ambitious than that. A real
 * platform re-raises an alarm because the controller asserted the bit again; here
 * there is no controller, so this is a person correcting themselves and the
 * acknowledgement is deliberately left in place — they did see it.
 */
export const reopenAlarm = (alarmId: string): void => {
  const current = handlingOf(alarmId);
  if (current.clearedAt === null) return;

  write({...snapshot, [alarmId]: {...current, clearedAt: null, clearedBy: null}});
};
