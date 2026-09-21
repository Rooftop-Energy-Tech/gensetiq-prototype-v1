import {useSyncExternalStore} from 'react';

import {siteSeed} from '@/modules/site/data/siteSeed';
import type {
  Deployment,
  DeploymentMembership,
  GensetPosting,
} from '../types/deployment.type';
import {deploymentState, windowsOverlap} from '../types/deployment.type';
import {seededDeployments, seededMemberships} from './seed';

/**
 * The jobs, and everything a reader has done to them.
 *
 * ## Why this is the store and `genset/data/deployment.ts` is not
 *
 * It used to be the other way round: the store held `gensetId → siteId` and a
 * deployment was history somebody else had written. That is backwards, and it was the
 * gap this change closes — a machine is at a yard **because a job put it there**, so
 * the job is the thing a reader writes and the machine's site is read off it. The
 * fleet module now derives placement from this store and holds nothing of its own.
 *
 * ## Why only the differences are stored
 *
 * A job with no entry here **is** its seed, which is what makes "has anybody
 * rearranged this fleet" answerable, what makes clearing site data a `removeItem`
 * rather than a re-seed, and what means adding a yard to a dataset needs no
 * migration in this file. The same argument `site/data/siteOverrides.ts` makes, and
 * for the same reasons.
 *
 * ## What it is worth, and what it isn't
 *
 * `useSyncExternalStore` over `localStorage`, with the read guarded because Safari
 * in private mode *throws* on access rather than returning null, which would take
 * the app down at import time. It does not sync, and a colleague opening the same
 * job sees the dataset's own record.
 *
 * ## The one invariant, and where it is enforced
 *
 * **A machine may not be on two jobs whose windows overlap.** It is checked on every
 * write and the refusal names the job in the way — deriving "the active one" by
 * picking a winner from overlapping records would make the invariant a rendering
 * convention rather than a rule, and the two screens that picked differently would
 * then disagree about where a machine is.
 */

const STORAGE_KEY = 'gensetiq.deployments';

/**
 * The key the placement store used, cleared on first read.
 *
 * Not migrated, deliberately. A placement map says "this machine is here" with no
 * window, and the window is the thing this model is about; translating one would
 * mean inventing a start date, which is the exact fabrication the model exists to
 * stop. It is browser-local demo state, so the cost is one demo's worth of
 * attaching.
 */
const LEGACY_PLACEMENT_KEY = 'gensetiq.deployment';

type Patch = {
  /** Jobs the reader opened, in full. */
  created: Array<Deployment>;
  /** Fields changed on a seeded or created job. */
  edited: Record<string, Partial<Deployment>>;
  /** Jobs the reader deleted. Seeded ones are hidden rather than removed. */
  deleted: Array<string>;
  /** Machines the reader put on a job. */
  added: Array<DeploymentMembership>;
  /** Machines the reader took off, by membership id. */
  collected: Record<string, {collectedAt: string; endFuelLitres: number | null}>;
  /** Memberships dropped outright, which is what un-committing a planned job is. */
  dropped: Array<string>;
};

const EMPTY: Patch = {
  created: [],
  edited: {},
  deleted: [],
  added: [],
  collected: {},
  dropped: [],
};

const listeners = new Set<() => void>();

const read = (): Patch => {
  try {
    localStorage.removeItem(LEGACY_PLACEMENT_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY;
    return {...EMPTY, ...(JSON.parse(raw) as Partial<Patch>)};
  } catch {
    // Private mode, or a value written in some earlier shape. The seeded record is
    // a complete, correct answer and not worth taking the page down for.
    return EMPTY;
  }
};

let patch: Patch = read();

type Snapshot = {
  deployments: Array<Deployment>;
  memberships: Array<DeploymentMembership>;
};

/**
 * The record with the patch applied — the list every screen should read.
 *
 * Rebuilt only when the store changes, never per read, for the reason the fleet's
 * own rebuild is cheap: nothing downstream of this keys off anything but ids.
 */
const applyPatch = (state: Patch): Snapshot => {
  const deleted = new Set(state.deleted);
  const dropped = new Set(state.dropped);

  const deployments = [...seededDeployments(), ...state.created]
    .filter((deployment) => !deleted.has(deployment.id))
    .map((deployment) => {
      const edit = state.edited[deployment.id];
      return edit === undefined ? deployment : {...deployment, ...edit};
    });

  const live = new Set(deployments.map((deployment) => deployment.id));

  const memberships = [...seededMemberships(), ...state.added]
    .filter((member) => live.has(member.deploymentId) && !dropped.has(member.id))
    .map((member) => {
      const close = state.collected[member.id];
      return close === undefined
        ? member
        : {...member, collectedAt: close.collectedAt, endFuelLitres: close.endFuelLitres};
    });

  return {deployments, memberships};
};

/**
 * Built on first read, for the reason `seed.ts` gives: the deal behind it cannot run
 * at import time without walking into a half-initialised `detail.ts`.
 */
let snapshot: Snapshot | undefined;

const current = (): Snapshot => (snapshot ??= applyPatch(patch));

const emit = () => {
  patch = read();
  snapshot = applyPatch(patch);
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const write = (next: Patch) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode: the change just won't survive a reload. */
  }
  // Written through `read()` by `emit`, so a store that could not persist still
  // shows the reader what they did for the rest of the session.
  patch = next;
  snapshot = applyPatch(next);
  for (const listener of listeners) listener();
};

