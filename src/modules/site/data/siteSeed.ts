import {DATASET} from '@/brands';
import type {ProgramId} from '@/brands';
import type {SiteKind, SitePowerRole} from '../types/site.type';
import type {CustomerId} from './customers';
import {siteOverrides} from './siteOverrides';
import type {SiteOverrides} from './siteOverrides';

/**
 * The twenty-five sites, as **given facts about places**.
 *
 * The rows themselves live in `brands/datasets/*.ts` — a carrier's tower network
 * on one, a utility's injection points on the other — and this file is the view
 * the site module reads them through. It used to hold one of those two estates
 * inline, which is why swapping estates meant swapping branches.
 *
 * ## Given by whom
 *
 * By the dataset first, and then by **the reader**, who can correct a site's name,
 * its position, its region and its programme from the site's Settings tab. Those
 * edits are differences held in `siteOverrides.ts`, and `siteSeeds()` below is what
 * lays them over the dataset's rows — so everything downstream reads one estate
 * rather than each screen deciding for itself whether to honour a correction.
 *
 * That is why this file's main export is a **function** and not the const it used
 * to be. Everything here is still a given about a place: what changed is that the
 * givens can be restated, not that they became derived. `DATASET_SITE_SEED` is the
 * original statement, and it is what Reset goes back to.
 *
 * ## Why position is seeded rather than derived
 *
 * It used to be derived: a site's placename was its first genset's, and its
 * coordinates were the mean of its members'. That worked exactly as long as
 * membership was fixed, and stopped the moment gensets could be attached and
 * detached. Three things broke at once:
 *
 *  - **an empty site had no location at all.** Zero members meant `'Unknown'` and a
 *    mean of nothing, which lands at 0°, 0° — the Gulf of Guinea.
 *  - **the yard's position depended on attach order.** If the site is wherever its
 *    sets are, the first set to arrive defines the place and the second gets dragged
 *    to it. A substation does not move because a lorry did.
 *  - **it was circular.** Deploying a set *moves the machine to the site*, so the
 *    site's position is the input to that operation. Deriving it from the output is
 *    a loop with no fixed point.
 *
 * ## Why the load is seeded
 *
 * `loadKw` is what the injection point carries — a fact about the **network**,
 * not about the plant parked beside it. A feeder draws what its area draws.
 *
 * It used to be scaled off installed genset capacity, which was a convenience that
 * quietly made the load a function of the machinery. Being able to detach a genset
 * made that plainly wrong: strip a site of its sets and it would appear to stop
 * carrying load. Seeding it means **removing a genset does not change what the
 * point draws**, which is the only defensible behaviour.
 *
 * The intended direction of travel is a **metering device installed at the site**,
 * reporting a consumption pattern over time rather than one figure. When that lands
 * this seed becomes the device's reading, and nothing above `SiteSummary.mains` has
 * to change.
 */
export type SiteSeed = {
  id: string;
  /** e.g. `WPKL-0207` — the label the design puts in the header. */
  name: string;
  kind: SiteKind;
  /** The yard's placename. Gensets deployed here take it as their own. */
  locationLabel: string;
  latitude: number;
  longitude: number;
  /**
   * What the site draws, kW — the load meter's reading.
   *
   * The figure most likely to be got wrong, and the one whose right scale depends
   * entirely on `kind`: a macro base station is 4–6 kW where a distribution
   * substation is a few hundred. Each estate's range spans roughly fifty to one,
   * which is the reason a single "genset site" figure would say nothing.
   *
   * Independent of what is standing at the site, deliberately. See the note above.
   */
  loadKw: number;
  /**
   * Which region or zone this site belongs to.
   *
   * Seeded here and nowhere else: a genset takes its division from the site it
   * stands at, so there is one statement of the fact and detaching a set leaves it
   * with no division rather than with a stale one. The division also carries the
   * peak sun hours every solar figure at this site is built from. See
   * `customers.ts`.
   */
  customer: CustomerId;
  /**
   * How this site is powered, as a **given about the place** — see `SitePowerRole`.
   *
   * Each estate is deliberately a **mix**, because that is what a real one is and
   * because a demo of hybrid plant is worth nothing without the sites it is being
   * compared against. Grid-backed sites are the town and city ones. The off-grid
   * sites split three ways: the ones still on diesel prime, the ones converted to
   * diesel hybrid, and the ones that got an array as well. A reader filtering the
   * sites list by configuration is reading the conversion programme's progress.
   *
   * Their gensets' activity feeds still read "started on utility outage", because
   * those feeds are the *machines'* history and this setting does not rewrite it.
   * `siteConfig.ts` keeps its override store: a reader flipping a site still wins,
   * and clearing site data returns to what is written here.
   */
  powerRole: SitePowerRole;
  /**
   * The rollout programme this site is filed under, or `undefined` for none.
   *
   * A **grouping and nothing else** — see `programs.ts` for why it is a separate
   * axis from `customer` rather than a second name for it, and why being in no
   * programme is a complete answer rather than a gap.
   */
  program: ProgramId | undefined;
};

