import {useMemo} from 'react';

import {CUSTOMERS} from '@/modules/site/data/customers';
import {plantAlarmQueue} from '@/modules/genset/data/assertedAlarms';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {FALLBACK_POWER_ROLE, useSitePowerRoles} from '@/modules/site/data/siteConfig';
import {bankRuntime} from '../components/runtimeMeta';
import {useBatteryBanks} from './banks';
import {bankFlow} from '../types/bank.type';
import type {BatteryBank} from '../types/bank.type';

/**
 * Every reading the battery register takes over its rows — the sort, the search, the
 * region filter and the strip's figures.
 *
 * The solar module's `register.ts`, over banks. Both were inline in their components
 * until each grew a toolbar, a card strip and a map that all had to agree about the
 * same list; keeping them in one file per module is what makes the four of them
 * readings of one array rather than four passes that can disagree.
 *
 * Nothing here is stored. Every figure is derived from the banks it is handed, which
 * is the estate's rule: a card cannot claim a total the table does not contain.
 */

/**
 * Worst runtime first — the order the register opens in.
 *
 * Hours left is the thing here most likely to need somebody tonight, and a register
 * that opened alphabetically would bury the flat bank at position nineteen.
 * `/gensets` and `/sites` both sort by attention for the same reason and neither makes
 * the reader discover it.
 *
 * **It is still runtime and not the alarm queue**, which is where the other three
 * registers rank from — and the asymmetry is the estate rather than an oversight. One
 * bank in twenty-five has a monitoring unit on it, so an alarm sort would rank one row
 * and leave the other twenty-four tied on nothing; runtime is a reading every bank
 * actually has. The day the units are fitted more widely this is the line to revisit,
 * and `alarmRank` in `site/data/siteAlarmQueue.ts` is the shape the answer wants.
 *
 * It sorted by **charge** first, and that was the wrong key. A percentage is a ratio
 * whose denominator is not in the table: these banks run 38 to 93 kWh at 78 to 98%
 * health, against loads that differ as much again. So two rows both reading `42%` can
 * be four hours apart, and a charge sort files the one that needs a truck tonight next
 * to the one that is fine until Thursday. Hours divide all of that out, which is why
 * the `Charge` cell prints them under the percentage — a sort key a reader cannot see
 * is a table that looks mis-ordered.
 *
 * **Health used to be the other column that could be wrong, and it deliberately did
 * not drive the sort.** It moves over years rather than hours, so a health-sorted
 * register would hand back the same order every morning — a ranking with no news in
 * it — while the runtime sort changes through the day and is what the page is opened
 * for. That argument is what eventually cost health its column: see
 * `useBankAlarmCounts` at the foot of this file.
 */
export const sortBanks = (banks: Array<BatteryBank>): Array<BatteryBank> =>
  [...banks].sort(
    (left, right) =>
      left.hoursLeft - right.hoursLeft || left.siteName.localeCompare(right.siteName),
  );

/**
 * Free-text filter behind the toolbar's search box.
 *
 * The placeholder says "Bank name", and it matches the placename too — which is on
 * screen in the row a reader is looking at, under the name. `searchGensets` makes the
 * same argument about a genset's model and place.
 */
export const searchBanks = (banks: Array<BatteryBank>, query: string): Array<BatteryBank> => {
  const needle = query.trim().toLowerCase();
  if (!needle) return banks;

  return banks.filter((bank) =>
    [bank.siteName, bank.locationLabel].some((field) => field.toLowerCase().includes(needle)),
  );
};

/** What the toolbar's dropdown narrows by. Absent fields do not narrow anything. */
export type BatteryFilters = {customer?: string};

export const filterBanks = (
  banks: Array<BatteryBank>,
  filters: BatteryFilters,
): Array<BatteryBank> =>
  banks.filter((bank) => {
    if (filters.customer !== undefined && bank.customer !== filters.customer) return false;
    return true;
  });

export type BatterySummary = {
  total: number;
  /** Specified usable energy across the estate, kWh — not discounted by health. */
  totalKwh: number;
  /** Banks whose runtime is under the low line — see `bankRuntime`. */
  low: number;
  /** The shortest runtime on the estate, hours. `0` on an estate with no storage. */
  lowestHours: number;
  discharging: number;
  charging: number;
  /**
   * Mean state of health, `0`–`1`, and how many banks sit under 85%.
   *
   * A mean rather than a worst, unlike the runtime card beside it, and the difference
   * is the point: health moves over years, so the estate's average is a fact about the
   * conversion programme, while the one flat bank tonight is an errand.
   */
  meanSoh: number;
  tired: number;
  /**
   * Regions with a bank in them, in roster order — the toolbar's dropdown. Regions
   * with none are dropped rather than shown as zero.
   */
  byCustomer: Array<{key: string; label: string; count: number}>;
};

