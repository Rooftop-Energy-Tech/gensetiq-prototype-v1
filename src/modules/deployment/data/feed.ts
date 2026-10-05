import type {FilterOption} from '@/components/global/FilterSelect';
import {fleet, gensetById} from '@/modules/genset/data/deployment';
import {stateNameAt, stateSlug} from '@/modules/genset/data/gensetState';
import {gensetLabel} from '@/modules/genset/types/genset.type';
import type {CustomerId} from '@/modules/site/data/customers';
import {siteSeed} from '@/modules/site/data/siteSeed';
import type {Deployment, DeploymentMembership, DeploymentState} from '../types/deployment.type';
import {
  DEPLOYMENT_STATES,
  deploymentElapsedMs,
  deploymentEndMs,
  deploymentState,
} from '../types/deployment.type';
import type {DeploymentSort, DeploymentSortDirection} from '../types/view.type';
import {fuelDeliveredLitres, jobTotals} from './seed';
import type {DeploymentTotals} from './seed';
import {deployments, memberships} from './store';

/**
 * A job, with everything the register draws it against resolved once.
 *
 * The screen's unit of work, and the reason it exists as a type: a job on its own is
 * a site id and two timestamps, and every one of the register's four views wants the
 * same joins off it — the machines on it, the yard's name and coordinates, whose
 * division that yard is in, and what the job cost. Resolving those per view would
 * mean the table, the map, the timeline and the panel each walking the fleet
 * separately, and four chances for a row and a pin to disagree.
 *
 * Built in `SiteSummary`'s image: the site register joins a site to the plant
 * standing on it, and this joins a job to the machines it is a job *of*.
 */
export type DeploymentRow = {
  deployment: Deployment;
  /** The machines on the job, plate order — the column, the pin size and the panel. */
  members: Array<DeploymentMember>;
  state: DeploymentState;
  /**
   * Where the machines stand: the yard's street address, or the placename copied
   * onto the job where there is no seed. Deployments name no site (2026-09-29) —
   * a reader needs where the set is, not the yard's code.
   */
  address: string;
  /** The placename copied onto the job — history survives a site rename. */
  locationLabel: string;
  /**
   * The Malaysian state the yard stands in, read off its position the way a genset's
   * is (`gensetStateName`), and its URL form. `undefined` offshore or with no seed.
   */
  stateName: string | undefined;
  stateSlug: string | undefined;
  /**
   * The yard's division, or `undefined` for a job at a site this dataset no longer
   * declares. No filter reads it today; the State filter uses the yard's position.
   */
  customerId: CustomerId | undefined;
  /** The yard's position, for the map. `undefined` if the seed has gone. */
  latitude: number | undefined;
  longitude: number | undefined;
  /** Milliseconds the job has stood. Zero while it is still planned. */
  elapsedMs: number;
  startedMs: number;
  /** Close, or `now` while open — the timeline's right-hand edge for this bar. */
  endedMs: number;
  /** The agreed end, where there is one, which may be ahead of `now`. */
  agreedEndMs: number | undefined;
  totals: DeploymentTotals;
  /** Litres delivered into the machines while the job stood. */
  fuelDeliveredLitres: number;
};

export type DeploymentMember = {
  membership: DeploymentMembership;
  /** `BRF9540`, or the raw id for a machine the fleet no longer carries. */
  tag: string;
  /**
   * What the register calls the machine — its road plate, `WXQ 4562`, the Gensets
   * page's label — falling back to the tag where a set has none.
   */
  plate: string;
  model: string;
  /** Gone home while the job runs on. */
  collected: boolean;
};

/**
 * One job, joined. The row builder both the register and the job's own page use, so
 * a figure cannot read one way in the list and another on the page it opens.
 */
