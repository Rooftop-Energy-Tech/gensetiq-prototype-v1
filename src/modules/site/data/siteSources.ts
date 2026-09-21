import {BoomBoxIcon, UtilityPoleIcon} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import type {LinkProps} from '@tanstack/react-router';

import type {RunState} from '@/modules/genset/types/genset.type';
import {amount} from '@/lib/format';
import {deviceGensetId, gensetDeviceKey} from '../types/device.type';
import type {SiteDeviceKey} from '../types/device.type';
import {hasMains, isolatorStateOf, mainsContactorStateOf} from '../types/site.type';
import type {MainsSupply, SitePowerRole, SwitchState} from '../types/site.type';
import {siteFeed} from './sites';
import type {SiteFeed, SiteSummary} from './sites';

/**
 * What is standing at a site and what each thing is putting into the bus.
 *
 * ## Why this is data and not a drawing
 *
 * It was the data half of `SiteDiagram`, the single-line schematic, which has been
 * removed: a one-line circuit of an incomer, a bus and a set is a *telco DC plant*
 * picture, and this product puts a genset in a yard. The plant scene answers the
 * same question by drawing the compound, which is what a reader arriving at a site
 * is actually asking about.
 *
 * The answers themselves outlived the schematic. Which sources a site has, whether
 * each one's isolator is shut, what each is delivering and where its box leads when
 * clicked are facts about the site, not about any one projection of it — so they
 * live here and `SitePlantScene` reads them.
 */

/**
 * Where a device box goes when it is opened, and where its pill goes.
 *
 * Written once here so a drawing and the card it opens cannot send a reader to two
 * different places. The genset is the only device with a page, so this is one pair;
 * see `device.type.ts`.
 *
 * `fromSite` on both, so a page opened from this drawing crumbs back to this site
 * rather than springing to that asset's own register.
 *
 * Exported because the **plant scene** is the same band's other projection and has the
 * same two ways out of a device. One table, so the two drawings cannot send a reader to
 * two different places for the same box.
 */
export const deviceRoutes = (
  device: SiteDeviceKey,
): {page: LinkProps['to']; alarms: LinkProps['to']; params: LinkProps['params']} => {
  const gensetId = deviceGensetId(device);
  return {page: '/gensets/$gensetId', alarms: '/gensets/$gensetId/alarms', params: {gensetId}};
};

// ─── Nodes ───────────────────────────────────────────────────────────────────

/**
 * What a set is putting into the bus, written under its node.
 *
 * Only a connected, turning set gets a figure. The rest get a word, because the
 * alternative — `0 kW` — is a *measurement*, and claiming to have measured zero at
 * a machine that is unreachable is a stronger statement than the page is
 * entitled to make. `off-load` is the interesting one: the set is running, and
 * isolated, so it is producing nothing here by choice.
 */
const powerLabel = (runState: RunState, live: boolean, loadKw: number | null): string => {
  if (live && loadKw !== null) return amount(loadKw, 'kW');
  if (runState === 'RUNNING') return 'off-load';
  if (runState === 'IDLE') return 'stopped';
  return 'unavailable';
};

/**
 * The same sentence for the grid, in the same three words where they apply.
 *
 * `off-load` is doing real work here and it is the reason this whole file changed.
 * A healthy incomer sitting behind a set that has the load is **off-load** — present,
 * fine, not carrying — and that is the picture of a **test run**. `failed` is the
 * other case, and the two must never be drawn the same way: one is a chore somebody
 * scheduled, the other is why the site is on diesel.
 */
/**
 * What the cabinet is doing, written under its node.
 *
 * The same four states `cabinet.type.ts` gives `carrying`, and derived the same way
 * from `siteFeed` — an incomer and a set both arrive through the rectifiers, the
 * array through its SSUs, and the other two are the box converting nothing. They stay
 * separate for that file's reason: a bank carrying is a solar hybrid working exactly
 * as bought, every night, and an unserved tower is an outage.
 *
 * Derived here rather than read off an assembled `SubrackCabinet` so this component
 * stays a pure function of its props — see `hasCabinet`.
 */
export const cabinetPowerLabel = (source: SiteFeed['source']): string => {
  if (source === 'MAINS' || source === 'GENSET') return 'rectifiers';
  if (source === 'SOLAR') return 'SSUs';
  if (source === 'BATTERY') return 'bank carrying';
  return 'not served';
};

const mainsPowerLabel = (mains: MainsSupply, carrying: boolean): string => {
  if (!mains.live) return 'failed';
  if (!carrying) return 'off-load';
  // Carrying, so there is real power here and the incomer's own figure says how
  // much. The three words above are states of the supply; this is its reading.
  return amount(mains.kw, 'kW');
};

/**
 * One row of the diagram: a box, its switch, and its run onto the bus.
 *
 * The mains and a genset differ in exactly three things a reader can see — the
 * glyph, the two caption lines, and where the switch stands — so they are one shape
 * here rather than two branches through the render. Everything geometric is shared
 * by construction, which is what guarantees a conductor cannot land in mid-air on
 * one kind of source and not the other.
 */

