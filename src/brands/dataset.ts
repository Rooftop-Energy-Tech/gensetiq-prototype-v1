import {DATASETS} from 'virtual:brands';

import {BRAND} from './identity';
import type {BrandDataset, DatasetId} from './types';

/**
 * The estates, and the check that each one is internally consistent.
 *
 * Imported by the site and genset data modules, which is most of the app — so
 * unlike `identity.ts`, this module is heavy and is not on the pre-paint path.
 *
 * The estates come from the generated registry, which carries only the ones the
 * included brands name. A CelcomDigi deployment therefore has no utility dataset
 * in it at all: not hidden, absent. Twenty-five substation names and thirty-seven
 * machine tags are the most identifiable thing a bundle could leak about another
 * customer, and a UI flag cannot un-ship them.
 */

/**
 * Everything the compiler used to catch, checked at boot instead.
 *
 * `CustomerId` and `SiteKind` were per-brand string unions before this refactor,
 * and a typo in a seed row was a red squiggle. They cannot stay unions across a
 * swappable dataset — the unions were the reason two estates could not coexist in
 * one build — so the guarantee moves here, and the cost is that it fires at
 * runtime rather than in the editor.
 *
 * It runs on every module load, in dev and in the production bundle alike. That is
 * deliberate: this is static data, so the check is microseconds against
 * twenty-five rows, and a broken estate that only failed in dev would ship.
 *
 * What it refuses to let through:
 *
 *  - a site pointing at a zone the roster does not list, or a kind with no label —
 *    each renders as `undefined` in a chip, which reads as a data gap rather than
 *    a bug and so survives review;
 *  - a genset standing at a site id that does not exist, which is the one that
 *    matters most. It quietly drops the machine out of every site rollup while
 *    leaving it in the fleet count, so the two disagree by one and nothing says so;
 *  - a default site or genset that isn't in the estate, which lands a reader on an
 *    empty page immediately after login;
 *  - a duplicate id, which makes `.find()` return whichever row came first.
 */
const assertDatasetIntegrity = (dataset: BrandDataset): void => {
  const fail = (message: string): never => {
    throw new Error(`Dataset "${dataset.label}" (${dataset.id}): ${message}`);
  };

  const customerIds = new Set(dataset.customers.map((entry) => entry.id));
  const kindIds = new Set(Object.keys(dataset.siteKindLabels));
  const siteIds = new Set<string>();

  if (customerIds.size !== dataset.customers.length) {
    fail('two zones share an id.');
  }

  for (const site of dataset.sites) {
    if (siteIds.has(site.id)) fail(`site id "${site.id}" appears twice.`);
    siteIds.add(site.id);

    if (!customerIds.has(site.customer)) {
      fail(`site "${site.id}" names zone "${site.customer}", which is not in the roster.`);
    }
    if (!kindIds.has(site.kind)) {
      fail(`site "${site.id}" is kind "${site.kind}", which has no label.`);
    }
  }

  const gensetIds = new Set<string>();

  for (const genset of dataset.gensets) {
    const id = genset.tag.toLowerCase();
    if (gensetIds.has(id)) fail(`genset tag "${genset.tag}" appears twice.`);
    gensetIds.add(id);

    // `undefined` is legitimate — a machine in the workshop stands at no site.
    if (genset.siteId !== undefined && !siteIds.has(genset.siteId)) {
      fail(`genset "${genset.tag}" stands at site "${genset.siteId}", which does not exist.`);
    }
  }

  if (!siteIds.has(dataset.defaultSiteId)) {
    fail(`defaultSiteId "${dataset.defaultSiteId}" is not a site in this estate.`);
  }
  if (!gensetIds.has(dataset.defaultGensetId)) {
    fail(`defaultGensetId "${dataset.defaultGensetId}" is not a machine in this fleet.`);
  }
};

const active = DATASETS[BRAND.dataset];

if (active === undefined) {
  // Only reachable if the generator included a brand without its estate.
  throw new Error(
    `Brand "${BRAND.id}" names dataset "${BRAND.dataset}", which is not in this build.`,
  );
}

assertDatasetIntegrity(active);

/** The estate this build walks through. Constant for the life of the process. */
export const DATASET: BrandDataset = active;

/**
 * An estate by id — for the Settings picker, which states what each brand brings.
 *
 * Throws on an estate this build does not carry, for the same reason
 * `brandIdentity` does: the caller got the id off an included brand, so an absent
 * one is a generator bug rather than a reader's typo.
 */
export const dataset = (id: DatasetId): BrandDataset => {
  const found = DATASETS[id];
  if (found === undefined) {
    throw new Error(`Dataset "${id}" is not in this build.`);
  }
  return found;
};

export {assertDatasetIntegrity};
