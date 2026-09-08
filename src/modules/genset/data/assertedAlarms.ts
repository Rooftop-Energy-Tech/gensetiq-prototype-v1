import {monitoringUnit} from '@/modules/site/data/monitoringUnit';
import {plantAlarmsIn} from '@/modules/site/data/plantAlarms';
import {HUAWEI_SEVERITY_LABEL, hexAddress} from '@/modules/site/types/plantAlarm.type';
import type {PlantAlarm, PlantAlarmCategory} from '@/modules/site/types/plantAlarm.type';
import type {SitePowerRole} from '@/modules/site/types/site.type';
import {ALERT_SEVERITIES} from '../types/alert.type';
import {UNHANDLED, byUrgency, isStanding} from '../types/alarmState.type';
import type {AlarmHandling} from '../types/alarmState.type';
import type {AlarmView} from '../types/alarmView.type';
import {spread, spreadBetween} from './spread';

/**
 * What the site's monitoring unit is asserting, for one subsystem.
 *
 * ## Why anything is asserted at all
 *
 * The unit's poll table is fifty-eight registers and **nothing has read them** —
 * the gateway on site is a version behind an unbuilt firmware. The site tab
 * therefore still shows the whole table as a catalogue and says so.
 *
 * The other three tabs do not, because they are the pages an operator *works*
 * from. An alarm page's job is a queue: what is standing, who has taken it on, what
 * has been dealt with. A page that can only ever list what might one day fire
 * cannot be reviewed, cannot be acknowledged, and cannot show whether the two-axis
 * handling model is any good — which is the thing the prototype exists to
 * demonstrate. So the bank, the array and the set each carry a couple of asserted
 * rows, dealt from a seed exactly as the genset controller's own alarms are.
 *
 * These are a **fixture**, in precisely the sense every other number on this estate
 * is, and the page says so in the same words it already used about the controller's
 * register bits.
 *
 * ## Why two, and why not the criticals that mean the site is dark
 *
 * `rulesFor` in `detail.ts` learned this the hard way: dealing freely from the
 * whole alarm map put fourteen of twenty-five sites at `Critical` and the estate
 * "read as though it were on fire", so criticals were reserved for the one state
 * that has one by definition. The same trap is here in a sharper form. `BLVD
 * Disconnected` means the battery has been taken off the bus and **the tower is
 * dark**; `LLVD3 Disconnected` means a stage of load has been shed. SBH-1336's
 * site page, its map pin and its charts all say it is up and generating, so
 * asserting either would be one screen calling another a liar.
 *
 * Those five rows are therefore never dealt. Everything else can be true of a site
 * that is still standing, including the four `LLVD… Warning` rows — a stage *about
 * to* shed is the actionable one, and it is the whole reason the warning exists
 * separately from the disconnect.
 *
 * ## Why the deal is seeded on the site
 *
 * These are registers on one device watching one plant, so the bank's page and the
 * set's page have to be told the same thing about the same register. Seeding on the
 * asset would let two pages disagree about `0x500A`. The handling key is the plant
 * alarm's own id for the same reason — acknowledging a dropped phase from the
 * genset's page acknowledges it everywhere, because it is one register.
 */

/**
 * One instant, captured at module load.
 *
 * The raise times have to be stable: `relativeTime` is re-read on every render, and
 * a stamp taken at call time would have a row's age flicker while somebody looked
 * at it. `DETAILS` in `detail.ts` is built once for the same reason.
 */
const LOADED_AT = Date.now();

const HOUR_MS = 60 * 60 * 1000;

/** How many rows stand per subsystem. See the note above on why it is small. */
const STANDING_PER_CATEGORY = 2;

/**
 * When the unit first saw it — twenty-five minutes to nine hours back.
 *
 * Spread on the alarm's own id, so two standing rows never share a timestamp. The
 * floor matters: an alarm raised four seconds ago is one the fixture plainly
 * invented while the page was loading.
 */
