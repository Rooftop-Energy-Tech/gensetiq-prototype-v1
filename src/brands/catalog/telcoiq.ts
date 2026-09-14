import logo from '@/assets/telcoiq-logo.png';
import mark from '@/assets/telcoiq-mark.png';

import type {BrandIdentity} from '../types';

/**
 * TelcoIQ — the telco power line of the same platform, on the carrier estate.
 *
 * A sibling product rather than a customer, which is the one thing that makes this
 * entry read differently from `celcomdigi.ts`: there is no customer whose colours
 * these are. They are TelcoIQ's own, sampled from the wordmark rather than
 * eyedropped by hand, and recorded here so the next person can check a value
 * instead of re-sampling it.
 *
 * The estate is `carrier`, for the reason `../types.ts` gives for the unbranded
 * `gensetiq` build: a telco tower network already exists as a dataset, and the
 * product model already names `SOLAR_HYBRID` as a site power role, so a solar
 * hybrid site walks through the existing screens with nothing invented for it.
 */
export const TELCOIQ: BrandIdentity = {
  id: 'telcoiq',
  name: 'telcoIQ',
  blurb: 'The telco power line, in the wordmark’s own blue against the IQ near-black.',
  logo,
  mark,
  // The wordmark is 672 x 162 in the source PNG, carried at the same ratio.
  logoSize: {width: 218, height: 53},
  // The short logo for a dark ground — white letters with the wordmark's blue on
  // its own transparency, 228 x 170 in the source PNG and carried at that ratio.
  // It replaced a cut of the wordmark that had its own near-black baked in as
  // opaque pixels, which read on the rail as a dark tile sitting on a dark rail
  // rather than as a mark on it.
  markSize: {width: 43, height: 32},
  theme: {
    // Sampled from the wordmark's "telco": the dominant saturated blue across
    // 293 pixels of the glyph, with #0268FF and #036AFF either side of it as
    // anti-aliasing.
    brand: '#0369FF',
    // White. The near-black the product's teal carries disappears on a mid-blue,
    // which is the same call CelcomDigi's entry makes for the same reason.
    brandForeground: '#FFFFFF',
    // The design system's own sidebar, as the unbranded build uses. TelcoIQ has no
    // customer navy to reach for, and painting the rail the wordmark's own blue
    // would swallow the mark that sits on it.
    sidebar: '#040710',
  },
  dataset: 'carrier',
};

export default TELCOIQ;
