/**
 * The generated brand registry — see the `brands` plugin in `vite.config.ts`.
 *
 * There is no `virtual:brands.ts` on disk. The plugin emits this module's source
 * per build, containing static imports of **only the brands that build includes**,
 * so a customer's deployment does not carry another customer's name, mark or
 * estate. This file is the contract the app is typed against.
 */
declare module 'virtual:brands' {
  import type {
    BrandDataset,
    BrandId,
    BrandIdentity,
    BrandTab,
    DatasetId,
  } from '@/brands/types';

  /**
   * The brands this build carries, in `BRAND_IDS` order.
   *
   * One entry on a customer build, all of them in dev and on the unbranded build.
   * The Settings picker keys off the length, so what is shown and what is bundled
   * cannot disagree.
   */
  export const INCLUDED_BRAND_IDS: ReadonlyArray<BrandId>;

  /** Included brands only — indexing an excluded one gives `undefined`. */
  export const IDENTITIES: Partial<Record<BrandId, BrandIdentity>>;

  /** The estates the included brands name, and no others. */
  export const DATASETS: Partial<Record<DatasetId, BrandDataset>>;

  /** Tab strings, inlined as literals so `tab.ts` stays out of the client graph. */
  export const TABS: Partial<Record<BrandId, BrandTab>>;

  /** What `VITE_BRAND` said at build time, before any stored choice. */
  export const BUILD_BRAND_ID: BrandId;
}
