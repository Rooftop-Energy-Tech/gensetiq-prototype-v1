import type {SitePowerRole} from '@/modules/site/types/site.type';
import {FLEET_STATUSES, STATUS_META, gensetStatus} from './fleetStatus';
import type {FleetStatus} from './fleetStatus';
import {RUN_STATES} from '../types/genset.type';
import type {Genset, RunState} from '../types/genset.type';
import {gensetStateName, stateSlug} from './gensetState';
import {ALERT_SEVERITIES} from '../types/alert.type';
import type {AlertSeverity} from '../types/alert.type';
import {fuelLevelKind} from '../types/fuelLevel.type';
import {GENSET_ALARM_FILTERS, GENSET_FUEL_FILTERS} from '../types/view.type';
import type {GensetAlarmFilter, GensetFuelFilter} from '../types/view.type';

/**
 * What the cards above the fleet list count.
 *
 * Derived on every render from the list they sit over, and **never stored** — the
 * rule the rest of the data layer follows. A card is a reading of the same rows the
 * table is drawing, so it cannot claim a total the list does not contain.
 *
 * ## Why the counts are over the *whole* fleet, not the filtered one
 *
 * A card that shrinks to match the filter it applied says nothing: click "Prime"
 * and the duty card reads "Standby 0 · Prime 7", which is a tautology, and the way
 * back to the full picture disappears with the numbers. So the cards count the
 * fleet and the *chips* carry the selection — the numbers hold still while you
 * filter against them, which is what makes them worth reading twice.
 *
 * The one figure that does follow the filter is the headline's "showing N", because
 * that is the question the headline is answering.
 */

export type Tally<K extends string> = {key: K; label: string; count: number};

/**
 * A set's duty, taken from the yard it is standing in.
 *
 * `undefined` in the depot, and that is the honest answer rather than a third
 * bucket dressed up as a role: standby and prime are properties of an
 * *posting*, and a machine on a lorry has no posting. The card labels
 * that group "Depot" for the same reason the customer card does.
 *
 * `roles` is passed in rather than read from the store, so every set in one render
 * is judged against the same moment — and so this stays a pure function the page
 * can memoise.
 */
export const gensetPowerRole = (
  genset: Genset,
  roles: Record<string, SitePowerRole>,
): SitePowerRole | undefined =>
  genset.siteId === null ? undefined : roles[genset.siteId];

/** Which alarm option a set falls in: its worst standing severity, or `NONE`. */
export const gensetAlarmFilter = (
  counts: Record<AlertSeverity, number> | undefined,
): GensetAlarmFilter => ALERT_SEVERITIES.find((severity) => (counts?.[severity] ?? 0) > 0) ?? 'NONE';

/** Which fuel option a set falls in — the reserve line `fuelLevelKind` draws. */
export const gensetFuelFilter = (genset: Genset): GensetFuelFilter =>
  fuelLevelKind(genset.fuelLitres, genset.fuelCapacityLitres) === 'low' ? 'low' : 'ok';

export type FleetSummary = {
  total: number;
  depotCount: number;
  /** The four buckets, worst first — see `fleetStatus.ts`. Always all four. */
  byStatus: Array<Tally<FleetStatus>>;
  /**
   * The states with at least one set standing in them, A to Z — the State filter's
   * options. By position, as the State column reads it, so a set in the workshop is
   * counted in the state the workshop is in; there is no `Workshop` option.
   */
  byState: Array<Tally<string>>;
  /**
   * The toolbar's three, as counts per option. Labels are the toolbar's, which owns
   * the words the options are drawn with. Every option is always present, zero or
   * not, for the reason `byStatus` gives: a fixed scale a reader learns once.
   */
  byRunState: Record<RunState, number>;
  byAlarm: Record<GensetAlarmFilter, number>;
  byFuel: Record<GensetFuelFilter, number>;
};

export const fleetSummary = (
  gensets: Array<Genset>,
  roles: Record<string, SitePowerRole>,
  /** Every set's standing counts — the Alarm column's pass, for `byAlarm`. */
  counts: Record<string, Record<AlertSeverity, number>> = {},
): FleetSummary => {
  const roleCounts: Record<string, number> = {
    GRID_BACKUP: 0,
    DIESEL_PRIME: 0,
    WORKSHOP: 0,
  };
  const stateCounts = new Map<string, number>();
  const statusCounts: Record<FleetStatus, number> = {ALARM: 0, REFUEL: 0, OK: 0};
  const runCounts = Object.fromEntries(RUN_STATES.map((state) => [state, 0])) as Record<RunState, number>;
  const alarmCounts = Object.fromEntries(GENSET_ALARM_FILTERS.map((key) => [key, 0])) as Record<GensetAlarmFilter, number>;
  const fuelCounts = Object.fromEntries(GENSET_FUEL_FILTERS.map((key) => [key, 0])) as Record<GensetFuelFilter, number>;

  for (const genset of gensets) {

    const role = gensetPowerRole(genset, roles);
    roleCounts[role ?? 'WORKSHOP'] += 1;

    const state = gensetStateName(genset);
    if (state !== undefined) stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);

    statusCounts[gensetStatus(genset)] += 1;
    runCounts[genset.runState] += 1;
    alarmCounts[gensetAlarmFilter(counts[genset.id])] += 1;
    fuelCounts[gensetFuelFilter(genset)] += 1;
  }

  const workshopCount = roleCounts.WORKSHOP;

  return {
    total: gensets.length,
    depotCount: workshopCount,
    // Every bucket is kept, zero or not. Unlike the role and customer rows, these
    // three are a fixed scale a reader learns once — dropping "Alarms raised" on a
    // good day would move the other two and make the card read differently every
    // load.
    byStatus: FLEET_STATUSES.map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      count: statusCounts[status],
    })),
    // Only the states a set stands in. Sixteen options on an estate that reaches
    // eight would be half a menu of zeros, and the rows present already say where
    // the fleet is — which is what the filter is for.
    byState: [...stateCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, count]) => ({key: stateSlug(name), label: name, count})),
    byRunState: runCounts,
    byAlarm: alarmCounts,
    byFuel: fuelCounts,
  };
};
