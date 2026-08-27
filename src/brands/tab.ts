import {BRAND_IDS} from './types';
import type {BrandId} from './types';

/**
 * The browser tab, per brand — title, description, favicon.
 *
 * ## Why this is its own module
 *
 * `index.html` is not JavaScript. It is transformed at build time by the
 * `brandHtml` plugin in `vite.config.ts`, which runs in **Node**, where
 * `import '@/assets/celcomdigi-mark.svg'` is not a thing. So `identity.ts` — which
 * imports six image assets — cannot be read from the build config, and the three
 * strings the `<head>` needs live here instead, in a module that imports nothing
 * but types.
 *
 * The alternative was writing the title and favicon twice, once for the app and
 * once for the build. That is exactly the sort of duplication that survives review
 * and then goes stale: a customer gets renamed in one place, and their demo comes
 * up with the old name in the tab. `identity.ts` spreads these in, so there is one
 * statement of each.
 *
 * `faviconPath` is a path under `public/` rather than an imported asset for the
 * same reason — the plugin writes it into an `href`, and Vite serves `public/`
 * verbatim.
 */
export type BrandTab = {
  title: string;
  description: string;
  /** Filename under `public/`, no leading slash. */
  faviconPath: string;
};

export const BRAND_TABS: Record<BrandId, BrandTab> = {
  celcomdigi: {
    title: 'CelcomDigi Site Power',
    description: 'Site power monitoring for CelcomDigi, powered by gensetIQ',
    // Their own 256px apple-touch-icon cut, transparent. One file rather than a
    // set: every browser downscales it to 16 and 32, and what it replaced was a
    // hand-redrawn approximation — an approximation of a logo is a worse asset
    // than the logo, whatever it costs in bytes.
    faviconPath: 'favicon-celcomdigi.png',
  },
  sesb: {
    title: 'SESB Genset Monitoring',
    description: 'Genset monitoring for Sabah Electricity, powered by gensetIQ',
    // The product mark, not SESB's: their assets are the wide lockup and a mark
    // with type in it, neither of which survives 16px. A brand with no square mark
    // is better served by the product's than by an unreadable crop of its own.
    faviconPath: 'favicon-gensetiq.svg',
  },
  gensetiq: {
    title: 'gensetIQ',
    description: 'Genset and site power monitoring',
    faviconPath: 'favicon-gensetiq.svg',
  },
};

const isBrandId = (value: string): value is BrandId =>
  (BRAND_IDS as ReadonlyArray<string>).includes(value);

/**
 * The tab for a brand id, for the Vite plugin — which reads a raw environment
 * string and has no access to `active.ts`'s resolution.
 *
 * Throws on an unknown id for the same reason `active.ts` does: a typo that
 * silently fell back would put one customer's name in another customer's tab, and
 * a title is the one piece of chrome nobody re-checks before a demo.
 */
export const brandTab = (id: string): BrandTab => {
  if (!isBrandId(id)) {
    throw new Error(
      `VITE_BRAND="${id}" is not a brand. Known brands: ${BRAND_IDS.join(', ')}.`,
    );
  }
  return BRAND_TABS[id];
};
