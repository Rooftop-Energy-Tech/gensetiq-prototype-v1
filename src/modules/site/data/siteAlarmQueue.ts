import {useMemo} from 'react';

import {GENSETS} from '@/modules/genset/data/fleet';
import {assertedPlantAlarms} from '@/modules/genset/data/assertedAlarms';
import {controllerAlarms} from '@/modules/genset/data/alarmViews';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {ALERT_SEVERITIES, countBySeverity} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {byUrgency, isStanding} from '@/modules/genset/types/alarmState.type';
import type {AlarmHandling} from '@/modules/genset/types/alarmState.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {FALLBACK_POWER_ROLE, useSitePowerRole, useSitePowerRoles} from './siteConfig';
import {siteSeeds} from './siteSeed';
import type {PlantAlarmCategory} from '../types/plantAlarm.type';
import type {SitePowerRole} from '../types/site.type';

/**
 * Every alarm standing anywhere on one site, in one queue.
 *
 * ## What this is the union of
 *
 * The four Alarms tabs, exactly — and that is the invariant worth stating, because
 * it is the only thing that stops this page becoming a fifth opinion. A reader who
 * counts eleven rows here must find those same eleven spread across the site, bank,
 * array and set tabs, and clearing one from either end has to clear it from the
 * other. It does, because there is one handling store keyed on the alarm's own id
 * and every source below is the same call the asset's own tab makes.
 *
 * | Asset | Where its rows come from |
 * |---|---|
 * | Site | the monitoring unit's `SITE` registers |
 * | Battery | the monitoring unit's `BATTERY` registers |
 * | Genset | each set's **own controller** plus the unit's `GENSET` registers |
 * | Solar | the app's **derived rules** plus the unit's `SOLAR` registers |
 *
 * ## Three kinds of claim, and none of them flattened
 *
 * A **register** is a device's own assertion, an address on the Huawei SMU02C with
 * no arithmetic in between. A **controller bit** is Deep Sea's, off a different map
 * with a different vocabulary — `Shutdown Alarm` where Huawei says `Major alarm`.
 * A **derived** row is this app reasoning over the generation series: nothing on the
 * roof can see that output stepped down in March.
 *
 * They are merged into one ordering rather than banded, for the reason the genset's
 * two devices are: a reader asking *what is wrong at this site* should not have to
 * scan three lists and hope the worse row is in the upper one. What tells them apart
 * is on the row — the `Class` column carries each device's own word, and the line
 * under the name names the box and the register, or the machine and the bit, or the
 * rule that fired.
 *
 * ## Why a hook rather than a function
 *
 * Because the solar half needs the site's **live** power role: a reader can flip
 * this site to `GRID_BACKUP` on its settings tab, which both removes the array and
 * re-files the nine per-phase AC registers from Genset to Site. A queue built from a
 * role read once at module load would keep showing an array that is no longer there.
 * `plantAlarmQueue` takes its role as an argument for the same reason; this one has
 * three sources to reconcile, so it does the subscribing itself.
 */

/**
 * The two tables, each ordered as its table wants.
 *
 * No per-asset counts here, deliberately. The page's chips count each axis
 * against the *other* axis's selection — so `Battery` reads how many criticals the
 * battery has once `Critical` is on — and a count computed here could only be over
 * the whole queue, which is the one number that stops being true the moment somebody
 * clicks anything. Counting is the page's job because the selection is the page's.
 */
export type SiteAlarmQueue = {
  standing: Array<AlarmView>;
  cleared: Array<AlarmView>;
};

const tagged = (
  rows: Array<AlarmView>,
  asset: PlantAlarmCategory,
): Array<AlarmView> => rows.map((row) => ({...row, asset}));

/**
 * Every row on the site, untagged by standing.
 *
 * Split out from the hook so the ordering below is the only thing the hook adds,
 * and so the union can be read in one screenful.
 */
const rowsFor = (
  siteId: string,
  role: SitePowerRole,
  handling: Record<string, AlarmHandling>,
): Array<AlarmView> => {
  const rows: Array<AlarmView> = [
    ...tagged(assertedPlantAlarms(siteId, role, 'SITE', handling), 'SITE'),
    ...tagged(assertedPlantAlarms(siteId, role, 'GENSET', handling), 'GENSET'),
  ];

  /**
   * Each set standing on this yard, named on the row.
   *
   * The tag goes in front of the controller's own provenance line because a site can
   * carry more than one machine, and two sets of the same model raise the same bit
   * with the same words — `Earth fault · < 24 V · register 1299 bit 0` twice over is
   * a queue that cannot be worked. On the set's own page there is no ambiguity and no
   * prefix, which is why this is done here rather than in `controllerAlarms`.
   */
  for (const genset of GENSETS.filter((machine) => machine.siteId === siteId)) {
    rows.push(
      ...controllerAlarms(genset.id, handling).map((row) => ({
        ...row,
        asset: 'GENSET' as const,
        provenance: `${genset.tag} · ${row.provenance}`,
      })),
    );
  }

  return rows;
};