/**
 * One row of the diagram: a box, its switch, and its run onto the bus.
 *
 * The mains and a genset differ in exactly three things a reader can see — the
 * glyph, the two caption lines, and where the switch stands — so they are one shape
 * here rather than two branches through the render. Everything geometric is shared
 * by construction, which is what guarantees a conductor cannot land in mid-air on
 * one kind of source and not the other.
 */
export type DiagramSource = {
  key: string;
  icon: LucideIcon;
  /** The word inside the box — `MAINS` or `GENSET`, as the design writes them. */
  label: string;
  /** First caption line: which supply or which asset this is. */
  caption: string;
  /** Second caption line: what it is putting into the bus. */
  power: string;
  switchState: SwitchState;
  /**
   * Whether this source is **taking** power rather than giving it — the bank on
   * charge, and nothing else in this drawing.
   *
   * Here rather than recomputed where it is read, because it is the same fact the
   * `power` line and `switchState` above are already derived from, and one row
   * deciding its own state once is what keeps the two conductors that meet at this
   * box from disagreeing about which way the power is going. See `bankFlow`.
   */
  charging?: boolean;
};

/**
 * The device a source node stands for, or `undefined` if it is not a device.
 *
 * The mains is the `undefined` case and the only one: an incomer is a supply the
 * site is connected to, not a machine on this estate's books, so there is no device
 * card behind it and its node must not offer a click. Every other source key is a
 * genset's own id.
 */

/**
 * The device a source node stands for, or `undefined` if it is not a device.
 *
 * The mains is the `undefined` case and the only one: an incomer is a supply the
 * site is connected to, not a machine on this estate's books, so there is no device
 * card behind it and its node must not offer a click. Every other source key is a
 * genset's own id.
 */
export const deviceOfSource = (key: string): SiteDeviceKey | undefined =>
  key === 'mains' ? undefined : gensetDeviceKey(key);

/** Everything the drawing needs to act as the page's device picker. */

/** Everything a drawing needs to act as the page's device picker. */
export type SiteSceneSelection = {
  /** The devices with a card behind them. Anything else stays inert. */
  devices: Array<SiteDeviceKey>;
  selected: SiteDeviceKey | undefined;
  onSelect: (device: SiteDeviceKey) => void;
};


/**
 * Every source feeding this site's bus, top to bottom.
 *
 * ## The order, and what it says
 *
 * **Array, mains, bank, sets.** Reading the column downwards is reading the order
 * the site uses its sources in — which is why the bank sits above the machine that
 * charges it, and why the array, the one source that costs nothing to run, sits above
 * everything.
 *
 * The array is in this list at all as of the column rework; it used to be a shape of
 * its own in a column of its own. See `TIE_X` for what that cost and what came
 * back in its place.
 *
 * No site has both an incomer and an array today — `hasMains` is `GRID_BACKUP` only
 * and `hasSolar` is `SOLAR_HYBRID` only — so the relative order of those two is a
 * decision nothing currently exercises.
 */
export const sourcesOf = (
  summary: SiteSummary,
  dutyId: string | undefined,
  role: SitePowerRole,
): Array<DiagramSource> => {
  const feed = siteFeed(summary, dutyId, role);
  const gensetCarrying = feed.source === 'GENSET';

  const gensets: Array<DiagramSource> = summary.gensets.map(({genset, detail}) => {
    const switchState = isolatorStateOf(genset.runState, genset.id === dutyId);
    return {
      key: genset.id,
      icon: BoomBoxIcon,
      label: 'GENSET',
      caption: genset.tag,
      power: powerLabel(genset.runState, switchState.live, detail.loadKw),
      switchState,
    };
  });

  const sources: Array<DiagramSource> = [];

  if (hasMains(role)) {
    sources.push({
      key: 'mains',
      icon: UtilityPoleIcon,
      label: 'MAINS',
      caption: 'Grid supply',
      power: mainsPowerLabel(
        summary.mains,
        mainsContactorStateOf(summary.mains, gensetCarrying).live,
      ),
      switchState: mainsContactorStateOf(summary.mains, gensetCarrying),
    });
  }

  return [...sources, ...gensets];
};

/**
 * How wide this site's canvas is, in the design's own pixels.
 *
 * A constant again, and kept as a function of the role on purpose.
 *
 * It has been three things: 398 for every site, then 530 at a solar hybrid when the
 * array had a column of its own, then 418 when that became a 20px tie gutter. The
 * array is a row and the tie runs down the boxes themselves, so there is no gutter and
 * every role is back to the design's 398. A solar hybrid's drawing is **taller** than
 * the others and no wider.
 *
 * Still exported, still takes the role: the site page grid-templates a column off it,
 * and the next thing that widens one role's canvas should be a change here rather than
 * a number to hunt for in a caller.
 */
/**
 * The canvas width, which the page needs before the drawing renders — it sizes the
 * grid track the diagram sits in.
 *
 * Takes whether the site has a cabinet rather than the site itself, so the settings
 * page's two live previews can ask for either arrangement without inventing a site.
 */