import {SITE_SEED} from '@/modules/site/data/siteSeed';
import type {DeploymentSession} from '../types/deployment.type';
import {GENSETS} from './fleet';
import {fuelAt, historyStart, meteredBurn, runsInWindow} from './history';
import {spread, spreadBetween} from './spread';

/**
 * Deployment history, in place of the deployment API this prototype doesn't have.
 *
 * The production data model (Helios `DeploymentSession`) is the shape being
 * demonstrated: a genset's life is a chain of postings — dropped at a yard,
 * run, collected, dropped somewhere else — and the posting is the unit the
 * questions are asked of. This seed deals that chain backwards from the
 * machine's present position, under the same three rules as `history.ts`:
 *
 *  1. **The present is a given.** Every genset's *open* posting is at the site
 *     the fleet seed already places it at, started far enough back to contain
 *     recent runs. The dispatch feed and the fleet list cannot disagree about
 *     where a machine stands, because both read the same fact.
 *  2. **Fuel figures come off the ladder.** `startFuelLitres` and
 *     `endFuelLitres` are `fuelAt()` readings at the posting's edges — the same
 *     curve every chart draws — so a posting's fuel arithmetic can be checked
 *     against the tank chart beside it and it will reconcile.
 *  3. **Same generator as everything else.** `spread()` on the genset's id, so
 *     a reload deals the identical history.
 *
 * Prototype caveat, deliberately accepted: attaching or detaching a set in the
 * UI moves the machine (see `./deployment.ts`) but does not rewrite this
 * history — a real backend closes and opens sessions on dispatch, and that
 * write path is exactly what the production model adds.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CLOCK = Date.now();

/**
 * A Sabah lorry plate, stable per posting.
 *
 * Dispatch is a lorry and a driver; the plate is the fact the operations room
 * actually quotes when asked where a machine is mid-move.
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

/**
 * A previous yard for a completed posting — any site other than the ones this
 * chain has already used, so a machine's history walks around the state rather
 * than bouncing between two yards.
 */
const previousSiteId = (gensetId: string, salt: string, exclude: Set<string>): string => {
  const start = Math.floor(spread(gensetId, salt) * SITE_SEED.length);
  for (let step = 0; step < SITE_SEED.length; step += 1) {
    const candidate = SITE_SEED[(start + step) % SITE_SEED.length];
    if (!exclude.has(candidate.id)) return candidate.id;
  }
  return SITE_SEED[start].id;
};

const locationOf = (siteId: string): string =>
  SITE_SEED.find((site) => site.id === siteId)?.locationLabel ?? 'Unknown';

/**
 * Deal one genset's chain: the open posting at its current yard, then completed
 * postings walking backwards until the run log's horizon is reached.
 *
 * Postings are 8–18 days with 1.5–4 day depot gaps between them — the cadence
 * of temporary supply, where a set is dropped for a job measured in weeks. The
 * horizon guard means every posting's window lies inside the 60 days the run
 * log covers, so the per-posting totals below never read runs that don't exist.
 */
const dealChain = (gensetId: string, currentSiteId: string): Array<DeploymentSession> => {
  const chain: Array<DeploymentSession> = [];
  const used = new Set<string>([currentSiteId]);
  const horizon = historyStart() + 2 * DAY;

  const openDays = spreadBetween(gensetId, 'deploy/open-days', 4, 26);
  const openStart = CLOCK - openDays * DAY;

  chain.push({
    id: `${gensetId}-dep-0`,
    gensetId,
    siteId: currentSiteId,
    locationLabel: locationOf(currentSiteId),
    lorryPlate: lorryPlate(gensetId, 'dep-0'),
    startedAt: new Date(openStart).toISOString(),
    endedAt: null,
    startFuelLitres: Math.round(fuelAt(gensetId, openStart)),
    endFuelLitres: null,
  });

  let cursor = openStart;
  for (let k = 1; k <= 3; k += 1) {
    const gapDays = spreadBetween(gensetId, `deploy/gap-${k}`, 1.5, 4);
    const end = cursor - gapDays * DAY;
    const lengthDays = spreadBetween(gensetId, `deploy/len-${k}`, 8, 18);
    const start = end - lengthDays * DAY;
    if (start < horizon) break;

    const siteId = previousSiteId(gensetId, `deploy/site-${k}`, used);
    used.add(siteId);

    chain.push({
      id: `${gensetId}-dep-${k}`,
      gensetId,
      siteId,
      locationLabel: locationOf(siteId),
      lorryPlate: lorryPlate(gensetId, `dep-${k}`),
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(end).toISOString(),
      startFuelLitres: Math.round(fuelAt(gensetId, start)),
      endFuelLitres: Math.round(fuelAt(gensetId, end)),
    });

    cursor = start;
  }

  return chain;
};

const DEPLOYMENTS: Record<string, Array<DeploymentSession>> = Object.fromEntries(
  GENSETS.map((genset) => [
    genset.id,
    genset.siteId === null ? [] : dealChain(genset.id, genset.siteId),
  ]),
);

/** One genset's postings, newest first, the open one at the head. */
export const gensetDeployments = (gensetId: string): Array<DeploymentSession> =>
  DEPLOYMENTS[gensetId] ?? [];

/** The posting a genset is on right now, or `undefined` in the depot. */
export const openDeployment = (gensetId: string): DeploymentSession | undefined => {
  const head = gensetDeployments(gensetId)[0];
  return head !== undefined && head.endedAt === null ? head : undefined;
};

/**
 * Every posting in the fleet, ongoing first (newest start first), then
 * completed (newest close first) — the dispatch feed's order.
 */
export const allDeployments = (): Array<DeploymentSession> => {
  const all = Object.values(DEPLOYMENTS).flat();
  const ongoing = all
    .filter((deployment) => deployment.endedAt === null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const completed = all
    .filter((deployment) => deployment.endedAt !== null)
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));
  return [...ongoing, ...completed];
};

export type DeploymentTotals = {
  /** Hours the engine actually turned inside the posting. */
  runtimeHours: number;
  /** Energy delivered across the posting, kWh. */
  energyKwh: number;
  /** Diesel burned across the posting, litres. */
  fuelBurnedLitres: number;
  /** Starts inside the posting. */
  starts: number;
};

/**
 * What a posting cost, read off the run log — not stored, so the figures here
 * are the same runs the Runs tab lists, clipped to the posting's window.
 */
export const deploymentTotals = (deployment: DeploymentSession): DeploymentTotals => {
  const from = new Date(deployment.startedAt).getTime();
  const to = deployment.endedAt === null ? CLOCK : new Date(deployment.endedAt).getTime();

  const runs = runsInWindow(deployment.gensetId, from, to);
  let runtimeMs = 0;
  // Energy is the runs' own figures, prorated by how much of each run the
  // posting's window actually contains — not derived back from fuel, which
  // would undo the load-dependent SFC and make a posting disagree with the
  // very runs it is made of.
  let energyKwh = 0;
  for (const run of runs) {
    const startMs = new Date(run.startedAt).getTime();
    const endMs = run.endedAt === null ? CLOCK : new Date(run.endedAt).getTime();
    const clippedMs = Math.max(0, Math.min(endMs, to) - Math.max(startMs, from));
    runtimeMs += clippedMs;
    if (endMs > startMs) energyKwh += run.energyProducedKwh * (clippedMs / (endMs - startMs));
  }

  const fuelBurnedLitres = meteredBurn(deployment.gensetId, from, to);

  return {
    runtimeHours: runtimeMs / HOUR,
    energyKwh,
    fuelBurnedLitres,
    starts: runs.length,
  };
};
