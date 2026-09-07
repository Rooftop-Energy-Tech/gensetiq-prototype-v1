import {systemCondition} from '../types/health.type';
import type {SystemAlert, SystemCondition} from '../types/health.type';
import type {SolarSystem} from '../types/system.type';
import type {SystemDetail} from './systemDetail';

/**
 * What is wrong with one solar system, worst first.
 *
 * ## Every rule is checkable on the page it appears on
 *
 * The genset's alerts are a register map's bits: the app reports what the panel
 * raised and prints the coordinates so a reader can go and check. A PV system has
 * no such map, so every rule here had to earn its place a different way — by
 * being **derivable from something else drawn on the same page**. Read the last
 * wash off the readings below it, or look at the month the chart steps down.
 * Nothing here asks to be taken on trust.
 *
 * ## Three rules, and it used to be five
 *
 * What went, and why, because the losses are the interesting half:
 *
 *  - **`inverter-offline`** — a box silent while its neighbours were not. There
 *    are no boxes on a telco site, so a silence is now the whole plant's and
 *    `system-offline` is the only shape it comes in. A plant that used to read
 *    "nine of ten reporting" now reads offline or does not.
 *  - **`insulation-low`** — resistance to earth, below which the box refuses to
 *    start in the morning. It was an inverter's own earth-leakage interlock, and
 *    with no inverter there is nothing on the site that measures it. A rule this
 *    app cannot derive is a rule it must not print.
 *
 * `string-out` survived both, and it is the one worth keeping: a string is
 * modules in series, a physical run on the roof, and it goes dark whatever it
 * terminates in.
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

export const systemAlerts = (
  system: SolarSystem,
  detail: SystemDetail,
  now: number = Date.now(),
): Array<SystemAlert> => {
  const alerts: Array<SystemAlert> = [];

  if (system.state === 'OFFLINE') {
    alerts.push({
      id: `${system.id}-offline`,
      ruleId: 'system-offline',
      name: 'System not reporting',
      severity: 'CRITICAL',
      readingKey: null,
      threshold: 'no telemetry',
      limit: null,
      comparator: '<',
      message:
        'Nothing has been heard from this system. Its readings are withheld rather than shown stale; what is left is measured over closed months.',
      source: 'Telemetry',
      raisedAt: system.lastUpdated,
    });
  }

  if (system.downStrings > 0 && detail.stepAt !== undefined) {
    alerts.push({
      id: `${system.id}-string-out`,
      ruleId: 'string-out',
      name: system.downStrings === 1 ? 'String offline' : 'Strings offline',
      severity: 'CRITICAL',
      readingKey: null,
      threshold: `${system.strings} strings expected`,
      limit: null,
      comparator: '<',
      message: `${system.downStrings} of ${system.strings} strings ${system.downStrings === 1 ? 'has' : 'have'} stopped delivering — this system's output stepped down in ${detail.stepLabel} and has stayed there.`,
      // Not the array's own telemetry: the claim is this app's arithmetic over a
      // step in the monthly series, and the card says so. Nothing on the roof can
      // see the months either side of the one it dropped in.
      source: 'Generation series',
      raisedAt: detail.stepAt,
    });
  }

  const cleaned = detail.readings.find((reading) => reading.key === 'days-since-clean');
  if (cleaned !== undefined && cleaned.value > CLEAN_DUE_DAYS) {
    alerts.push({
      id: `${system.id}-soiling`,
      ruleId: 'soiling-due',
      name: 'Wash overdue',
      severity: 'WARNING',
      readingKey: 'days-since-clean',
      threshold: `> ${CLEAN_DUE_DAYS} days`,
      limit: CLEAN_DUE_DAYS,
      comparator: '>',
      message: `${cleaned.value} days since the modules were last washed.`,
      // A chore falling due, the same kind of row an overdue service is on a
      // genset, and it prints its origin so a reader can tell it apart from the
      // rules that are measurements.
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