const raisedAt = (alarmId: string): string =>
  new Date(LOADED_AT - spreadBetween(alarmId, 'plant/raised', 0.4, 9) * HOUR_MS).toISOString();

/**
 * The rows that would contradict every other screen about this site.
 *
 * Each one asserts that load is off the air — the four load-shed stages having
 * actually shed, and the battery having been disconnected from the bus. See the
 * note above. Held as addresses rather than labels because a label is a published
 * interface and this list is a local judgement about one estate.
 */
const SITE_DOWN = new Set([0x5018, 0x501a, 0x5033, 0x5035, 0x5502]);

/**
 * The part of the plant a row is about, so two dealt rows are never near-duplicates.
 *
 * The generalisation of the per-phase guard the AC rows needed. Dealing `SSU 2
 * Fault` beside `PV 2 Array Fault` is one fault reported twice — a converter that
 * has failed cannot report on the array behind it — and two lithium module rows out
 * of two slots is a page that looks like it only knows one kind of fault. One row
 * per group fixes all of those with one rule.
 *
 * Everything is derived from the address rather than the label, for the reason
 * `phaseOf` was: the labels are a published interface and parsing them here would
 * make this module a consumer of Huawei's spelling.
 */
const groupOf = (address: number): string => {
  // ── AC, by phase. Three contiguous blocks of three.
  if (address >= 0x5003 && address <= 0x5005) return `phase-${address - 0x5003 + 1}`;
  if (address >= 0x5006 && address <= 0x5008) return `phase-${address - 0x5006 + 1}`;
  if (address >= 0x5009 && address <= 0x500b) return `phase-${address - 0x5009 + 1}`;

  // ── The load-shed ladder. Stages 1–2 are original, 3–4 were added later.
  if (address === 0x5017 || address === 0x5018) return 'lvd-1';
  if (address === 0x5019 || address === 0x501a) return 'lvd-2';
  if (address === 0x5032 || address === 0x5033) return 'lvd-3';
  if (address === 0x5034 || address === 0x5035) return 'lvd-4';
  if (address === 0x5502 || address === 0x5503) return 'blvd';

  // ── All thirteen modules as one group: at most one module row stands.
  if (address >= 0x5036 && address <= 0x5042) return 'modules';

  // ── The temperatures and the sensor that reads them. High and low are direct
  //    opposites, and the sensor fault invalidates both.
  if (address === 0x5500 || address === 0x5501 || address === 0x5505) return 'temperature';

  // ── Solar: the bus presence row, then one group per conversion unit.
  if (address === 0x5900) return 'ssu-bus';
  if (address >= 0x5901 && address <= 0x5933) return `ssu-${Math.floor((address - 0x5901) / 0x10) + 1}`;

  // Everything else stands alone — the surge arresters, the bus voltages, the
  // rectifier rows, the load fuse, the cabinet sensors, the battery fuse.
  return `addr-${address}`;
};

const dealt = (siteId: string, rows: ReadonlyArray<PlantAlarm>): Array<PlantAlarm> => {
  const eligible = rows.filter((row) => !SITE_DOWN.has(row.address));

  // A per-site shuffle, so the bank and the array do not both open on their
  // lowest-addressed row.
  const pool = [...eligible].sort(
    (left, right) => spread(siteId, left.id) - spread(siteId, right.id),
  );

  const taken: Array<PlantAlarm> = [];
  const groups = new Set<string>();

  for (const row of pool) {
    if (taken.length === STANDING_PER_CATEGORY) break;

    const group = groupOf(row.address);
    if (groups.has(group)) continue;

    groups.add(group);
    taken.push(row);
  }

  return taken;
};

/**
 * The asserted rows for one subsystem, each carrying its handling.
 *
 * Pure over `handling`, exactly as `trackedAlarms` is, so a page subscribes once
 * with `useAlarmHandling()` and calls both without either store having to memoise a
 * per-id slice.
 *
 * `siteId` may be an empty string — a machine standing in the yard rather than on a
 * plinth has no site — and that lands on the same empty answer as the twenty-four
 * sites with no unit fitted.
 */