export const deploymentRow = (
  deployment: Deployment,
  held: ReadonlyArray<DeploymentMembership>,
  now: number,
): DeploymentRow => {
  const seed = siteSeed(deployment.siteId);

  const members = held
    .map((membership) => {
      const genset = gensetById(membership.gensetId);
      return {
        membership,
        tag: genset?.tag ?? membership.gensetId,
        plate: genset === undefined ? membership.gensetId : gensetLabel(genset),
        model: genset?.model ?? '',
        collected: membership.collectedAt !== null,
      };
    })
    .sort((a, b) => a.plate.localeCompare(b.plate));

  // A pin moved off the site wins for everything positional; the division stays the
  // site's, since the deployment was booked through it.
  const pin = deployment.pin;
  const latitude = pin?.latitude ?? seed?.latitude;
  const longitude = pin?.longitude ?? seed?.longitude;
  const stateName =
    latitude === undefined || longitude === undefined
      ? undefined
      : stateNameAt(longitude, latitude);

  return {
    deployment,
    members,
    state: deploymentState(deployment, now),
    address: pin?.address ?? seed?.address ?? deployment.locationLabel,
    locationLabel: deployment.locationLabel,
    stateName,
    stateSlug: stateName === undefined ? undefined : stateSlug(stateName),
    customerId: seed?.customer,
    latitude,
    longitude,
    elapsedMs: deploymentElapsedMs(deployment, now),
    startedMs: new Date(deployment.startsAt).getTime(),
    endedMs: deploymentEndMs(deployment, now),
    agreedEndMs: deployment.endsAt === null ? undefined : new Date(deployment.endsAt).getTime(),
    totals: jobTotals(deployment, held, now),
    fuelDeliveredLitres: fuelDeliveredLitres(deployment, held, now),
  };
};

/**
 * Every job on the record, joined.
 *
 * `now` is passed rather than read, for the reason `deploymentElapsedMs` gives: a
 * screen drawing seventy jobs should measure them all against one clock reading, or
 * two rows a millisecond apart can disagree about the current day.
 */
export const deploymentRows = (now: number): Array<DeploymentRow> => {
  const byJob = new Map<string, Array<DeploymentMembership>>();
  for (const member of memberships()) {
    byJob.set(member.deploymentId, [...(byJob.get(member.deploymentId) ?? []), member]);
  }

  return deployments().map((deployment) =>
    deploymentRow(deployment, byJob.get(deployment.id) ?? [], now),
  );
};

/**
 * Search: the Gensets page's rules — **number plate**, with the spaces ignored on both
 * sides, so `wxq4562` and `WXQ 4562` find the same set — plus the job's reference,
 * since `DEP-0076` is what a job is quoted as. A job matches when any machine on it
 * does.
 */
const compact = (text: string): string => text.toLowerCase().replace(/\s+/g, '');

export const searchDeployments = (
  rows: Array<DeploymentRow>,
  query: string,
): Array<DeploymentRow> => {
  const needle = compact(query);
  if (needle === '') return rows;

  return rows.filter((row) =>
    [row.deployment.reference, ...row.members.map((member) => member.plate)].some((field) =>
      compact(field).includes(needle),
    ),
  );
};

export type DeploymentFilters = {
  /** The job's status — planned, deployed, completed. */
  state: DeploymentState | undefined;
  /** The Malaysian state the yard is in, as a slug — the Gensets page's `location`. */
  location: string | undefined;
  /** The job type's id, on an estate that has them. */
  job: string | undefined;
};

export const filterDeployments = (
  rows: Array<DeploymentRow>,
  {state, location, job}: DeploymentFilters,
): Array<DeploymentRow> =>
  rows.filter((row) => {
    if (state !== undefined && row.state !== state) return false;
    if (location !== undefined && row.stateSlug !== location) return false;
    if (job !== undefined && row.deployment.jobType !== job) return false;
    return true;
  });

/** Where a state sits when the register is ordered by what can still be acted on. */
const STATE_RANK: Record<DeploymentState, number> = {active: 0, planned: 1, completed: 2};

/**
 * Order the register.
 *
 * **Active jobs lead whatever the key is, with what is committed under them**, and
 * that is deliberate rather than an oversight in the comparator. A closed job is a
 * record; an active one is machines standing in somebody's yard right now, and a
 * planned one is a lorry somebody has to book. A sort that let the thirstiest job of
 * last month outrank either would bury the only rows anybody can act on. The key
 * then orders within each group.
 *
 * The one exception is `genset`, which is a lookup rather than a ranking — somebody
 * sorting by machine is looking one up, and splitting its jobs across three blocks
 * would defeat the only reason to ask for that order.
 */
