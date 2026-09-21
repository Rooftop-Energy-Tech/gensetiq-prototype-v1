import type {FilterOption} from '@/components/global/FilterSelect';
import {allDeployments, deploymentTotals} from '@/modules/genset/data/deployments';
import {fleet} from '@/modules/genset/data/deployment';
import type {DeploymentTotals} from '@/modules/genset/data/deployments';
import {gensetById} from '@/modules/genset/data/detail';
import {deploymentElapsedMs} from '@/modules/genset/types/deployment.type';
import type {DeploymentSession} from '@/modules/genset/types/deployment.type';
import {customerShortName} from '@/modules/site/data/customers';
import type {CustomerId} from '@/modules/site/data/customers';
import {siteSeed} from '@/modules/site/data/siteSeed';
import {
  DEPLOYMENT_STATES,
  type DeploymentSort,
  type DeploymentSortDirection,
  type DeploymentState,
} from '../types/view.type';

/**
 * A posting, with everything the feed draws it against resolved once.
 *
 * The screen's unit of work, and the reason it exists as a type: a posting on its
 * own is four ids and two timestamps, and every one of the feed's four views wants
 * the same five joins off it — the machine's tag, the yard's name and coordinates,
 * whose division that yard is in, and what the posting cost. Resolving those per
 * view would mean the table, the map, the Gantt and the panel each walking the
 * fleet separately, and four chances for a row and a pin to disagree.
 *
 * Built in `SiteSummary`'s image, one level down: the site register joins a site to
 * the plant standing on it, and this joins a posting to the machine and the place it
 * is a posting *of*.
 */
export type DeploymentRow = {
  deployment: DeploymentSession;
  /** `BRF9540`, or the raw id for a machine the fleet no longer carries. */
  tag: string;
  model: string;
  siteName: string;
  /** The placename copied onto the posting — history survives a site rename. */
  locationLabel: string;
  /**
   * The yard's division, or `undefined` for a posting at a site this dataset no
   * longer declares. The filter treats that the same way the fleet does an
   * unfitted machine: it is a real state, and it is not a division.
   */
  customerId: CustomerId | undefined;
  /** The yard's position, for the map. `undefined` if the seed has gone. */
  latitude: number | undefined;
  longitude: number | undefined;
  /** Open right now. The feed leads with these and the strip counts them. */
  ongoing: boolean;
  /** Milliseconds the posting has lasted — measured to `now` while it is open. */
  elapsedMs: number;
  startedMs: number;
  /** Close, or `now` while open — the Gantt's right-hand edge for this bar. */
  endedMs: number;
  totals: DeploymentTotals;
};

/**
 * Every posting in the fleet, joined.
 *
 * `now` is passed rather than read, for the reason `deploymentElapsedMs` gives: a
 * screen drawing eighty postings should measure them all against one clock reading,
 * or two rows a millisecond apart can disagree about the current day.
 */
export const deploymentRows = (now: number): Array<DeploymentRow> =>
  allDeployments().map((deployment) => {
    const genset = gensetById(deployment.gensetId);
    const seed = siteSeed(deployment.siteId);
    const startedMs = new Date(deployment.startedAt).getTime();

    return {
      deployment,
      tag: genset?.tag ?? deployment.gensetId,
      model: genset?.model ?? '',
      siteName: seed?.name ?? deployment.locationLabel,
      locationLabel: deployment.locationLabel,
      customerId: seed?.customer,
      latitude: seed?.latitude,
      longitude: seed?.longitude,
      ongoing: deployment.endedAt === null,
      elapsedMs: deploymentElapsedMs(deployment, now),
      startedMs,
      endedMs: deployment.endedAt === null ? now : new Date(deployment.endedAt).getTime(),
      totals: deploymentTotals(deployment),
    };
  });

/**
 * Free-text search: the tag, the model, the yard, the placename and the lorry.
 *
 * The plate is in there because "where is SAB 4417 T" is a question the operations
 * room asks out loud, and it is the one field on this screen that belongs to
 * neither the machine nor the site.
 */
export const searchDeployments = (
  rows: Array<DeploymentRow>,
  query: string,
): Array<DeploymentRow> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') return rows;

  return rows.filter((row) =>
    [row.tag, row.model, row.siteName, row.locationLabel, row.deployment.lorryPlate].some(
      (field) => field.toLowerCase().includes(needle),
    ),
  );
};

export type DeploymentFilters = {
  state: DeploymentState | undefined;
  customer: string | undefined;
};

