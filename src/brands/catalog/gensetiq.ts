import logo from '@/assets/gensetiq-wordmark-light.svg';
import mark from '@/assets/iq-mark.svg';

import type {BrandIdentity} from '../types';

/**
 * The product, unbranded — teal, the IQ mark, and no customer's name anywhere.
 *
 * The build to demo to a prospect, screenshot for a deck, or open when the question
 * is "what does gensetIQ do" rather than "what does it do for them". It existed on
 * no branch and had to be reconstructed, which is itself the argument for this
 * directory: the neutral product was the one configuration nobody could show,
 * because every branch was somebody's white label.
 *
 * It runs the carrier estate rather than a third invented one. What makes this
 * build neutral is the absence of a customer, not a different set of towers.
 *
 * It is also the only brand whose **production** build carries the others, because
 * it is the one with no customer to leak — see `BRAND_PICKER_VISIBLE`.
 */
export const GENSETIQ: BrandIdentity = {
  id: 'gensetiq',
  name: 'gensetIQ',
  blurb: 'The product with no customer on it — teal, the IQ mark, and no lockup.',
  logo,
  mark,
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

export default GENSETIQ;