/** Banks under this state of health are counted as tired on the strip. */
const TIRED_SOH = 0.85;

/**
 * The strip's figures and the dropdown's counts, over the **whole** register.
 *
 * Not the filtered one — `fleetSummary`'s rule, worth restating: a card that shrinks
 * to match the filter it applied says nothing, and the way back to the full picture
 * disappears with the numbers. The one figure that follows the filter is the
 * headline's "showing N", which the page passes in separately.
 */
export const batterySummary = (banks: Array<BatteryBank>): BatterySummary => {
  const counts = new Map<string, number>();
  let totalKwh = 0;
  let low = 0;
  let lowestHours = Number.POSITIVE_INFINITY;
  let discharging = 0;
  let charging = 0;
  let sohTotal = 0;
  let tired = 0;

  for (const bank of banks) {
    counts.set(bank.customer, (counts.get(bank.customer) ?? 0) + 1);
    totalKwh += bank.kwh;
    if (bankRuntime(bank) === 'LOW') low += 1;
    lowestHours = Math.min(lowestHours, bank.hoursLeft);

    const flow = bankFlow(bank);
    if (flow === 'DISCHARGING') discharging += 1;
    if (flow === 'CHARGING') charging += 1;

    sohTotal += bank.soh;
    if (bank.soh < TIRED_SOH) tired += 1;
  }

  return {
    total: banks.length,
    totalKwh,
    low,
    // `Infinity` is what an empty estate leaves behind, and a card reading `∞ h` is
    // worse than one reading nothing.
    lowestHours: banks.length === 0 ? 0 : lowestHours,
    discharging,
    charging,
    meanSoh: banks.length === 0 ? 0 : sohTotal / banks.length,
    tired,
    byCustomer: CUSTOMERS.map((entry) => ({
      key: entry.id,
      label: entry.shortName,
      count: counts.get(entry.id) ?? 0,
    })).filter((tally) => tally.count > 0),
  };
};

/**
 * What is standing on every bank, by severity — the register's `Alarm` column.
 *
 * ## Why this replaced the health column
 *
 * `Health` was a column until 2026-09-14 (Tristan): one percentage per row, and the
 * only reading in the table that **cannot change between two visits**. State of health
 * moves over years, so a health column hands back the same nineteen numbers every
 * morning — `sortBanks` above already says that in its own terms, which is why health
 * was kept out of the sort. A column nobody's day depends on is the one to spend on
 * the pill the other three registers carry, so `/battery` now answers *what is wrong
 * here* in the same place and the same shape `/solar`, `/gensets` and `/sites` do.
 *
 * Health has not left the screen: it is a row in `BankPreviewPanel` beside the list,
 * and the strip's `Mean health` card still counts the estate's tired banks.
 *
 * ## Where the counts come from
 *
 * `plantAlarmQueue` — the **same call** `BankHome`'s strip and `BankAlarms`' standing
 * table make, not a second count taken here. That file states the rule: two numbers
 * about one bank on two adjacent pages is precisely the pair that drifts. Cleared rows
 * are excluded, so clearing one on a bank's tab drops its count here on the way back.
 *
 * A bank's id **is** its site's, which is what lets this reach the monitoring unit on
 * the wall beside it without a lookup.
 *
 * ⚠️ **A bank with no monitoring unit on its DC plant draws the same empty pill as a
 * bank whose unit is reporting nothing**, and this column cannot tell them apart. That
 * is the ambiguity `battery_.$bankId.alarms.tsx` is written around at length —
 * *nothing standing* and *nothing watching* are two different facts and only the
 * bank's own Alarms tab says which one a given bank is. The pill links to exactly that
 * tab, so the qualification is one click away, which is the same distance it is from
 * the bank's own metric strip. `plantAlarmsWatched` is the predicate if this column
 * should ever say so itself.
 */
export const useBankAlarmCounts = (
  /** The register's own clock reading, so this and `useBatteryBanks` build one list. */
  now: number,
): Record<string, Record<AlertSeverity, number>> => {
  const handling = useAlarmHandling();
  const roles = useSitePowerRoles();
  const banks = useBatteryBanks(now);

  return useMemo(
    () =>
      Object.fromEntries(
        banks.map((bank) => [
          bank.id,
          countBySeverity(
            plantAlarmQueue(bank.id, roles[bank.id] ?? FALLBACK_POWER_ROLE, 'BATTERY', handling)
              .standing,
          ),
        ]),
      ),
    [banks, roles, handling],
  );
};
