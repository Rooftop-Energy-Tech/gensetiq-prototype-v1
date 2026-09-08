import {useMemo} from 'react';

import {GENSETS} from '@/modules/genset/data/fleet';
import {assertedPlantAlarms} from '@/modules/genset/data/assertedAlarms';
import {controllerAlarms} from '@/modules/genset/data/alarmViews';
import {useAlarmHandling} from '@/modules/genset/data/alarms';
import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import {byUrgency, isStanding} from '@/modules/genset/types/alarmState.type';
import type {AlarmHandling} from '@/modules/genset/types/alarmState.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {systemDetail} from '@/modules/solar/data/systemDetail';
import {solarAlarmRows} from '@/modules/solar/data/solarAlarmQueue';
import {useSolarSystem} from '@/modules/solar/data/systems';
import type {SolarSystem} from '@/modules/solar/types/system.type';
import {useSitePowerRole} from './siteConfig';
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
  system: SolarSystem | undefined,
  now: number,
  handling: Record<string, AlarmHandling>,
): Array<AlarmView> => {
  const rows: Array<AlarmView> = [
    ...tagged(assertedPlantAlarms(siteId, role, 'SITE', handling), 'SITE'),
    ...tagged(assertedPlantAlarms(siteId, role, 'BATTERY', handling), 'BATTERY'),
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

  // The array, where there is one — its derived rules and the unit's registers
  // together, which is the same list its own tab shows.
  if (system !== undefined) {
    const detail = systemDetail(system, now, false);
    if (detail !== undefined) {
      rows.push(...tagged(solarAlarmRows(system, detail, now, handling), 'SOLAR'));
    }
  }

  return rows;
};

export const useSiteAlarmQueue = (siteId: string, now: number): SiteAlarmQueue => {
  const handling = useAlarmHandling();
  const role = useSitePowerRole(siteId);
  // `undefined` where the role carries no array, which is how a site flipped to
  // `GRID_BACKUP` loses its solar rows without this file knowing the rule.
  const system = useSolarSystem(siteId, now);

  return useMemo(() => {
    const rows = rowsFor(siteId, role, system, now, handling);

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
  }, [siteId, role, system, now, handling]);
};