/* ------------------------------------------------------------------ reading */

/** Every job on the record. */
export const deployments = (): Array<Deployment> => current().deployments;

/** Every membership on the record. */
export const memberships = (): Array<DeploymentMembership> => current().memberships;

export const subscribeDeployments = (listener: () => void) => subscribe(listener);

/** The record, live. */
export const useDeployments = (): Snapshot =>
  useSyncExternalStore(subscribe, current, current);

export const deploymentById = (id: string): Deployment | undefined =>
  current().deployments.find((deployment) => deployment.id === id);

/** The machines on a job, tag order settled by the caller that has the fleet. */
export const deploymentMembers = (deploymentId: string): Array<DeploymentMembership> =>
  current().memberships.filter((member) => member.deploymentId === deploymentId);

/**
 * Every job that has stood at one yard, newest first.
 *
 * This is what makes "have we had a set at Kapit before" answerable on the site's
 * own pages, which is the question asked before quoting one.
 */
export const deploymentsAtSite = (siteId: string): Array<Deployment> =>
  current().deployments
    .filter((deployment) => deployment.siteId === siteId)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

/**
 * One machine's postings, newest first.
 *
 * The join the genset side of the app reads: a machine's log, its runs picker and
 * its analysis picker all ask "what has this set been on", and the answer is its
 * memberships with the jobs they belong to.
 */
export const gensetPostings = (gensetId: string): Array<GensetPosting> => {
  const byId = new Map(current().deployments.map((deployment) => [deployment.id, deployment]));

  return current().memberships
    .filter((member) => member.gensetId === gensetId)
    .flatMap((membership) => {
      const deployment = byId.get(membership.deploymentId);
      return deployment === undefined ? [] : [{deployment, membership}];
    })
    .sort((a, b) => b.deployment.startsAt.localeCompare(a.deployment.startsAt));
};

/**
 * Where a machine is standing now, or `undefined` if it is in the depot.
 *
 * The posting has to be on an **active** job and not yet collected: a planned job is
 * a commitment and moves nothing, and a collected machine has gone home while the
 * job it was on runs on without it.
 */
export const activePosting = (gensetId: string, now: number): GensetPosting | undefined =>
  gensetPostings(gensetId).find(
    (posting) =>
      posting.membership.collectedAt === null &&
      deploymentState(posting.deployment, now) === 'active',
  );

/** The jobs a machine is committed to that have not started yet, soonest first. */
export const plannedPostings = (gensetId: string, now: number): Array<GensetPosting> =>
  gensetPostings(gensetId)
    .filter((posting) => deploymentState(posting.deployment, now) === 'planned')
    .sort((a, b) => a.deployment.startsAt.localeCompare(b.deployment.startsAt));

/**
 * The job in the way of putting this machine on that one, if there is one.
 *
 * Returned rather than a boolean, because the refusal has to name it: "already out"
 * is not an answer a reader can act on, and "on DEP-0117 at Kapit until the 14th"
 * is. A machine already on the candidate job is not a conflict with itself.
 */
export const conflictFor = (gensetId: string, candidate: Deployment): Deployment | undefined => {
  const held = gensetPostings(gensetId);
  return held.find(
    (posting) =>
      posting.deployment.id !== candidate.id &&
      posting.membership.collectedAt === null &&
      windowsOverlap(posting.deployment, candidate),
  )?.deployment;
};

/* ------------------------------------------------------------------ writing */

const nowIso = () => new Date().toISOString();

/**
 * The next reference in the register's own series.
 *
 * Highest seeded number plus one, so a reader's job reads as the next one in the
 * book rather than as `DEP-LOCAL-3`.
 */
const nextReference = (): string => {
  const numbers = current().deployments
    .map((deployment) => Number.parseInt(deployment.reference.replace(/\D/g, ''), 10))
    .filter((value) => Number.isFinite(value));
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `DEP-${String(next).padStart(4, '0')}`;
};

export type OpenJob = {
  siteId: string;
  /** ISO 8601. A start in the future opens the job as `planned`. */
  startsAt: string;
  /** ISO 8601, or `null` for a job with no agreed end. */
  endsAt: string | null;
  reference?: string;
};

