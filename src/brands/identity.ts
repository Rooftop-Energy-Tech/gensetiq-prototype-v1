import {IDENTITIES, INCLUDED_BRAND_IDS, TABS} from 'virtual:brands';

import {ACTIVE_BRAND_ID} from './active';
import type {BrandId, BrandIdentity, BrandTab} from './types';

/**
 * The brand this build is running as, resolved out of the generated registry.
 *
 * The brands themselves live one per file under `catalog/`, and `virtual:brands`
 * is assembled per build by the plugin in `vite.config.ts` so that a customer's
 * deployment imports only its own — see `types.ts` for why that matters more than
 * it looks like it should.
 *
 * This module is imported by `styles/colors.ts`, which runs before the first
 * paint, so it stays small: a lookup and two guards, no estate data.
 */
const active = IDENTITIES[ACTIVE_BRAND_ID];

if (active === undefined) {
  // `active.ts` already checks the resolved id against `INCLUDED_BRAND_IDS`, so
  // reaching this means the registry and that list disagree — which can only be a
  // bug in the generator, not in anything a reader did.
  throw new Error(
    `Brand "${ACTIVE_BRAND_ID}" is not in this build. Included: ${INCLUDED_BRAND_IDS.join(', ')}.`,
  );
}

/** The brand this build is. Constant for the life of the process. */
export const BRAND: BrandIdentity = active;

const activeTab = TABS[ACTIVE_BRAND_ID];

if (activeTab === undefined) {
  throw new Error(`Brand "${ACTIVE_BRAND_ID}" has no tab entry in this build.`);
}

/**
 * The active brand's tab strings.
 *
 * `main.tsx` reconciles the document to these after load, because `index.html` is
 * stamped at build time and cannot know about a Settings choice made later.
 */
export const BRAND_TAB: BrandTab = activeTab;

/**
 * A brand by id — for the Settings picker, which walks `INCLUDED_BRAND_IDS`.
 *
 * Throws rather than returning `undefined` for an excluded brand: every caller
 * reached here by iterating the included list, so an absent one means the caller
 * invented an id, and a tile rendering as blank would hide that.
 */
export const brandIdentity = (id: BrandId): BrandIdentity => {
  const found = IDENTITIES[id];
  if (found === undefined) {
    throw new Error(`Brand "${id}" is not in this build.`);
  }
  return found;
};

export {INCLUDED_BRAND_IDS};