export const sortDeployments = (
  rows: Array<DeploymentRow>,
  sort: DeploymentSort,
  direction: DeploymentSortDirection,
): Array<DeploymentRow> => {
  const sign = direction === 'asc' ? 1 : -1;

  /** A job's machines as one string, so a three-set job sorts somewhere stable. */
  const tags = (row: DeploymentRow) => row.members.map((member) => member.plate).join(' ');

  const compare = (a: DeploymentRow, b: DeploymentRow): number => {
    switch (sort) {
      case 'started':
        return sign * (a.startedMs - b.startedMs);
      case 'duration':
        return sign * (a.elapsedMs - b.elapsedMs);
      case 'fuel':
        return sign * (a.totals.fuelBurnedLitres - b.totals.fuelBurnedLitres);
      case 'reference':
        return sign * a.deployment.reference.localeCompare(b.deployment.reference);
      case 'location':
        // By state name, newest first inside one state; a yard with no state last.
        return (
          sign * (a.stateName ?? '\uffff').localeCompare(b.stateName ?? '\uffff') ||
          b.startedMs - a.startedMs
        );
      case 'genset':
        // Then newest job first inside one machine's set, so a tag lookup reads as
        // that machine's history rather than as an arbitrary interleave.
        return sign * tags(a).localeCompare(tags(b)) || b.startedMs - a.startedMs;
    }
  };

  return [...rows].sort((a, b) => {
    if (sort !== 'genset' && a.state !== b.state) {
      return STATE_RANK[a.state] - STATE_RANK[b.state];
    }
    return compare(a, b);
  });
};

export type DeploymentSummary = {
  total: number;
  planned: number;
  active: number;
  completed: number;
  /** Distinct machines standing on an active job — what is out, counted once. */
  deployedGensets: number;
  /** Distinct yards holding one, which is not the same number. */
  occupiedSites: number;
  /** Machines committed to a job that has not started. */
  committedGensets: number;
  /**
   * Machines on no active job at all — the dispatcher's spare capacity.
   *
   * Read off the live fleet rather than counted out of this register: a set that has
   * never been on a job has no row here to be absent from, and "nothing in the
   * depot" and "nothing in the seed" are not the same answer.
   */
  depot: number;
  /** Diesel burned across every job on the record, litres. */
  fuelBurnedLitres: number;
  /** Mean length of a *closed* job, ms — an open one has not finished yet. */
  meanCompletedMs: number;
  byState: Array<FilterOption<DeploymentState>>;
  /** Jobs per Malaysian state, by slug, A to Z — the State dropdown. */
  byLocation: Array<FilterOption<string>>;
  /** Distinct states holding an active job. */
  occupiedStates: number;
};

const STATE_LABEL: Record<DeploymentState, string> = {
  planned: 'Planned',
  active: 'Deployed',
  completed: 'Completed',
};

export const deploymentStateLabel = (state: DeploymentState): string => STATE_LABEL[state];

/**
 * The strip's figures, counted over the **whole record** rather than the filtered
 * view — `estateSummary`'s rule, for its reason: a chip whose own count moved when
 * you clicked it would be a control reporting on itself.
 */
export const deploymentSummary = (rows: Array<DeploymentRow>): DeploymentSummary => {
  const inState = (state: DeploymentState) => rows.filter((row) => row.state === state);
  const active = inState('active');
  const planned = inState('planned');
  const completed = inState('completed');

  const standing = active.flatMap((row) =>
    row.members.filter((member) => !member.collected).map((member) => member.membership.gensetId),
  );

  const byLocation = new Map<string, {label: string; count: number}>();
  for (const row of rows) {
    if (row.stateSlug === undefined || row.stateName === undefined) continue;
    const entry = byLocation.get(row.stateSlug) ?? {label: row.stateName, count: 0};
    byLocation.set(row.stateSlug, {...entry, count: entry.count + 1});
  }

  return {
    total: rows.length,
    planned: planned.length,
    active: active.length,
    completed: completed.length,
    deployedGensets: new Set(standing).size,
    occupiedSites: new Set(active.map((row) => row.deployment.siteId)).size,
    committedGensets: new Set(
      planned.flatMap((row) => row.members.map((member) => member.membership.gensetId)),
    ).size,
    depot: fleet().filter((genset) => genset.siteId === null).length,
    fuelBurnedLitres: rows.reduce((running, row) => running + row.totals.fuelBurnedLitres, 0),
    meanCompletedMs:
      completed.length === 0
        ? 0
        : completed.reduce((running, row) => running + row.elapsedMs, 0) / completed.length,
    byState: DEPLOYMENT_STATES.map((state) => ({
      key: state,
      label: STATE_LABEL[state],
      count: inState(state).length,
    })),
    byLocation: [...byLocation.entries()]
      .map(([key, {label, count}]) => ({key, label, count}))
      .sort((a, b) => a.label.localeCompare(b.label)),
    occupiedStates: new Set(
      active.map((row) => row.stateSlug).filter((slug) => slug !== undefined),
    ).size,
  };
};
