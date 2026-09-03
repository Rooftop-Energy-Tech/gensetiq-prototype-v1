import {FLEET_STATUSES, STATUS_META, gensetStatus, worstStatus} from '@/modules/genset/data/fleetStatus';
import type {FleetStatus} from '@/modules/genset/data/fleetStatus';
import type {Tally} from '@/modules/genset/data/fleetSummary';
import {CUSTOMERS} from './customers';
import type {CustomerId} from './customers';
import {PROGRAMS} from './programs';
import type {SiteSummary} from './sites';
import {SITE_POWER_ROLE_LABEL, SITE_POWER_ROLES} from '../types/site.type';
import type {SitePowerRole} from '../types/site.type';

/**
 * What the cards above the sites list count — the estate's answer to
 * `fleetSummary`, and the same three groupings read one level up.
 *
 * The two are deliberately separate functions rather than one generic over
 * "thing with a customer and a role". They count **different objects**, and the
 * difference is the point of having both: the fleet card says how many *machines*
 * belong to Sarawak, this one says how many *sites*. Collapsing them would make the
 * caller supply four accessors to save twenty lines, and the reader would have to
 * hold both meanings at once.
 *
 * Counted over the whole estate rather than the filtered view, for the reason
 * `fleetSummary` gives: a card that shrinks to match the filter it applied has
 * stopped saying anything.
 */

/**
 * A yard is as bad as the worst machine standing in it.
 *
 * The same rule `SiteSummary.condition` already follows for alarms, extended to the
 * whole status vocabulary — because the decision it feeds is the same one: somebody
 * gets in a van and drives to a *place*. A site with one dry tank and one full one
 * is a site you have to visit.
 *
 * A yard with nothing standing in it reads `OK`, which is thin but honest: there is
 * no machine there to be in trouble. It cannot arise from the seed, where every
 * site holds at least one set, but detaching gensets can produce it.
 */
export const siteStatus = (summary: SiteSummary): FleetStatus =>
  worstStatus(summary.gensets.map(({genset}) => gensetStatus(genset)));

/**
 * The key a site with no programme is counted and filtered under.
 *
 * A sentinel string rather than `null`, because this value travels in the URL and
 * `?program=` — the shape an absent filter already has — cannot also mean "filter to
 * the unfiled ones". `none` is not a legal programme id in any dataset, so there is
 * nothing for it to collide with, and it lets the chip's key be exactly the value
 * the link carries.
 */
export const NO_PROGRAM_FILTER = 'none';

export type EstateSummary = {
  total: number;
  /** Sets standing across the estate, so the headline can carry both figures. */
  gensetCount: number;
  byRole: Array<Tally<SitePowerRole>>;
  /** The four buckets, worst first. Always all four — see `fleetSummary`. */
  byStatus: Array<Tally<FleetStatus>>;
  byCustomer: Array<Tally<CustomerId>>;
  /**
   * By rollout programme, with **`null` for the sites in none** — and that entry is
   * the reason this is not just another `byCustomer`.
   *
   * Every other grouping on this card row partitions the estate into named buckets
   * a site must belong to exactly one of. A programme does not: it is a line the
   * operator drew, and a site nobody has filed is genuinely outside every line.
   * Dropping those sites would make the tallies sum to less than the estate with
   * nothing on screen to say why, so `Unassigned` is a bucket like any other and
   * filters like one.
   *
   * Empty on an estate whose dataset declares no programmes at all, which is what
   * withholds the card rather than showing one row reading `Unassigned 25`.
   */
  byProgram: Array<Tally<string>>;
};


export const estateSummary = (
  summaries: Array<SiteSummary>,
  roles: Record<string, SitePowerRole>,
): EstateSummary => {
  const roleCounts: Record<SitePowerRole, number> = {
    GRID_BACKUP: 0,
    DIESEL_PRIME: 0,
    DIESEL_HYBRID: 0,
    SOLAR_HYBRID: 0,
  };
  const customerCounts = new Map<CustomerId, number>();
  const programCounts = new Map<string, number>();
  const statusCounts: Record<FleetStatus, number> = {EMPTY: 0, ALARM: 0, REFUEL: 0, OK: 0};
  let gensetCount = 0;

  for (const summary of summaries) {
    gensetCount += summary.gensets.length;

    // A site always has a role — seeded, and overridable — so there is no depot
    // case here. That asymmetry with the fleet card is real rather than an
    // oversight: a machine can be between yards, a yard cannot.
    roleCounts[roles[summary.site.id] ?? 'GRID_BACKUP'] += 1;

    const account = summary.site.customer;
    customerCounts.set(account, (customerCounts.get(account) ?? 0) + 1);

    const filed = summary.site.program ?? NO_PROGRAM_FILTER;
    programCounts.set(filed, (programCounts.get(filed) ?? 0) + 1);

    statusCounts[siteStatus(summary)] += 1;
  }

  return {
    total: summaries.length,
    gensetCount,
    byRole: SITE_POWER_ROLES.map((role) => ({
      key: role,
      label: SITE_POWER_ROLE_LABEL[role],
      count: roleCounts[role],
    }))
      .filter((tally) => tally.count > 0),
    byStatus: FLEET_STATUSES.map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      count: statusCounts[status],
    })),
    byCustomer: CUSTOMERS.map((account) => ({
      key: account.id,
      label: account.shortName,
      count: customerCounts.get(account.id) ?? 0,
    })).filter((tally) => tally.count > 0),
    // `Unassigned` last and included only when it holds something — it is the
    // bucket for sites outside every programme, not a permanent zero-row reminder
    // that the concept exists. The whole card disappears on an estate with no
    // programmes, which is what the empty roster does on its own.
    byProgram:
      PROGRAMS.length === 0
        ? []
        : [
            ...PROGRAMS.map((entry) => ({
              key: entry.id,
              label: entry.shortName,
              count: programCounts.get(entry.id) ?? 0,
            })),
            {
              key: NO_PROGRAM_FILTER,
              label: 'Unassigned',
              count: programCounts.get(NO_PROGRAM_FILTER) ?? 0,
            },
          ].filter((tally) => tally.count > 0),
  };
};

/** What the chips above the sites list narrow by. Every field is optional and ANDs. */
export type SiteFilters = {
  customer?: string;
  role?: SitePowerRole;
  status?: FleetStatus;
  /**
   * A programme id, or `NO_PROGRAM_FILTER` for the sites filed under none.
   */
  program?: string;
};



/**
 * The chips, applied to the estate — `filterGensets`'s counterpart, and separate
 * from `searchSites` for the reason given there: a typed guess and a chosen bucket
 * are different acts, and each has to be clearable on its own.
 */
export const filterSites = (
  summaries: Array<SiteSummary>,
  filters: SiteFilters,
  roles: Record<string, SitePowerRole>,
): Array<SiteSummary> =>
  summaries.filter((summary) => {
    if (filters.customer !== undefined && summary.site.customer !== filters.customer) return false;
    if (filters.role !== undefined && (roles[summary.site.id] ?? 'GRID_BACKUP') !== filters.role) {
      return false;
    }
    if (filters.status !== undefined && siteStatus(summary) !== filters.status) return false;
    if (filters.program !== undefined) {
      const filed = summary.site.program ?? NO_PROGRAM_FILTER;
      if (filed !== filters.program) return false;
    }
    return true;
  });
