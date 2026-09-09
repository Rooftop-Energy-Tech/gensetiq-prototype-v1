import {ContainerIcon, PlugZapIcon, SplitIcon, SunMediumIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {CABINET_PART_LABEL} from '../types/plantAlarm.type';
import type {CabinetPart} from '../types/plantAlarm.type';

/**
 * The five cabinet parts as a word and a glyph — the site tab's third tier of filter.
 *
 * ## Two of the five are borrowed on purpose
 *
 * `RECTIFIERS` takes the incomer's utility pole and `SSUS` takes the sun, which are
 * the exact icons the cabinet page's own figure puts on those bays and the site
 * diagram puts on those sources. A reader who has clicked a rectifier bay on the
 * cabinet page and then filters this table to `Rectifiers` should be looking at the
 * same mark twice — a second glyph for the same shelf is how one product ends up with
 * two rectifiers, which is the argument `categoryMeta.ts` makes for the four
 * categories above these.
 *
 * The other three are new because nothing in the app had drawn them before:
 *
 * - **Distribution** splits: one bus in, three 200 A branches out. `SplitIcon` is the
 *   only glyph in the set that says *one thing becoming several*, which is the whole
 *   of what a DCDU does.
 * - **AC input** is a plug with a bolt through it — what arrives, before conversion.
 *   Not the utility pole, which is already the rectifiers': the pole is *the supply*
 *   and this is *the terminals it lands on*, and the two rows that matter here are a
 *   spent arrester and a dropped phase, both of which happen at the terminals.
 * - **Enclosure** is a container, because that is what it is. Deliberately not
 *   `ServerIcon` — that is `Cabinet`, the chip these five sit under, and giving a
 *   part the same mark as its parent would say the enclosure *is* the cabinet when it
 *   is one of five things in it. Deliberately not a door either: the door is one of
 *   its three rows and the other two are water and smoke.
 *
 * Separate file from `categoryMeta.ts` rather than a second export in it, because
 * they are two different tiers and a component that draws one row of chips should not
 * have to import the other. Same reason that file exists apart from
 * `plantAlarm.type.ts`.
 */
export const PART_META: Record<CabinetPart, {label: string; icon: LucideIcon}> = {
  RECTIFIERS: {label: CABINET_PART_LABEL.RECTIFIERS, icon: UtilityPoleIcon},
  SSUS: {label: CABINET_PART_LABEL.SSUS, icon: SunMediumIcon},
  DISTRIBUTION: {label: CABINET_PART_LABEL.DISTRIBUTION, icon: SplitIcon},
  AC_INPUT: {label: CABINET_PART_LABEL.AC_INPUT, icon: PlugZapIcon},
  ENCLOSURE: {label: CABINET_PART_LABEL.ENCLOSURE, icon: ContainerIcon},
};
