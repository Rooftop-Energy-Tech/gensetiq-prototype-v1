import {storedBrandId} from './selection';
import {BRAND_IDS} from './types';
import type {BrandId} from './types';

/**
 * Which brand this build is.
 *
 * Two sources, in order: a choice a reader made in **Settings**, then
 * **`VITE_BRAND`** at build time. Read once, at module load, which is why picking a
 * brand in Settings reloads the page — see `selection.ts` for why that is the
 * honest design rather than a shortcut.
 *
 * The precedence is that way round because the stored choice is the more specific
 * statement: `VITE_BRAND` is what this deployment is *for*, and the picker is what
 * the person in front of it wants *now*. A customer-facing deploy does not show the
 * picker at all (see `BUILD_BRAND_ID`'s use in the Settings screen), so the two
 * cannot fight in the case that would matter.
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

/**
 * What `VITE_BRAND` said, ignoring any stored choice.
 *
 * The Settings picker needs this to label one option "this build's own" and to
 * decide whether to appear at all: a deployed customer build must not offer a
 * reader another customer's name, however the current session is branded.
 */
const resolveBuild = (): BrandId => {
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

/** The brand this build was compiled as, before any stored choice. */
export const BUILD_BRAND_ID: BrandId = resolveBuild();

/** The brand this session is running as. Constant for the life of the process. */
export const ACTIVE_BRAND_ID: BrandId = storedBrandId() ?? BUILD_BRAND_ID;
