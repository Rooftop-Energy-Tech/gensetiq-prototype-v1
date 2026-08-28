import {BUILD_BRAND_ID as GENERATED_BUILD_BRAND, INCLUDED_BRAND_IDS} from 'virtual:brands';

import {clearStoredBrandId, storedBrandId} from './selection';
import type {BrandId} from './types';

/**
 * Which brand this session is running as.
 *
 * Two sources, in order: a choice a reader made in **Settings**, then the
 * `VITE_BRAND` the build was compiled with. Read once, at module load, which is why
 * picking a brand in Settings reloads the page — see `selection.ts` for why that is
 * the honest design rather than a shortcut.
 *
 * The precedence is that way round because the stored choice is the more specific
 * statement: `VITE_BRAND` is what this deployment is *for*, and the picker is what
 * the person in front of it wants *now*. A customer build carries only its own
 * brand, so the two cannot fight in the case that would matter — see `resolveActive`.
 *
 * ## Where the loud failure went
 *
 * A mistyped `VITE_BRAND=celcom` is still a hard error, and it now fires **earlier**
 * — in the `brands` plugin, before a bundle exists. That is strictly better than the
 * runtime throw this file used to do: the failure mode being guarded against is a
 * demo that comes up looking finished and wrong in front of a customer, and a build
 * that never produced output cannot be deployed by mistake.
 *
 * By the time this module runs, the brand has already been validated and baked into
 * the generated registry.
 */

/** The brand this build was compiled as, before any stored choice. */
export const BUILD_BRAND_ID: BrandId = GENERATED_BUILD_BRAND;

/**
 * Resolve the running brand, ignoring a stored choice this build cannot honour.
 *
 * A customer build carries exactly one brand, and a reader may still have
 * `gensetiq.brand` in `localStorage` from a dev session or from the unbranded
 * deployment on another port. Honouring it would mean looking up a brand that is
 * not in the bundle — so it is dropped, and the key is cleared rather than left to
 * fail again on the next load.
 *
 * That is a quiet fallback, and everywhere else in this directory a wrong brand is
 * a hard error. The difference is who is being protected from what: a bad
 * `VITE_BRAND` is a **build** that would go out looking finished and wrong, and
 * throwing is the only thing that stops it. A stale `localStorage` key is one
 * browser carrying a preference that no longer applies, on a build that has exactly
 * one correct answer — and taking that reader's app down would be the worse outcome
 * of the two.
 */
const resolveActive = (): BrandId => {
  const stored = storedBrandId();

  if (stored === undefined) return BUILD_BRAND_ID;
  if (INCLUDED_BRAND_IDS.includes(stored)) return stored;

  clearStoredBrandId();
  return BUILD_BRAND_ID;
};

/** The brand this session is running as. Constant for the life of the process. */
export const ACTIVE_BRAND_ID: BrandId = resolveActive();