export const assertedPlantAlarms = (
  siteId: string,
  role: SitePowerRole,
  category: PlantAlarmCategory,
  handling: Record<string, AlarmHandling>,
): Array<AlarmView> => {
  const unit = monitoringUnit(siteId);
  if (unit === undefined) return [];

  const rows = plantAlarmsIn(siteId, role, category);
  if (rows.length === 0) return [];

  return dealt(siteId, rows).map((row) => ({
    id: row.id,
    // The label the gateway publishes, exactly. History downstream is keyed on the
    // raw string, so a row tidied for this table would be a name in no log.
    name: row.label,
    /**
     * The line under the name.
     *
     * Deliberately the **same shape** the controller's own rows use — `< 24 V ·
     * register 1299 bit 0` — with the rule first and the coordinates after it,
     * because the two kinds of row sit in one table and a reader scanning down the
     * column should not have to change how they read it halfway. Where the register
     * map documents no setpoint there is simply no leading clause, which is most
     * rows: see `PlantAlarm.threshold`.
     */
    provenance:
      row.threshold === null
        ? `${unit.deviceName} · ${hexAddress(row)}`
        : `${row.threshold} · ${unit.deviceName} · ${hexAddress(row)}`,
    // Huawei's own class, not Deep Sea's. The severity chip beside it is this
    // site's ranking, and the two deliberately disagree on thirty of the
    // fifty-eight rows — see `plantAlarm.type.ts`.
    className: HUAWEI_SEVERITY_LABEL[row.huawei],
    severity: row.severity,
    raisedAt: raisedAt(row.id),
    handling: handling[row.id] ?? UNHANDLED,
  }));
};

/**
 * The asserted rows split into the two tables, each ordered as its table wants.
 *
 * ## Why this exists rather than each page splitting for itself
 *
 * Because two screens count the same rows. A bank's Alarms tab lists them and the
 * bank's **home page prints the count in its metric strip** — and those two numbers
 * appearing on adjacent pages of the same asset is exactly the kind of pair that
 * drifts. The strip used to read a hard-coded three zeros with a comment explaining
 * that no battery rule existed; the moment one did, the honest zero became a wrong
 * number, and the only reliable fix is that both readings come out of one function.
 *
 * `standing` is what the strip counts and the queue shows — **cleared rows are not
 * in it**, so clearing an alarm on the tab drops the count on the home page, which
 * is the behaviour a reader will check first.
 */
export const plantAlarmQueue = (
  siteId: string,
  role: SitePowerRole,
  category: PlantAlarmCategory,
  handling: Record<string, AlarmHandling>,
): {standing: Array<AlarmView>; cleared: Array<AlarmView>} => {
  const rows = assertedPlantAlarms(siteId, role, category, handling);

  return {
    // Unclaimed first, then worse severity first — the work-queue ordering.
    standing: rows
      .filter(isStanding)
      .sort(byUrgency((alarm) => ALERT_SEVERITIES.indexOf(alarm.severity))),
    // Most recently dealt with first — the log ordering.
    cleared: rows
      .filter((alarm) => !isStanding(alarm))
      .sort(
        (left, right) =>
          new Date(right.handling.clearedAt ?? 0).getTime() -
          new Date(left.handling.clearedAt ?? 0).getTime(),
      ),
  };
};

/**
 * How many rows the unit polls against this subsystem at all — the denominator.
 *
 * Printed beside the standing count so the two numbers reconcile. A reader who has
 * seen `Battery 28` on the site tab's cross-reference and then finds two rows here
 * needs to be told that twenty-six are being watched rather than that they are
 * missing.
 */
export const plantAlarmsWatched = (
  siteId: string,
  role: SitePowerRole,
  category: PlantAlarmCategory,
): number => plantAlarmsIn(siteId, role, category).length;
