import {GENSETS} from '@/modules/genset/data/fleet';
import {
  fuelAt,
  historyStart,
  meteredBurn,
  refuelsIn,
  runsInWindow,
} from '@/modules/genset/data/history';
import {spread, spreadBetween} from '@/modules/genset/data/spread';
import {siteSeeds} from '@/modules/site/data/siteSeed';
import type {
  Deployment,
  DeploymentMembership,
  GensetPosting,
} from '../types/deployment.type';
import {postingEnd, windowsOverlap} from '../types/deployment.type';

/**
 * Deployment history, in place of the deployment API this prototype doesn't have.
 *
 * The chain used to be dealt **per machine**, backwards from wherever the fleet seed
 * put it. It is dealt **per yard** now, because the job is the record and a job has
 * more than one machine on it. Four rules, and the first is the one that matters:
 *
 *  1. **The present is a given, by construction.** Every occupied yard gets exactly
 *     one active job, and its members are exactly the machines `fleet.ts` already
 *     places there. So the register, the fleet list and the site pages cannot
 *     disagree about where anything stands: all three read the same grouping the
 *     fleet seed always had. Nothing here re-decides the present.
 *  2. **Fuel figures come off the ladder.** Each membership's `startFuelLitres` and
 *     `endFuelLitres` are `fuelAt()` readings at the job's edges — the same curve
 *     every chart draws — so a job's fuel arithmetic reconciles with the tank chart
 *     beside it.
 *  3. **Same generator as everything else.** `spread()` on the yard's id for the
 *     job, on the machine's id for its plate, so a reload deals the identical
 *     history.
 *  4. **No machine is ever double-booked.** Completed and planned jobs draw their
 *     members through `windowsOverlap`, so the invariant the store enforces on a
 *     write is one the seed cannot have broken before the reader arrives.
 *
 * An **active job carries an agreed end** where it has one, which is what makes a
 * planned job possible at all: a machine whose current job runs to infinity can
 * never be committed to a later one, and on a hire fleet most jobs are quoted to a
 * date. A handful are left open-ended, and those machines are genuinely
 * uncommittable until somebody closes them. That is the model telling the truth
 * rather than the seed being uneven.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CLOCK = Date.now();

/**
 * A Sabah lorry plate, stable per machine per job.
 *
 * Dispatch is a lorry and a driver; the plate is the fact the operations room
 * actually quotes when asked where a machine is mid-move. On the job it belongs to
 * the membership, because three sets on one job arrive on three lorries.
 */
const lorryPlate = (gensetId: string, salt: string): string => {
  const series = ['SAA', 'SAB', 'SAC', 'SD', 'SK', 'ST', 'SS'];
  const prefix = series[Math.floor(spread(gensetId, `${salt}/plate-series`) * series.length)];
  const digits = 1000 + Math.floor(spread(gensetId, `${salt}/plate-digits`) * 9000);
  const suffix = String.fromCodePoint(
    65 + Math.floor(spread(gensetId, `${salt}/plate-suffix`) * 26),
  );
  return `${prefix} ${digits} ${suffix}`;
};

const locationOf = (siteId: string): string =>
  siteSeeds().find((site) => site.id === siteId)?.locationLabel ?? 'Unknown';

/** Where the fleet seed stands each machine, grouped by yard. */
const seededOccupancy = (): Map<string, Array<string>> => {
  const byYard = new Map<string, Array<string>>();
  for (const genset of GENSETS) {
    if (genset.siteId === null) continue;
    const members = byYard.get(genset.siteId) ?? [];
    members.push(genset.id);
    byYard.set(genset.siteId, members);
  }
  return byYard;
};

