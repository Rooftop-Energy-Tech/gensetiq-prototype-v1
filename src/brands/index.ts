/**
 * Brands — one import for the things the rest of the app asks for.
 *
 * `BRAND` is chrome and colour, `BRAND_TAB` the three strings the document needs,
 * and `DATASET` the estate. They come from separate modules because
 * `styles/colors.ts` needs the first before the first paint and should not pull
 * forty-five kilobytes of site seed to get it — import from the specific module
 * there, and from here everywhere else.
 *
 * The brands themselves live one per file in `catalog/`, and the registry that
 * collects them is generated per build so a customer's deployment carries only its
 * own. Read `types.ts` for what a brand is allowed to change, and why that
 * generation is load-bearing rather than tidy.
 */
export {BRAND, BRAND_TAB, brandIdentity, INCLUDED_BRAND_IDS} from './identity';
export {DATASET, dataset} from './dataset';
export {ACTIVE_BRAND_ID, BUILD_BRAND_ID} from './active';
export {BRAND_IDS, DATASET_IDS} from './types';
export type {
  BrandCustomer,
  BrandDataset,
  BrandFleetSeed,
  BrandId,
  BrandIdentity,
  BrandSiteSeed,
  BrandTab,
  BrandTheme,
  CustomerId,
  DatasetId,
  SiteKindId,
} from './types';
