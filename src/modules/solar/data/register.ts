import {CUSTOMERS} from '@/modules/site/data/customers';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import type {AlarmHandling} from '@/modules/genset/types/alarmState.type';
import {solarAlarmQueue} from './solarAlarmQueue';
import {systemDetail} from './systemDetail';
import {systemHealth} from './systemHealth';
import type {SystemCondition} from '../types/health.type';
import type {SolarSystem} from '../types/system.type';

/**
 * What the solar register is a list *of*, and every reading taken over it.
 *
 * Lifted out of `SolarRegister.tsx`, which had grown the row build, the sort and the
 * search inline. The move is what the fleet screen already does — `searchGensets.ts`
 * and `fleetSummary.ts` beside a component that only draws — and it is what lets the
 * toolbar's region counts, the cards' totals, the table and the map all be readings
 * of one array rather than four passes that can disagree.
 *
 * Nothing here is stored. A row is built on every render from the systems it is
 * handed, which is the estate's rule: a card cannot claim a total the table does not
 * contain.
 */

/** Worst first — the order the rows come out in. */
const CONDITION_ORDER: Record<SystemCondition, number> = {
  CRITICAL: 0,
  ATTENTION: 1,
  OPTIMUM: 2,
};

export type SolarRow = {
  system: SolarSystem;
  /**
   * Still the sort key, and no longer a column — see `SolarTable`.
   *
   * ⚠️ It ranks the **derived rules only**, which is the narrower of this array's two
   * alarm sources, so it can order two rows against each other in a way their own
   * pills contradict. That is the same fault `useEstateAlarmCounts` was built to fix
   * on the estate list, and it is not fixed here yet: `alarmRank` is the shape the
   * answer wants, over `counts` below.
   */
  condition: SystemCondition;
  /** The worst thing wrong, in the rule's own words, or `undefined`. */
  headline: string | undefined;
  /**
   * What is standing on this array, by severity — the row's `Alarm` cell.
   *
   * Counted off `solarAlarmQueue`, the call the system's own strip and its Alarms tab
   * both make, and **not** off `systemHealth`'s alerts. That file records why: the
   * derived rules are one of two sources, the monitoring unit's registers are the
   * other, and a register counting one of them reads `1` beside a tab listing `2`.
   */
  counts: Record<AlertSeverity, number>;
};

/**
 * A row per system, carrying the verdict the register ranks by.
 *
 * `includeCurve: false`, because the intraday curve is the expensive part of a
 * `systemDetail` and no row draws one.
 *
 * `handling` is threaded in rather than read here, so this stays pure over what it is
 * handed and the register subscribes once for the whole list — `useEstateAlarmCounts`'
 * rule, one pass rather than one per row.
 */
export const solarRows = (
  systems: Array<SolarSystem>,
  now: number,
  handling: Record<string, AlarmHandling>,
): Array<SolarRow> =>
  systems.flatMap((system) => {
    const detail = systemDetail(system, now, false);
    if (detail === undefined) return [];

    const {alerts, condition} = systemHealth(system, detail, now);

    return [
      {
        system,
        condition,
        // The worst one only. A register cell listing three faults would be a page of
        // its own squeezed into a sixth of a row; the system's own Alarms tab is one
        // click away and lists them all.
        headline: alerts[0]?.name,
        counts: countBySeverity(solarAlarmQueue(system, detail, now, handling).standing),
      },
    ];
  });

/**
 * Sorted by attention, and not by a column header.
 *
 * By condition, then by output — worst first. This is a screen read to find work, and
 * a healthy system is not work; `/gensets` sorts by attention for the same reason and
 * neither makes the reader discover it.
 *
 * The sort cannot live in `solarSystems`, and the first draft had it there. That
 * function can only sort by *state*, since it does not build a detail — and state is
 * not condition: a system with a string down is generating perfectly well and is the
 * row somebody needs to see, while a healthy one is also `Generating`. Sorting by
 * state put an `Optimum` system above a `Critical` one, which is a list that quietly
 * stops being read.
 */
