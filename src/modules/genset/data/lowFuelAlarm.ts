import {amount, fuelLevel} from '@/lib/format';

import {UNHANDLED} from '../types/alarmState.type';
import type {AlarmHandling} from '../types/alarmState.type';
import type {AlarmView} from '../types/alarmView.type';
import {
  FUEL_LEVEL_LABEL,
  FUEL_LEVEL_LIMIT,
  SEVERITY_OF_FUEL_LEVEL,
  fuelLevelKind,
} from '../types/fuelLevel.type';
import type {Genset} from '../types/genset.type';
import {fuelAt, historyStart} from './history';

/**
 * The tank below its reserve line, as a standing alarm.
 *
 * ## Why it is a row now
 *
 * `fuelLevel.type.ts` has said since it was written that a low tank *is an alarm*,
 * and the condition verdict has always read it. What it never did was reach the
 * list: the Alarm column, a set's own Alarms tab and the counts on its home page are
 * all counted off the standing queue, and the queue held the controller's bits and
 * the monitoring unit's rows and nothing the app raised itself. So a set at 7% read
 * `– – –` in the register and "Nothing standing" on its own tab — the page telling a
 * reader nothing was wrong beside the most consequential number on it.
 *
 * ## What kind of row it is
 *
 * **The app's, not the panel's.** The controller has `AL Fuel Level Wrn`, and it is
 * not marked for the dashboard, so it stays out of `ALERT_RULES`. This row is the
 * reserve line the fleet's `Low fuel` bucket is defined by, and it says so where a
 * controller row prints its register and bit: `Tank level`.
 *
 * **A `WARNING`.** A low tank is a tanker to book, a job with a lead time; the
 * criticals are protections that have stopped an engine. See
 * `SEVERITY_OF_FUEL_LEVEL`.
 *
 * **It ends when the tank is refilled, and not before.** It exists exactly while
 * the level is under the line, so there is nothing for a person to clear — clearing
 * would be a claim that the tank is fine, made by somebody standing beside a tank
 * that is not. It can be *acknowledged*, which is the useful statement ("seen, a
 * tanker is booked"), so its handling is read from the same store as every other
 * row, with any `cleared` stamp ignored.
 *
 * **It does not move the fleet buckets.** A set here still counts under `Low fuel`
 * in the strip above the register, not under `Alarms raised` — the same tank-blind
 * rule `gensetStatus` already keeps, for the reason it gives: otherwise every
 * `REFUEL` set would also be an `ALARM` set and the fuel tile would empty itself
 * into the red one.
 */

/** The handling store's key: one machine's tank. */
const idOf = (gensetId: string): string => `${gensetId}-low-fuel`;

/** How finely the history is walked back to find the crossing. */
const STEP = 10 * 60_000;

const raisedCache = new Map<string, string>();

/**
 * When the level last went under the line — the most recent instant it was at or
 * above it, walking back from now.
 *
 * Read off `fuelAt`, the curve the tank chart draws, so the stamp on the row and the
 * place the line crosses the chart are the same instant. A tank that has been under
 * the line for the whole of the history is stamped at the history's start, which is
 * the oldest thing the app can honestly say about it.
 */
const raisedAtOf = (genset: Genset, limitLitres: number): string => {
  const cached = raisedCache.get(genset.id);
  if (cached !== undefined) return cached;

  const start = historyStart();
  let t = Date.now();
  while (t > start && fuelAt(genset.id, t) < limitLitres) t -= STEP;

  const stamp = new Date(Math.max(t, start)).toISOString();
  raisedCache.set(genset.id, stamp);
  return stamp;
};

/** The row, or `undefined` for a tank at or above its reserve line. */
export const lowFuelAlarm = (
  genset: Genset,
  handling: Record<string, AlarmHandling>,
): AlarmView | undefined => {
  const kind = fuelLevelKind(genset.fuelLitres, genset.fuelCapacityLitres);
  if (kind === undefined) return undefined;

  const id = idOf(genset.id);
  const limit = FUEL_LEVEL_LIMIT[kind];
  const held = handling[id] ?? UNHANDLED;

  return {
    id,
    name: FUEL_LEVEL_LABEL[kind],
    provenance: `${fuelLevel(genset.fuelLitres, genset.fuelCapacityLitres)} · < ${Math.round(limit * 100)}% of ${amount(genset.fuelCapacityLitres, 'L')} · Tank level`,
    className: 'Warning',
    severity: SEVERITY_OF_FUEL_LEVEL[kind],
    raisedAt: raisedAtOf(genset, limit * genset.fuelCapacityLitres),
    // Acknowledgement carries; a clear does not — see the note at the top.
    handling: {...held, clearedAt: null, clearedBy: null},
    clearable: false,
  };
};

/** The row as a list, for spreading into a queue beside the other sources. */
export const lowFuelAlarms = (
  genset: Genset,
  handling: Record<string, AlarmHandling>,
): Array<AlarmView> => {
  const row = lowFuelAlarm(genset, handling);
  return row === undefined ? [] : [row];
};
