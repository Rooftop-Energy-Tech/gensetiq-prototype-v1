import {BatteryChargingIcon, BoomBoxIcon, RadioTowerIcon, SunMediumIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {PLANT_ALARM_CATEGORY_LABEL} from '../types/plantAlarm.type';
import type {PlantAlarmCategory} from '../types/plantAlarm.type';

/**
 * The four assets as a word and a glyph.
 *
 * The icons are **not chosen here** — they are the four this app already uses for
 * these things, on the site settings tab where a reader picks a power role and in
 * the mobile nav where they pick a register. A fifth vocabulary for the same four
 * nouns is how one product ends up with two batteries.
 *
 * Separate from `plantAlarm.type.ts` because that file is types and data and is
 * imported by modules that never render — an icon component in it would pull React
 * into the data layer. `standingMeta.ts` splits for the same reason.
 */
export const CATEGORY_META: Record<PlantAlarmCategory, {label: string; icon: LucideIcon}> = {
  SITE: {label: PLANT_ALARM_CATEGORY_LABEL.SITE, icon: RadioTowerIcon},
  BATTERY: {label: PLANT_ALARM_CATEGORY_LABEL.BATTERY, icon: BatteryChargingIcon},
  GENSET: {label: PLANT_ALARM_CATEGORY_LABEL.GENSET, icon: BoomBoxIcon},
  SOLAR: {label: PLANT_ALARM_CATEGORY_LABEL.SOLAR, icon: SunMediumIcon},
};
