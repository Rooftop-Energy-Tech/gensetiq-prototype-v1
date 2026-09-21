import {BRAND_IDS} from './types';
import type {BrandId, BrandTab, DatasetId} from './types';

/**
 * What exists, for the build to read. **Node-only — nothing in `src/` imports this.**
 *
 * The `brands` plugin in `vite.config.ts` generates the `virtual:brands` registry,
 * and to do that it has to know three things it cannot get any other way:
 *
 *  - **which module each brand lives in**, so it can emit an import for the ones
 *    this build includes and leave the rest out of the graph entirely;
 *  - **which estate each brand names**, so it can do the same for datasets;
 *  - **the tab strings**, because `index.html` is not JavaScript and the `<head>`
 *    is filled at build time.
 *
 * It cannot get them by importing the catalog: those files `import` SVGs and PNGs,
 * which is not a thing in Node. So the facts the build needs are stated here, in a
 * module that imports nothing but types.
 *
 * ## The one duplication, and what catches it
 *
 * `dataset` appears both here and on the brand's own entry in `catalog/`. That is a
 * real chance to drift, and it is caught loudly rather than by discipline: the
 * generator includes whichever estate *this* file names, and `dataset.ts` looks up
 * whichever the *catalog* names. Disagree, and the lookup is `undefined` and the app
 * throws on load naming both. It cannot ship half-right.
 *
 * Adding a customer means a file in `catalog/`, an entry here, and an id in
 * `BRAND_IDS`. The type system requires the second and third together.
 */
export type BrandManifestEntry = {
  /** Root-relative module path, as the generated registry will import it. */
  module: string;
  /** The named export in that module. */
  binding: string;
  /** Which estate this brand walks through — see the drift note above. */
  dataset: DatasetId;
  tab: BrandTab;
};

export const BRAND_MANIFEST: Record<BrandId, BrandManifestEntry> = {
  'express-mission': {
    module: '/src/brands/catalog/express-mission.ts',
    binding: 'EXPRESS_MISSION',
    dataset: 'utility',
    tab: {
      title: 'Express Mission Genset Monitoring',
      description: 'Mobile genset fleet monitoring for Express Mission, powered by gensetIQ',
      // The product's, until EM supply theirs. Their own mark is a 48px raster with
      // rings inside it — cut to 16px it is a green dot, which is nobody's.
      faviconPath: 'favicon-gensetiq.svg',
    },
  },
  gensetiq: {
    module: '/src/brands/catalog/gensetiq.ts',
    binding: 'GENSETIQ',
    dataset: 'carrier',
    tab: {
      title: 'gensetIQ',
      description: 'Genset and site power monitoring',
      faviconPath: 'favicon-gensetiq.svg',
    },
  },
};

export const DATASET_MANIFEST: Record<DatasetId, {module: string; binding: string}> = {
  carrier: {module: '/src/brands/datasets/carrier.ts', binding: 'CARRIER_DATASET'},
  utility: {module: '/src/brands/datasets/utility.ts', binding: 'UTILITY_DATASET'},
};

const isBrandId = (value: string): value is BrandId =>
  (BRAND_IDS as ReadonlyArray<string>).includes(value);

/**
 * Validate a raw `VITE_BRAND`, for the plugin.
 *
 * Throws on anything unknown, which fails the dev server and the production build.
 * The failure being guarded against is a demo that comes up looking finished and
 * wrong in front of a customer, and a build that never produced output cannot be
 * deployed by mistake.
 */
export const resolveBrandId = (raw: string | undefined, fallback: BrandId): BrandId => {
  if (raw === undefined || raw === '') return fallback;

  if (!isBrandId(raw)) {
    throw new Error(
      `VITE_BRAND="${raw}" is not a brand. Known brands: ${BRAND_IDS.join(', ')}. ` +
        `Set it to one of those, or leave it unset to build ${fallback}.`,
    );
  }

  return raw;
};
