import {DATASET} from '@/brands';
import {deployments, memberships, subscribeDeployments} from '@/modules/deployment/data/store';
import {GENSETS} from '@/modules/genset/data/fleet';
import {refuelsIn} from '@/modules/genset/data/history';
import {depotFor} from './depots';

/**
 * Every fill a genset took, and **which depot supplied it**.
 *
 * ## The rule
 *
 * The depot nearest where the genset stood at the moment of the fill, by distance
 * (`depotFor`). Every fill is charged to exactly one depot, whether the machine was
 * filled in the yard or out at its posting — the fleet moves between jobs, so a set
 * supplied by Klang in August can be supplied by Pasir Gudang in September.
 *
 * Between postings a machine is where the seed keeps it, so the nearest depot to that.
 *
 * ## Why there is no route any more
 *
 * Until 2026-10-05 each fill had a route: a *yard* fill at a depot, or a *truck* fill
 * at the posting, with the truck that covered the posting's state (Jeff,
 * 2026-09-29). Trucks were removed (Jeff, 2026-10-05). Whatever carries the fuel
 * from depot to genset is now one pipe the app does not track, and the depot is
 * reconciled against what arrived in the gensets it supplied — see `depotTank.ts`.
 */

export type GensetFill = {
  id: string;
  gensetId: string;
  at: number;
  /** What the genset's own level sensor saw arrive. */
  litres: number;
  /** Where the machine was posted at that instant, in words. */
  place: string;
  latitude: number;
  longitude: number;
  /** The depot this fill is charged to: the nearest to where the genset stood. */
  depotId: string;
};

type Posting = {
  gensetId: string;
  startMs: number;
  endMs: number;
  place: string;
  latitude: number | undefined;
  longitude: number | undefined;
};

/** Every posting, flattened once. The per-fill lookup is then a scan of one machine's. */
const buildPostings = (): Map<string, Array<Posting>> => {
  // The store's record, edits and all, not the seed's: a job created, moved, ended
  // or deleted on the Deployments pages moves the fills it covers with it.
  const byId = new Map(deployments().map((d) => [d.id, d]));
  const sites = new Map(DATASET.sites.map((site) => [site.id, site]));
  const byGenset = new Map<string, Array<Posting>>();

  for (const member of memberships()) {
    const deployment = byId.get(member.deploymentId);
    if (deployment === undefined) continue;

    const site = sites.get(deployment.siteId);
    const posting: Posting = {
      gensetId: member.gensetId,
      startMs: new Date(deployment.startsAt).getTime(),
      // A set collected early left the job then, not when the job closed.
      endMs: (() => {
        const end = member.collectedAt ?? deployment.endsAt;
        return end === null ? Number.POSITIVE_INFINITY : new Date(end).getTime();
      })(),
      place: deployment.locationLabel,
      // The site's position, not the deployment's label: a real job's is the PE's
      // name (`PE Tmn Sementa Jaya`), which says nothing about where it is.
      latitude: site?.latitude,
      longitude: site?.longitude,
    };

    const held = byGenset.get(member.gensetId) ?? [];
    held.push(posting);
    byGenset.set(member.gensetId, held);
  }

  return byGenset;
};

const buildFills = (): Array<GensetFill> => {
  const postings = buildPostings();
  const now = Date.now();
  const fills: Array<GensetFill> = [];

  for (const genset of GENSETS) {
    const own = postings.get(genset.id) ?? [];

    for (const refuel of refuelsIn(genset.id, 0, now)) {
      const posting = own.find((p) => refuel.at >= p.startMs && refuel.at <= p.endMs);
      const latitude = posting?.latitude ?? genset.latitude;
      const longitude = posting?.longitude ?? genset.longitude;

      fills.push({
        id: `${genset.id}-${refuel.at}`,
        gensetId: genset.id,
        at: refuel.at,
        litres: refuel.litres,
        place: posting?.place ?? 'Between deployments',
        latitude,
        longitude,
        depotId: depotFor(latitude, longitude).id,
      });
    }
  }

  return fills.sort((a, b) => a.at - b.at);
};

let held: Array<GensetFill> | undefined;

// Dealt again after any change to a deployment, since where a fill happened — and so
// which depot supplied it — follows the posting it fell in.
subscribeDeployments(() => {
  held = undefined;
});

/** Every fill in the record, oldest first. Dealt on first access. */
export const allFills = (): ReadonlyArray<GensetFill> => {
  held ??= buildFills();
  return held;
};

/** The fills one depot supplied — the fuel its bulk tank should have given up. */
export const depotFills = (depotId: string): ReadonlyArray<GensetFill> =>
  allFills().filter((fill) => fill.depotId === depotId);