export const filterDeployments = (
  rows: Array<DeploymentRow>,
  {state, customer}: DeploymentFilters,
): Array<DeploymentRow> =>
  rows.filter((row) => {
    if (state === 'ongoing' && !row.ongoing) return false;
    if (state === 'completed' && row.ongoing) return false;
    if (customer !== undefined && row.customerId !== customer) return false;
    return true;
  });

/**
 * Order the feed.
 *
 * **Ongoing postings lead whatever the key is**, and that is deliberate rather than
 * an oversight in the comparator. A closed posting is a record and an open one is a
 * machine standing in somebody's yard right now; a sort that let the thirstiest
 * posting of last month outrank it would bury the only rows anybody can still act
 * on. The key then orders within each group.
 *
 * The one exception is `genset`, which is a lookup rather than a ranking — somebody
 * sorting by tag is looking a machine up, and splitting its chain across two blocks
 * would defeat the only reason to ask for that order.
 */
export const sortDeployments = (
  rows: Array<DeploymentRow>,
  sort: DeploymentSort,
  direction: DeploymentSortDirection,
): Array<DeploymentRow> => {
  const sign = direction === 'asc' ? 1 : -1;

  const compare = (a: DeploymentRow, b: DeploymentRow): number => {
    switch (sort) {
      case 'started':
        return sign * (a.startedMs - b.startedMs);
      case 'duration':
        return sign * (a.elapsedMs - b.elapsedMs);
      case 'fuel':
        return sign * (a.totals.fuelBurnedLitres - b.totals.fuelBurnedLitres);
      case 'genset':
        // Then newest posting first inside one machine's chain, so a tag lookup
        // reads as that machine's history rather than as an arbitrary interleave.
        return sign * a.tag.localeCompare(b.tag) || b.startedMs - a.startedMs;
    }
  };

  return [...rows].sort((a, b) => {
    if (sort !== 'genset' && a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
    return compare(a, b);
  });
};

export type DeploymentSummary = {
  total: number;
  ongoing: number;
  completed: number;
  /** Distinct machines with an open posting — what is out, counted once. */
  deployedGensets: number;
  /** Distinct yards holding one, which is not the same number. */
  occupiedSites: number;
  /**
   * Machines fitted at no site at all — the dispatcher's spare capacity.
   *
   * Read off the live fleet rather than counted out of this feed: a set that has
   * never been posted has no row here to be absent from, and "nothing in the depot"
   * and "nothing in the seed" are not the same answer.
   */
  depot: number;
  /** Diesel burned across every posting in the feed, litres. */
  fuelBurnedLitres: number;
  /** Mean length of a *closed* posting, ms — an open one has not finished yet. */
  meanCompletedMs: number;
  byState: Array<FilterOption<DeploymentState>>;
  byCustomer: Array<FilterOption<string>>;
};

const STATE_LABEL: Record<DeploymentState, string> = {
  ongoing: 'Deployed',
  completed: 'Completed',
};

/**
 * The strip's figures, counted over the **whole feed** rather than the filtered
 * view — `estateSummary`'s rule, for its reason: a chip whose own count moved when
 * you clicked it would be a control reporting on itself.
 */
export const deploymentSummary = (rows: Array<DeploymentRow>): DeploymentSummary => {
  const ongoingRows = rows.filter((row) => row.ongoing);
  const completedRows = rows.filter((row) => !row.ongoing);

  const byCustomer = new Map<string, number>();
  for (const row of rows) {
    if (row.customerId === undefined) continue;
    byCustomer.set(row.customerId, (byCustomer.get(row.customerId) ?? 0) + 1);
  }

  return {
    total: rows.length,
    ongoing: ongoingRows.length,
    completed: completedRows.length,
    deployedGensets: new Set(ongoingRows.map((row) => row.deployment.gensetId)).size,
    occupiedSites: new Set(ongoingRows.map((row) => row.deployment.siteId)).size,
    depot: fleet().filter((genset) => genset.siteId === null).length,
    fuelBurnedLitres: rows.reduce((running, row) => running + row.totals.fuelBurnedLitres, 0),
    meanCompletedMs:
      completedRows.length === 0
        ? 0
        : completedRows.reduce((running, row) => running + row.elapsedMs, 0) /
          completedRows.length,
    byState: DEPLOYMENT_STATES.map((state) => ({
      key: state,
      label: STATE_LABEL[state],
      count: state === 'ongoing' ? ongoingRows.length : completedRows.length,
    })),
    byCustomer: [...byCustomer.entries()]
      .map(([id, count]) => ({
        key: id,
        label: customerShortName(id as CustomerId),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
};