export const sortSolarRows = (rows: Array<SolarRow>): Array<SolarRow> =>
  [...rows].sort(
    (left, right) =>
      CONDITION_ORDER[left.condition] - CONDITION_ORDER[right.condition] ||
      // Within a condition, the biggest plant first. Two criticals are not equally
      // urgent, and a megawatt down the road matters more today than twenty
      // kilowatts on a rooftop.
      right.system.kwp - left.system.kwp,
  );

/**
 * Free-text filter behind the toolbar's search box.
 *
 * The placeholder says "System name", but matching only the site's name would make
 * the box feel broken the first time somebody types "Kapit" — which is on screen in
 * the row they are looking at, under the name. So it matches both, which is what the
 * first column actually contains. `searchGensets` makes the same argument about a
 * genset's model and place.
 */
export const searchSolarRows = (rows: Array<SolarRow>, query: string): Array<SolarRow> => {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    [row.system.siteName, row.system.locationLabel].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
};

/** What the toolbar's dropdown narrows by. Absent fields do not narrow anything. */
export type SolarFilters = {customer?: string};

/**
 * The region filter, applied — kept beside the free-text search rather than folded
 * into it, because the two are different acts: the box is somebody typing a guess,
 * the dropdown is somebody choosing a known bucket. They compose, and each is
 * independently clearable.
 */
export const filterSolarRows = (
  rows: Array<SolarRow>,
  filters: SolarFilters,
): Array<SolarRow> =>
  rows.filter((row) => {
    if (filters.customer !== undefined && row.system.customer !== filters.customer) {
      return false;
    }
    return true;
  });

export type SolarSummary = {
  total: number;
  /** Installed capacity across the estate, kWp. */
  totalKwp: number;
  /** What the estate is putting out right now, kW — nothing from a silent system. */
  outputKw: number;
  /** Systems we have heard from. */
  reporting: number;
  offline: number;
  /** Systems whose condition is not `OPTIMUM`, and the worse half of those. */
  attention: number;
  critical: number;
  /**
   * Regions with a system in them, in roster order — the toolbar's dropdown.
   *
   * Regions with none are dropped rather than shown as zero: an estate where two
   * regions have no solar at all would otherwise offer two filters that can only
   * empty the list.
   */
  byCustomer: Array<{key: string; label: string; count: number}>;
};

/**
 * The strip's figures and the dropdown's counts, over the **whole** register.
 *
 * Not the filtered one, which is `fleetSummary`'s rule and the reason it is worth
 * restating: a card that shrinks to match the filter it applied says nothing, and the
 * way back to the full picture disappears with the numbers. The one figure that
 * follows the filter is the headline's "showing N", because that is the question the
 * headline is answering — so the page passes it in separately.
 */
export const solarSummary = (rows: Array<SolarRow>): SolarSummary => {
  const counts = new Map<string, number>();
  let totalKwp = 0;
  let outputKw = 0;
  let reporting = 0;
  let attention = 0;
  let critical = 0;

  for (const {system, condition} of rows) {
    counts.set(system.customer, (counts.get(system.customer) ?? 0) + 1);
    totalKwp += system.kwp;
    outputKw += system.outputKw;
    if (system.state !== 'OFFLINE') reporting += 1;
    if (condition !== 'OPTIMUM') attention += 1;
    if (condition === 'CRITICAL') critical += 1;
  }

  return {
    total: rows.length,
    totalKwp,
    outputKw,
    reporting,
    offline: rows.length - reporting,
    attention,
    critical,
    byCustomer: CUSTOMERS.map((entry) => ({
      key: entry.id,
      label: entry.shortName,
      count: counts.get(entry.id) ?? 0,
    })).filter((tally) => tally.count > 0),
  };
};