const membership = (
  deploymentId: string,
  gensetId: string,
  salt: string,
  startMs: number,
  endMs: number | null,
): DeploymentMembership => ({
  id: `${deploymentId}:${gensetId}`,
  deploymentId,
  gensetId,
  lorryPlate: lorryPlate(gensetId, salt),
  startFuelLitres: Math.round(fuelAt(gensetId, startMs)),
  endFuelLitres: endMs === null ? null : Math.round(fuelAt(gensetId, endMs)),
  // The seed never collects a machine early: every membership it deals stands for
  // the whole of its job. Early collection is something a reader does.
  collectedAt: null,
});

type Dealt = {
  deployments: Array<Deployment>;
  memberships: Array<DeploymentMembership>;
};

/**
 * Deal the whole record: the present, then backwards, then forwards.
 *
 * One pass rather than three independent ones, because the later two have to see
 * what the earlier ones committed — which is the only way rule 4 holds.
 */
const deal = (): Dealt => {
  const deployments: Array<Deployment> = [];
  const memberships: Array<DeploymentMembership> = [];

  /** Every window a machine is already on, so nothing gets double-booked. */
  const committed = new Map<string, Array<Deployment>>();

  const commit = (deployment: Deployment, gensetIds: Array<string>, salt: string) => {
    const startMs = new Date(deployment.startsAt).getTime();
    const endMs = deployment.endsAt === null ? null : new Date(deployment.endsAt).getTime();

    deployments.push(deployment);
    for (const gensetId of gensetIds) {
      // A membership on a job that has not closed has no end reading yet, and one on
      // a job still standing has none either: the level is telemetry until the
      // machine is collected.
      const closed = endMs !== null && endMs <= CLOCK;
      memberships.push(membership(deployment.id, gensetId, salt, startMs, closed ? endMs : null));
      committed.set(gensetId, [...(committed.get(gensetId) ?? []), deployment]);
    }
  };

  const free = (gensetId: string, candidate: Deployment): boolean =>
    (committed.get(gensetId) ?? []).every((held) => !windowsOverlap(held, candidate));

  const occupancy = seededOccupancy();
  const yards = [...occupancy.keys()].sort();

  // 1. The present. One job per occupied yard, holding exactly what stands there.
  for (const siteId of yards) {
    const members = (occupancy.get(siteId) ?? []).slice().sort();
    const openDays = spreadBetween(siteId, 'job/open-days', 4, 26);
    const startsAt = CLOCK - openDays * DAY;

    // Four yards in five are quoted to a date, and the rest are open-ended. The
    // agreed end sits 6–40 days ahead of the start, so some are nearly up and some
    // have weeks to run.
    const agreed = spread(siteId, 'job/agreed') > 0.2;
    const runDays = spreadBetween(siteId, 'job/run-days', 6, 40);
    const endsAt = agreed ? startsAt + Math.max(openDays + 2, runDays) * DAY : null;

    commit(
      {
        id: `${siteId}-job-0`,
        reference: '',
        siteId,
        locationLabel: locationOf(siteId),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt === null ? null : new Date(endsAt).toISOString(),
      },
      members,
      `${siteId}-job-0`,
    );
  }

  // 2. The record. Walk each yard backwards, 8–18 day jobs with 1.5–4 day gaps
  //    between them, stopping at the run log's horizon so a job's totals can never
  //    read runs that do not exist.
  const horizon = historyStart() + 2 * DAY;

  for (const siteId of yards) {
    let cursor = CLOCK - spreadBetween(siteId, 'job/open-days', 4, 26) * DAY;

    for (let k = 1; k <= 3; k += 1) {
      const gapDays = spreadBetween(siteId, `job/gap-${k}`, 1.5, 4);
      const end = cursor - gapDays * DAY;
      const lengthDays = spreadBetween(siteId, `job/len-${k}`, 8, 18);
      const start = end - lengthDays * DAY;
      if (start < horizon) break;

      const candidate: Deployment = {
        id: `${siteId}-job-${k}`,
        reference: '',
        siteId,
        locationLabel: locationOf(siteId),
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
      };

      // One to three machines, drawn from the whole fleet by hash and skipped where
      // they were already somewhere else in this window. Past jobs are dealt across
      // the fleet rather than from the yard's present occupants, because a hire
      // fleet's machines move: a yard that has two sets today had different ones in
      // July.
      const wanted = 1 + Math.floor(spread(`${siteId}-${k}`, 'job/size') * 3);
      const offset = Math.floor(spread(`${siteId}-${k}`, 'job/pick') * GENSETS.length);
      const picked: Array<string> = [];
      for (let step = 0; step < GENSETS.length && picked.length < wanted; step += 1) {
        const genset = GENSETS[(offset + step) % GENSETS.length]!;
        if (free(genset.id, candidate)) picked.push(genset.id);
      }

      if (picked.length > 0) commit(candidate, picked, candidate.id);
      cursor = start;
    }
  }

  // 3. What is committed. Four planned jobs, 2–20 days out, at yards drawn by hash.
  //    These are the only records with nothing to measure, and they are the whole
  //    reason the timeline has a right-hand side.
  const seeds = siteSeeds();
  for (let k = 0; k < 4; k += 1) {
    const salt = `planned-${k}`;
    const site = seeds[Math.floor(spread(salt, 'job/site') * seeds.length)];
    if (site === undefined) continue;

    const start = CLOCK + spreadBetween(salt, 'job/lead', 2, 20) * DAY;
    const end = start + spreadBetween(salt, 'job/len', 8, 18) * DAY;

    const candidate: Deployment = {
      id: `planned-job-${k}`,
      reference: '',
      siteId: site.id,
      locationLabel: site.locationLabel,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    };

    const wanted = 1 + Math.floor(spread(salt, 'job/size') * 3);
    const offset = Math.floor(spread(salt, 'job/pick') * GENSETS.length);
    const picked: Array<string> = [];
    for (let step = 0; step < GENSETS.length && picked.length < wanted; step += 1) {
      const genset = GENSETS[(offset + step) % GENSETS.length]!;
      if (free(genset.id, candidate)) picked.push(genset.id);
    }

    if (picked.length > 0) commit(candidate, picked, candidate.id);
  }

  // References last, oldest job first, so `DEP-0001` is the earliest thing on the
  // record and the numbers read as a register rather than as hashes.
  const ordered = [...deployments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const references = new Map(
    ordered.map((deployment, index) => [
      deployment.id,
      `DEP-${String(index + 1).padStart(4, '0')}`,
    ]),
  );

  return {
    deployments: deployments.map((deployment) => ({
      ...deployment,
      reference: references.get(deployment.id) ?? deployment.id,
    })),
    memberships,
  };
};

/**
 * Dealt on first access rather than at import time, and that is load-bearing.
 *
 * The deal reads the fuel ladder, the ladder is derived from each machine's detail,
 * and a machine's detail reads the *deployed* fleet, which reads this record. That
 * circle is fine as a set of imports and fatal as an order of execution: dealing at
 * import time would call into `history.ts` while `detail.ts` was still being
 * initialised. Nothing here runs until a screen asks a question, by which point
 * every module is up.
 */
let dealt: Dealt | undefined;

const record = (): Dealt => (dealt ??= deal());

/** The seeded record. The store layers a reader's own jobs over this. */
export const seededDeployments = (): ReadonlyArray<Deployment> => record().deployments;

export const seededMemberships = (): ReadonlyArray<DeploymentMembership> =>
  record().memberships;

export type DeploymentTotals = {
  /** Hours the engine actually turned inside the window. */
  runtimeHours: number;
  /** Energy delivered across the window, kWh. */
  energyKwh: number;
  /** Diesel burned across the window, litres. */
  fuelBurnedLitres: number;
  /** Starts inside the window. */
  starts: number;
};

export const EMPTY_TOTALS: DeploymentTotals = {
  runtimeHours: 0,
  energyKwh: 0,
  fuelBurnedLitres: 0,
  starts: 0,
};

/**
 * What one machine did inside a window, read off the run log.
 *
 * Not stored, so the figures are the same runs the Runs tab lists, clipped to the
 * window. **Measured to `now` and never to an agreed end**: an active job quoted to
 * the 30th has produced nothing for the days it has not yet stood, and projecting
 * it would be the app inventing energy.
 */
export const gensetTotalsIn = (
  gensetId: string,
  fromMs: number,
  toMs: number,
  now: number,
): DeploymentTotals => {
  const from = fromMs;
  const to = Math.min(toMs, now);
  if (to <= from) return EMPTY_TOTALS;

  const runs = runsInWindow(gensetId, from, to);
  let runtimeMs = 0;
  // Energy is the runs' own figures, prorated by how much of each run the window
  // actually contains — not derived back from fuel, which would undo the
  // load-dependent SFC and make a job disagree with the very runs it is made of.
  let energyKwh = 0;
  for (const run of runs) {
    const startMs = new Date(run.startedAt).getTime();
    const endMs = run.endedAt === null ? now : new Date(run.endedAt).getTime();
    const clippedMs = Math.max(0, Math.min(endMs, to) - Math.max(startMs, from));
    runtimeMs += clippedMs;
    if (endMs > startMs) energyKwh += run.energyProducedKwh * (clippedMs / (endMs - startMs));
  }

  return {
    runtimeHours: runtimeMs / HOUR,
    energyKwh,
    fuelBurnedLitres: meteredBurn(gensetId, from, to),
    starts: runs.length,
  };
};

export const addTotals = (left: DeploymentTotals, right: DeploymentTotals): DeploymentTotals => ({
  runtimeHours: left.runtimeHours + right.runtimeHours,
  energyKwh: left.energyKwh + right.energyKwh,
  fuelBurnedLitres: left.fuelBurnedLitres + right.fuelBurnedLitres,
  starts: left.starts + right.starts,
});

/**
 * What one machine's posting cost, over the days that machine was actually there.
 *
 * An early collection ends the window, which is what `collectedAt` is for: a set
 * pulled out on day nine of a fortnight did not burn the last five days' diesel.
 */
export const postingTotals = (posting: GensetPosting, now: number): DeploymentTotals => {
  const from = new Date(posting.deployment.startsAt).getTime();
  const end = postingEnd(posting);
  const to = end === null ? now : new Date(end).getTime();
  return gensetTotalsIn(posting.membership.gensetId, from, to, now);
};

/** What a job cost: its members' postings, summed. */
export const jobTotals = (
  deployment: Deployment,
  members: ReadonlyArray<DeploymentMembership>,
  now: number,
): DeploymentTotals => {
  const from = new Date(deployment.startsAt).getTime();
  const to = deployment.endsAt === null ? now : new Date(deployment.endsAt).getTime();

  return members.reduce((running, member) => {
    // Each machine's own end, so a set collected on day nine contributes nine days.
    const memberTo = member.collectedAt === null ? to : new Date(member.collectedAt).getTime();
    return addTotals(running, gensetTotalsIn(member.gensetId, from, Math.min(memberTo, to), now));
  }, EMPTY_TOTALS);
};

/**
 * Litres delivered into the machines on a job while it stood.
 *
 * The deliveries the fuel ladder already places, summed over the members and
 * clipped to the window — the same step-ups the tank chart draws, so "litres in"
 * beside "litres burned" is two readings of one curve rather than two sources.
 * The opening tank level is **not** a delivery and is not counted here: a set
 * arriving three-quarters full arrived that way.
 */
export const fuelDeliveredLitres = (
  deployment: Deployment,
  members: ReadonlyArray<DeploymentMembership>,
  now: number,
): number => {
  const from = new Date(deployment.startsAt).getTime();
  const to = Math.min(
    deployment.endsAt === null ? now : new Date(deployment.endsAt).getTime(),
    now,
  );
  if (to <= from) return 0;

  return members.reduce(
    (running, member) =>
      running +
      refuelsIn(member.gensetId, from, to).reduce((litres, refuel) => litres + refuel.litres, 0),
    0,
  );
};