export const useSiteAlarmQueue = (siteId: string, now: number): SiteAlarmQueue => {
  const handling = useAlarmHandling();
  const role = useSitePowerRole(siteId);
  return useMemo(() => {
    const rows = rowsFor(siteId, role, handling);

    const standing = rows
      .filter(isStanding)
      // Unclaimed first, then worse severity first — the work-queue ordering every
      // Alarms page in this app uses.
      .sort(byUrgency((alarm) => ALERT_SEVERITIES.indexOf(alarm.severity)));

    return {
      standing,
      // Most recently dealt with first — the log ordering.
      cleared: rows
        .filter((alarm) => !isStanding(alarm))
        .sort(
          (left, right) =>
            new Date(right.handling.clearedAt ?? 0).getTime() -
            new Date(left.handling.clearedAt ?? 0).getTime(),
        ),
    };
  }, [siteId, role, now, handling]);
};

/**
 * Every site's standing count, in one pass — what the estate list ranks and draws.
 *
 * ## Why the list counts rather than judges
 *
 * The sites list used to carry a **condition verdict** — `Critical`, `Attention`,
 * `Optimum` — rolled up from the yard's gensets, and it was removed (Tristan,
 * 2026-09-14) in favour of the count the rest of the app already shows. Two reasons,
 * and the second is the one that settles it:
 *
 * 1. **A verdict is a compression of a list nobody was shown.** `Attention` told a
 *    reader that something was wrong and then made them open the site to find out
 *    what, which is the same click the alarm pill costs — except the pill also says
 *    *how many* and *how bad* before it is clicked.
 * 2. **It was a second opinion.** The verdict ranked the **gensets' alarms only**, and
 *    a site is watched by more than its engines: the monitoring unit reports on the
 *    plant, the cabinet and the bank, and this app derives its own rules over the
 *    array. So a site with eleven standing rows and no genset among them read
 *    `Optimum` in the list while its own Alarms tab listed eleven — the same
 *    undercount the metric strip was fixed for, one screen up. The strip's note says
 *    it plainly: a summary that disagrees with the page it summarises is worse than
 *    no summary.
 *
 * So the estate reads the **same union** every site page reads — `rowsFor` above, the
 * four Alarms tabs — and the list, the map's ranking and the preview panel are three
 * renderings of one queue. Clearing a row on any tab drops the count on the way back.
 *
 * ## Why the whole estate at once, rather than a hook per row
 *
 * `useSiteAlarmQueue` is one site's, and a table cannot call it once per row — the
 * rows are drawn in a `map`, not as components, and seventeen subscriptions to three
 * stores would be seventeen chances to read three different moments. One pass over the
 * seeds, memoised on the same three inputs the single-site hook takes, keeps every row
 * on one reading.
 *
 * Counts only. The rows themselves are the site page's business, and materialising
 * seventeen sorted queues to render seventeen pills would be work nobody reads.
 */
export const useEstateAlarmCounts = (
  now: number,
): Record<string, Record<AlertSeverity, number>> => {
  const handling = useAlarmHandling();
  const roles = useSitePowerRoles();

  return useMemo(
    () =>
      Object.fromEntries(
        siteSeeds().map((seed) => {
          const role = roles[seed.id] ?? FALLBACK_POWER_ROLE;
          const rows = rowsFor(seed.id, role, handling);
          return [seed.id, countBySeverity(rows.filter(isStanding))];
        }),
      ),
    [roles, now, handling],
  );
};

/**
 * A site's place in the estate list: worst standing severity first, then how many.
 *
 * The replacement for `CONDITION_RANK` in `sites.ts`, and the same shape of answer —
 * one small integer per site, lowest first — so the list, the switcher and the map
 * still rank the estate once rather than three times.
 *
 * **Severity before volume.** One critical outranks nine warnings, because they are
 * different jobs: a shutdown alarm is a van today and nine notices are a morning's
 * reading. Volume breaks the tie *within* a severity, worst-first, which is what
 * separates two sites that both have criticals standing.
 *
 * A site with nothing standing sorts last and sorts among its peers by name — there is
 * no ranking to be had between two quiet yards, and inventing one would make the foot
 * of the list reshuffle for no reason a reader could see.
 */
export const ALARM_RANK_FLOOR = ALERT_SEVERITIES.length;

export const alarmRank = (counts: Record<AlertSeverity, number> | undefined): number => {
  if (counts === undefined) return ALARM_RANK_FLOOR;
  const worst = ALERT_SEVERITIES.findIndex((severity) => counts[severity] > 0);
  return worst === -1 ? ALARM_RANK_FLOOR : worst;
};

/** How many rows are standing at the rank `alarmRank` returned — the tie-break. */
export const alarmRankCount = (counts: Record<AlertSeverity, number> | undefined): number => {
  const rank = alarmRank(counts);
  return rank === ALARM_RANK_FLOOR || counts === undefined ? 0 : counts[ALERT_SEVERITIES[rank]];
};
