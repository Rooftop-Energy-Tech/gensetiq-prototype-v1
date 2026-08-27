import {BRAND_IDS} from './types';
import type {BrandId} from './types';

/**
 * Which brand this build is.
 *
 * `VITE_BRAND=sesb npm run dev`, and nothing else. One environment variable, read
 * once, at module load.
 *
 * ## Why it fails loudly rather than falling back quietly
 *
 * A mistyped `VITE_BRAND=celcom` could perfectly reasonably shrug and load the
 * default. It must not. The whole point of this file is that a demo is given to a
 * customer, and the failure mode of a silent fallback is **showing one customer
 * another customer's branding in a live meeting** — the app would come up looking
 * finished and wrong. A thrown error at boot costs ten seconds; that costs the
 * account.
 *
 * The unset case is different and does default: no `VITE_BRAND` at all is a
 * developer running `npm run dev`, not a typo, and `celcomdigi` is the newest
 * estate and the one the current work is against.
 */
const FALLBACK_BRAND: BrandId = 'celcomdigi';

const isBrandId = (value: string): value is BrandId =>
  (BRAND_IDS as ReadonlyArray<string>).includes(value);

const resolve = (): BrandId => {
  const requested = import.meta.env.VITE_BRAND;

  if (requested === undefined || requested === '') return FALLBACK_BRAND;

  if (!isBrandId(requested)) {
    throw new Error(
      `VITE_BRAND="${requested}" is not a brand. Known brands: ${BRAND_IDS.join(', ')}. ` +
        'Set it to one of those, or leave it unset to build ' +
        `${FALLBACK_BRAND}.`,
    );
  }

  return requested;
};

export const ACTIVE_BRAND_ID: BrandId = resolve();