/**
 * Open a job at a yard, with no machines on it yet.
 *
 * Two steps rather than one call taking a machine list, because that is how a reader
 * does it: the job is agreed with a customer, and the sets are found afterwards. It
 * also means the conflict check has a real job to check against.
 */
export const createDeployment = (job: OpenJob): Deployment => {
  const seed = siteSeed(job.siteId);

  const deployment: Deployment = {
    id: `local-job-${Date.now()}`,
    reference: job.reference ?? nextReference(),
    siteId: job.siteId,
    locationLabel: seed?.locationLabel ?? 'Unknown',
    startsAt: job.startsAt,
    endsAt: job.endsAt,
  };

  write({...patch, created: [...patch.created, deployment]});
  return deployment;
};

/** Change a job's reference, yard or window. */
export const updateDeployment = (id: string, edit: Partial<Deployment>) => {
  const deployment = deploymentById(id);
  if (deployment === undefined) return;

  // The placename travels with the yard, because it is copied at the time rather
  // than read from the site: a job moved to another yard is a job at that yard.
  const withLocation =
    edit.siteId === undefined
      ? edit
      : {...edit, locationLabel: siteSeed(edit.siteId)?.locationLabel ?? deployment.locationLabel};

  write({
    ...patch,
    edited: {...patch.edited, [id]: {...patch.edited[id], ...withLocation}},
  });
};

export type PutResult = {ok: true} | {ok: false; conflict: Deployment};

/**
 * Put a machine on a job.
 *
 * Refused where the machine is committed elsewhere in that window, and the refusal
 * carries the job in the way so the caller can say which one. The candidate picker
 * filters by the same predicate, so this is the backstop rather than the
 * interaction.
 */
export const addGenset = (deploymentId: string, gensetId: string): PutResult => {
  const deployment = deploymentById(deploymentId);
  if (deployment === undefined) return {ok: true};

  const conflict = conflictFor(gensetId, deployment);
  if (conflict !== undefined) return {ok: false, conflict};

  const id = `${deploymentId}:${gensetId}`;
  if (current().memberships.some((member) => member.id === id)) return {ok: true};

  const membership: DeploymentMembership = {
    id,
    deploymentId,
    gensetId,
    lorryPlate: 'TBD',
    // A machine put on a job by hand has no metered arrival, so the tank reads zero
    // until the set actually turns up. Inventing a level here would put a figure on
    // the fuel ledger that no instrument produced.
    startFuelLitres: 0,
    endFuelLitres: null,
    collectedAt: null,
  };

  write({
    ...patch,
    added: [...patch.added, membership],
    dropped: patch.dropped.filter((dropped) => dropped !== id),
    collected: Object.fromEntries(
      Object.entries(patch.collected).filter(([key]) => key !== id),
    ),
  });
  return {ok: true};
};

/**
 * Take a machine off a job.
 *
 * On an **active** job that is a collection: the membership closes at `now`, the
 * machine leaves the yard, and its recorded position does not change, because it is
 * standing there until somebody physically moves it. On a **planned** job there is
 * nothing to collect, so the commitment is simply released and the membership goes.
 */
export const collectGenset = (membershipId: string, endFuelLitres: number | null = null) => {
  const membership = current().memberships.find((member) => member.id === membershipId);
  if (membership === undefined) return;

  const deployment = deploymentById(membership.deploymentId);
  const state = deployment === undefined ? 'completed' : deploymentState(deployment, Date.now());

  if (state === 'planned') {
    write({...patch, dropped: [...patch.dropped, membershipId]});
    return;
  }

  write({
    ...patch,
    collected: {
      ...patch.collected,
      [membershipId]: {collectedAt: nowIso(), endFuelLitres},
    },
  });
};

/**
 * Close a job now.
 *
 * Every machine still on it leaves the yard, which is what closing means: the job is
 * over and the sets are collected. Their memberships are *not* closed early — they
 * stood for the whole of the job, and the job's own end is now.
 */
export const closeDeployment = (id: string) => {
  const deployment = deploymentById(id);
  if (deployment === undefined) return;

  write({
    ...patch,
    edited: {...patch.edited, [id]: {...patch.edited[id], endsAt: nowIso()}},
  });
};

/**
 * Delete a job outright, with its memberships.
 *
 * For a planned job this is the honest undo: the commitment never happened, so there
 * is nothing to keep. A seeded job is hidden rather than removed, which is what lets
 * clearing site data put the whole record back.
 */
export const deleteDeployment = (id: string) => {
  const members = deploymentMembers(id).map((member) => member.id);

  write({
    ...patch,
    deleted: [...patch.deleted, id],
    created: patch.created.filter((deployment) => deployment.id !== id),
    added: patch.added.filter((member) => member.deploymentId !== id),
    dropped: [...patch.dropped, ...members],
  });
};

/** Put the whole record back to its seed. Used by Settings' reset. */
export const resetDeployments = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Private mode: nothing was stored to remove. */
  }
  emit();
};