/**
 * The active estate's places, exactly as the dataset states them.
 *
 * **Not what the app reads** — that is `siteSeeds()` below, which is this with a
 * reader's edits applied. This is the thing an edit is measured against: it is what
 * Reset restores, and what "changed from the dataset" on the settings page compares
 * to.
 *
 * The cast is the one place the brands refactor gives up a guarantee, and it is
 * narrow: a dataset's `powerRole` is typed `string` in `brands/types.ts` so a
 * dataset file can be read without importing the site module, and it is asserted
 * back to `SitePowerRole` here. `assertDatasetIntegrity` cannot check it — the
 * roles are the product's vocabulary and the dataset layer does not know them — so
 * a dataset inventing a fifth role would reach the diagram and draw no sources
 * above the bus. The four names are in `SITE_POWER_ROLES`; use those.
 */
export const DATASET_SITE_SEED: ReadonlyArray<SiteSeed> = DATASET.sites.map((site) => ({
  ...site,
  powerRole: site.powerRole as SitePowerRole,
  program: site.program,
}));

const DATASET_BY_ID: Record<string, SiteSeed> = Object.fromEntries(
  DATASET_SITE_SEED.map((seed) => [seed.id, seed]),
);

/** What the dataset says about one site, before any edit. */
export const datasetSiteSeed = (siteId: string): SiteSeed | undefined => DATASET_BY_ID[siteId];

/**
 * One site, with the reader's edits laid over the dataset's row.
 *
 * The override store holds only *differences* (see `siteOverrides.ts`), so an
 * untouched site comes back as its dataset row and an untouched **estate** comes
 * back as `DATASET_SITE_SEED` itself — which is what keeps the memo below cheap in
 * the case that is true almost all the time.
 *
 * `program` is the one field that cannot be written with `??`: `null` in the patch
 * means *the reader took this site out of its programme*, which is a different
 * statement from the key being absent, and `??` would collapse the two and make
 * un-filing a seeded site impossible.
 */
const patched = (seed: SiteSeed, overrides: SiteOverrides): SiteSeed => {
  const patch = overrides[seed.id];
  if (patch === undefined) return seed;

  return {
    ...seed,
    name: patch.name ?? seed.name,
    latitude: patch.latitude ?? seed.latitude,
    longitude: patch.longitude ?? seed.longitude,
    customer: patch.customer ?? seed.customer,
    powerRole: patch.powerRole ?? seed.powerRole,
    program: patch.program === undefined ? seed.program : (patch.program ?? undefined),
  };
};

/**
 * Memoised on the override snapshot's identity, which is stable between writes.
 *
 * Not decoration: `sites.ts` keys its whole summary cache on the identity of what
 * this returns, and half a dozen estate-wide figures in `hybrid.ts` map over it on
 * every render. A fresh array per call would rebuild twenty-five summaries each
 * time and hand `useSyncExternalStore` a new snapshot forever.
 */
let cache: {overrides: SiteOverrides; seeds: ReadonlyArray<SiteSeed>} | undefined;

/**
 * **The estate, as the app reads it** — the dataset's rows with a reader's edits on
 * top.
 *
 * A function rather than the const this used to be, because the values are no
 * longer fixed for the life of the process: a reader can rename a site, move its
 * pin, change its region or file it under a different programme, and every figure
 * derived from those has to follow. Callers that render should reach it through
 * `sites.ts` or a hook so they re-render when it changes; callers that compute —
 * loaders, `aria-label` builders, one-shot derivations — can call it directly.
 */
export const siteSeeds = (): ReadonlyArray<SiteSeed> => {
  const overrides = siteOverrides();
  if (cache?.overrides !== overrides) {
    cache = {
      overrides,
      seeds: DATASET_SITE_SEED.map((seed) => patched(seed, overrides)),
    };
  }
  return cache.seeds;
};

export const siteSeed = (siteId: string): SiteSeed | undefined => {
  const seed = DATASET_BY_ID[siteId];
  return seed === undefined ? undefined : patched(seed, siteOverrides());
};

/** `SWK-1163`, for the breadcrumb and the document title. */
export const siteLabel = (siteId: string): string => siteSeed(siteId)?.name ?? 'Site';

/**
 * How each kind is written in a chip — the active estate's vocabulary.
 *
 * A `Record<string, string>` rather than a closed map, because the keys are the
 * dataset's. Every lookup is a site's own `kind`, which the integrity check has
 * already matched against these keys, so a caller reading `SITE_KIND_LABEL[kind]`
 * gets a label rather than `undefined`.
 */
export const SITE_KIND_LABEL: Readonly<Record<string, string>> = DATASET.siteKindLabels;

/**
 * The site the app opens on, and this section's default.
 *
 * Each dataset names its own — see `defaultSiteId` there for why the choice is
 * never simply the first row.
 */
export const DEFAULT_SITE_ID = DATASET.defaultSiteId;
