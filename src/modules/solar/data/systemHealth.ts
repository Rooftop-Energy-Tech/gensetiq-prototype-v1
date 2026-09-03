import {systemCondition} from '../types/health.type';
import type {SystemAlert, SystemCondition} from '../types/health.type';
import {silentInverters} from '../types/system.type';
import type {SolarSystem} from '../types/system.type';
import {insulationOf} from './inverterDetail';
import type {SystemDetail} from './systemDetail';

/**
 * What is wrong with one solar system, worst first.
 *
 * ## Every rule is checkable on the page it appears on
 *
 * The genset's alerts are a register map's bits: the app reports what the panel
 * raised and prints the coordinates so a reader can go and check. A PV system has
 * no such map, so every rule here had to earn its place a different way — by
 * being **derivable from something else drawn on the same page**. Count the dark
 * string bars, read the dial, or look at the month the chart steps down. Nothing
 * here asks to be taken on trust.
 *
 * ## Most of them name a box
 *
 * Which is the whole reason the model was rebuilt around the inverter. "String
 * offline" on a system of ten boxes is an alert nobody can act on; "Inverter 4 —
 * 9 of 13 strings" is a job with an address. `inverterId` is `undefined` only on
 * the two rules that really are about the whole system.
 *
 * ## `string-out` needs a step behind it
 *
 * A system can be quietly mediocre for its whole life — a shallow roof, a shaded
 * corner, an optimistic build — and that is not a fault anybody can go and clear.
 * What *is* a fault is output that dropped on a date and stayed down, which is
 * what `solarStep` records. So the rule fires only where there is a step, and the
 * alert carries the month, because that is the half of it that sends somebody up
 * a ladder rather than into an argument.
 */

/**
 * A wash is due at four months.
 *
 * Long enough not to nag — an equatorial roof in the wet season half-cleans
 * itself — and short enough that the dry-season dust which actually costs
 * generation gets caught before it has cost a quarter's worth.
 */
const CLEAN_DUE_DAYS = 120;

/**
 * Below a megohm the inverter will refuse to start in the morning.
 *
 * The threshold is the box's own, not a preference: it is an earth-leakage
 * interlock, so a string drifting towards it is one that will simply fail to come
 * up after the next storm. That is why this is a warning and not a note — there
 * is nothing wrong with the output today and there will be nothing at all next
 * week.
 */
const RISO_FLOOR = 1;

const percent = (share: number): string => `${Math.round(share * 100)}%`;

export const systemAlerts = (
  system: SolarSystem,
  detail: SystemDetail,
  now: number = Date.now(),
): Array<SystemAlert> => {
  const alerts: Array<SystemAlert> = [];
  const silent = silentInverters(system);

  if (silent.length > 0) {
    /**
     * One rule, two severities, and the line between them is the reason this
     * model was rebuilt.
     *
     * **Every** box silent is a plant we are blind to: no output, no readings,
     * nothing published, and somebody has to drive there. **Some** boxes silent
     * is a hole in the picture — the rest of the plant is reporting and the page
     * still has a day's energy, minus whatever `reportingKwp` says we cannot see.
     * The old array model could only say the first, so a 1.3 MW plant with one
     * quiet inverter read as entirely offline.
     */
    const all = silent.length === system.inverters.length;

    for (const inverter of all ? [silent[0]] : silent) {
      alerts.push({
        id: `${system.id}-offline-${inverter.id}`,
        ruleId: all ? 'system-offline' : 'inverter-offline',
        name: all ? 'System not reporting' : 'Inverter not reporting',
        severity: all ? 'CRITICAL' : 'WARNING',
        inverterId: all ? undefined : inverter.id,
        inverterLabel: all ? undefined : inverter.label,
        readingKey: null,
        threshold: 'no telemetry',
        limit: null,
        comparator: '<',
        message: all
          ? 'Nothing has been heard from this system. Its readings are withheld rather than shown stale; what is left is measured over closed months.'
          : `${inverter.label} has stopped reporting — ${inverter.kwp} kWp of ${system.kwp} kWp, which is ${percent(inverter.kwp / system.kwp)} of the plant nobody can currently see.`,
        source: 'Inverter',
        raisedAt: inverter.lastUpdated,
      });
    }
  }

  for (const inverter of system.inverters) {
    if (inverter.downStrings === 0 || detail.stepAt === undefined) continue;

    alerts.push({
      id: `${system.id}-string-out-${inverter.id}`,
      ruleId: 'string-out',
      name: inverter.downStrings === 1 ? 'String offline' : 'Strings offline',
      severity: 'CRITICAL',
      inverterId: inverter.id,
      inverterLabel: inverter.label,
      readingKey: 'dc-current',
      threshold: `${inverter.strings} strings expected`,
      limit: null,
      comparator: '<',
      message: `${inverter.downStrings} of ${inverter.strings} strings on ${inverter.label} ${inverter.downStrings === 1 ? 'has' : 'have'} stopped delivering — this system's output stepped down in ${detail.stepLabel} and has stayed there.`,
      // The box can see this and does not tell us: the model has one DC input per
      // system, so the claim is the app's arithmetic over a step in the monthly
      // series, and the card says so.
      source: 'Generation series',
      raisedAt: detail.stepAt,
    });
  }

  for (const inverter of system.inverters) {
    const riso = insulationOf(inverter.id);
    if (inverter.state === 'OFFLINE' || riso >= RISO_FLOOR) continue;

    alerts.push({
      id: `${system.id}-insulation-${inverter.id}`,
      ruleId: 'insulation-low',
      name: 'Insulation resistance low',
      severity: 'WARNING',
      inverterId: inverter.id,
      inverterLabel: inverter.label,
      readingKey: 'insulation-resistance',
      threshold: `< ${RISO_FLOOR} MΩ`,
      limit: RISO_FLOOR,
      comparator: '<',
      message: `${riso} MΩ to earth on ${inverter.label}. Below a megohm it will not start, so that box is one wet night from making nothing.`,
      source: 'Inverter',
      raisedAt: inverter.lastUpdated,
    });
  }

  const cleaned = detail.readings.find((reading) => reading.key === 'days-since-clean');
  if (cleaned !== undefined && cleaned.value > CLEAN_DUE_DAYS) {
    alerts.push({
      id: `${system.id}-soiling`,
      ruleId: 'soiling-due',
      name: 'Wash overdue',
      severity: 'WARNING',
      // A fact about glass, so it belongs to no box. This is the clearest case
      // for `inverterId` being nullable rather than every alert naming one.
      inverterId: undefined,
      inverterLabel: undefined,
      readingKey: 'days-since-clean',
      threshold: `> ${CLEAN_DUE_DAYS} days`,
      limit: CLEAN_DUE_DAYS,
      comparator: '>',
      message: `${cleaned.value} days since the modules were last washed.`,
      // Not the inverter. This is a chore falling due, the same kind of row an
      // overdue service is on a genset, and it prints its origin so a reader can
      // tell it apart from the rules that are measurements.
      source: 'Service schedule',
      raisedAt: new Date(now - cleaned.value * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return alerts;
};

export const systemHealth = (
  system: SolarSystem,
  detail: SystemDetail,
  now: number = Date.now(),
): {alerts: Array<SystemAlert>; condition: SystemCondition} => {
  const alerts = systemAlerts(system, detail, now);
  return {alerts, condition: systemCondition(alerts)};
};

/** The alerts that belong to one box — its own page's health band. */
export const alertsForInverter = (
  alerts: Array<SystemAlert>,
  inverterId: string,
): Array<SystemAlert> => alerts.filter((alert) => alert.inverterId === inverterId);
