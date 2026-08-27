import celcomdigiLogo from '@/assets/celcomdigi-logo.svg';
import celcomdigiMark from '@/assets/celcomdigi-mark.svg';
import gensetiqLogo from '@/assets/gensetiq-wordmark-light.svg';
import iqMark from '@/assets/iq-mark.svg';
import sesbLogo from '@/assets/sesb-logo.png';
import sesbMark from '@/assets/sesb-mark-white.png';

import {ACTIVE_BRAND_ID} from './active';
import {BRAND_TABS} from './tab';
import type {BrandId, BrandIdentity} from './types';

/**
 * The three brands, as chrome and colour only.
 *
 * No estate data here — see `dataset.ts`. This module is imported by
 * `styles/colors.ts`, which runs before the first paint, so it stays small on
 * purpose.
 *
 * Every colour below was already in the codebase; this file is where they stopped
 * being a git branch. The CelcomDigi and SESB values are the customers' own,
 * lifted from their published stylesheets and recorded here with the variable
 * names they use, so the next person can check them rather than re-eyedrop them.
 */
/**
 * The tab strings, renamed into the shape `BrandIdentity` uses.
 *
 * They live in `tab.ts` because the Vite plugin that writes `index.html` runs in
 * Node and cannot import this file's assets — see that module's header.
 */
const tabFields = (id: BrandId) => ({
  documentTitle: BRAND_TABS[id].title,
  documentDescription: BRAND_TABS[id].description,
  faviconPath: BRAND_TABS[id].faviconPath,
});

const CELCOMDIGI: BrandIdentity = {
  id: 'celcomdigi',
  name: 'CelcomDigi',
  ...tabFields('celcomdigi'),
  logo: celcomdigiLogo,
  mark: celcomdigiMark,
  logoSize: {width: 240, height: 74},
  markSize: {width: 40, height: 43},
  theme: {
    // `--colour--cd-bright-blue-500`, the fill their primary button carries.
    brand: '#0064DC',
    // White, because the near-black that sat on the product's teal disappears on
    // a mid-blue.
    brandForeground: '#FFFFFF',
    // `--colour--cd-navy-blue-500`, the colour their wordmark is set in. Navy
    // rather than the bright blue beside it, deliberately: the rail carries the
    // mark, whose own gradient runs #009BDF → #0064DC, and a rail painted the
    // mark's own blue would swallow it.
    sidebar: '#001871',
    // `--colour--celcom-blue`, the lighter blue their mark's gradient starts at.
    battery: {base: '#009BDF', tip: '#4FBCEA'},
  },
  dataset: 'carrier',
};

const SESB: BrandIdentity = {
  id: 'sesb',
  name: 'Sabah Electricity',
  ...tabFields('sesb'),
  logo: sesbLogo,
  // The white cut, not the dark one: the rail is SESB blue and the standard mark
  // is drawn for a light ground.
  mark: sesbMark,
  logoSize: {width: 240, height: 80},
  markSize: {width: 40, height: 18},
  theme: {
    // `--electric-blue` from their own site.
    brand: '#0E4393',
    brandForeground: '#FFFFFF',
    // The customer's request for this build, a shade off the brand blue.
    sidebar: '#0F4586',
    // No brand storage colour of their own; the product's stands.
  },
  dataset: 'utility',
};

/**
 * The product, unbranded — teal, the IQ mark, and no customer's name anywhere.
 *
 * This is the build to demo to a prospect, screenshot for a deck, or open when
 * the question is "what does gensetIQ do" rather than "what does it do for them".
 * It existed on no branch and had to be reconstructed, which is itself the
 * argument for this file: the neutral product was the one configuration nobody
 * could show, because every branch was somebody's white label.
 *
 * It runs the carrier estate rather than a third invented one. What makes this
 * build neutral is the absence of a customer, not a different set of towers.
 */
const GENSETIQ: BrandIdentity = {
  id: 'gensetiq',
  name: 'gensetIQ',
  ...tabFields('gensetiq'),
  logo: gensetiqLogo,
  mark: iqMark,
  logoSize: {width: 201, height: 48},
  markSize: {width: 32, height: 32},
  theme: {
    // The product's own teal — the IQ mark's accent stroke and the login CTA.
    brand: '#21B0B0',
    // Near-black, which is what the teal was designed to carry.
    brandForeground: '#161D27',
    // The design system's own sidebar, dark rather than a customer's blue.
    sidebar: '#040710',
  },
  dataset: 'carrier',
};

const IDENTITIES: Record<BrandId, BrandIdentity> = {
  celcomdigi: CELCOMDIGI,
  sesb: SESB,
  gensetiq: GENSETIQ,
};

/** The brand this build is. Constant for the life of the process. */
export const BRAND: BrandIdentity = IDENTITIES[ACTIVE_BRAND_ID];

/** For the identity picker in Settings, and for tests that walk every brand. */
export const brandIdentity = (id: BrandId): BrandIdentity => IDENTITIES[id];
