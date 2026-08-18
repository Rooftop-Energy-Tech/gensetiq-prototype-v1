import {FLEET_STATUSES, gensetStatus} from '@/modules/genset/data/fleetStatus';
import type {FleetStatus} from '@/modules/genset/data/fleetStatus';
import {siteStatus} from './estateSummary';
import type {SiteSummary} from './sites';
import type {SitePowerRole} from '../types/site.type';

/**
 * The overview screen's numbers: the estate cut by **how each yard is fed**, and
 * each of those cut again by **what needs doing**.
 *
 * ## Why duty is the outer cut
 *
 * Because the same status means two different jobs under it. A standby yard with a
 * dry tank has lost its *insurance* — the grid is still carrying, nobody has
 * noticed, and it becomes an outage only when the mains next drops. A prime yard
 * with a dry tank **is** the outage: there is no incomer behind it, and the load is
 * already down. One list ranked by severity would file those two next to each other
 * and hide the distinction that decides which van leaves first.
 *
 * So duty is the outer grouping, and the reader picks their half of the estate
 * before reading any counts.
 *
 * ## Sites, with gensets underneath
 *
 * A site is what somebody drives to, so the tile's number is a count of yards. The
 * genset figure sits under it because two dry sets at one site is one journey and
 * two jobs, and a plain site count cannot say which of those you are looking at.
 *
 * Both are worst-wins and exhaustive — see `fleetStatus.ts`. Every site is in one
 * bucket, so a role's four tiles add up to its site count, and the roles add up to
 * the estate.
 */

export type StatusCell = {
  status: FleetStatus;
  siteCount: number;
  /**
   * Sets standing at those sites that are *themselves* in this bucket.
   *
   * Not every set at a bucketed site: a yard filed under "Tank empty" because one
   * of its two sets is dry would otherwise report two empty tanks. The site count
   * says how many journeys; this says how much work is waiting at the end of them.
   */
  gensetCount: number;
};

export type RoleGroup = {
  role: SitePowerRole;
  siteCount: number;
  gensetCount: number;
  /** Always all four, worst first, so the row's shape never moves. */
  cells: Array<StatusCell>;
  /** Sites not in the `OK` bucket — the tile row's headline figure. */
  needingAttention: number;
};

export type FleetOverview = {
  siteCount: number;
  gensetCount: number;
  /** Sites in any bucket but `OK`, across both duties. */
  needingAttention: number;
  groups: Array<RoleGroup>;
};

/** Standby first: it is the larger half of every estate this app is built for. */
const ROLE_ORDER: Array<SitePowerRole> = ['STANDBY', 'PRIME'];

export const fleetOverview = (
  summaries: Array<SiteSummary>,
  roles: Record<string, SitePowerRole>,
): FleetOverview => {
  const groups = ROLE_ORDER.map((role) => {
    const inRole = summaries.filter((summary) => (roles[summary.site.id] ?? 'STANDBY') === role);

    const cells = FLEET_STATUSES.map((status) => {
      const sites = inRole.filter((summary) => siteStatus(summary) === status);
      return {
        status,
        siteCount: sites.length,
        gensetCount: sites.reduce(
          (running, summary) =>
            running +
            summary.gensets.filter(({genset}) => gensetStatus(genset) === status).length,
          0,
        ),
      };
    });

    return {
      role,
      siteCount: inRole.length,
      gensetCount: inRole.reduce((running, summary) => running + summary.gensets.length, 0),
      cells,
      needingAttention: inRole.filter((summary) => siteStatus(summary) !== 'OK').length,
    };
  });

  return {
    siteCount: summaries.length,
    gensetCount: summaries.reduce((running, summary) => running + summary.gensets.length, 0),
    needingAttention: groups.reduce((running, group) => running + group.needingAttention, 0),
    groups,
  };
};
