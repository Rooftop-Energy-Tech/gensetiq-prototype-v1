/**
 * Brands — one import for the two things the rest of the app asks for.
 *
 * `BRAND` is chrome and colour; `DATASET` is the estate. They are separate modules
 * because `styles/colors.ts` needs the first before the first paint and should not
 * pull forty-five kilobytes of site seed to get it — import from the specific
 * module there, and from here everywhere else.
 *
 * Read `types.ts` for what a brand is allowed to change and why.
 */
export {BRAND, brandIdentity} from './identity';
export {DATASET, dataset} from './dataset';
export {ACTIVE_BRAND_ID} from './active';
export {BRAND_IDS, DATASET_IDS} from './types';
export type {
  BrandCustomer,
  BrandDataset,
  BrandFleetSeed,
  BrandId,
  BrandIdentity,
  BrandSiteSeed,
  BrandTheme,
  CustomerId,
  DatasetId,
  SiteKindId,
} from './types';
