import mark from '@/assets/express-mission-mark.png';

import type {BrandIdentity} from '../types';

/**
 * Express Mission — the PoC customer this build is for.
 *
 * A mobile genset fleet posted to distribution substations across **Peninsular
 * Malaysia**, which is why it walks the `utility` estate: that dataset is the
 * pencawang elektrik one, and a vendor's machines stand where the licensee's
 * network needs temporary supply. See
 * `product-gensetiq/sites/express-mission-site-profile.md`.
 *
 * ## One asset, used twice
 *
 * The design gives a **48px circular mark and no wide lockup** — the rail is the
 * only place EM's identity appears in it. So the mark stands in for the logo on the
 * login door too, at the size it was drawn for rather than stretched into a lockup
 * it is not.
 *
 * It is also a raster, and a background-removed one at that: the Figma layer is
 * named `EM-logo-removebg-preview`, which is a screenshot with its white knocked
 * out, not a supplied asset. It is sharp enough at 48px on the login and soft on a
 * retina rail. **Replace it the moment EM send a real one** — an SVG here changes
 * this file and nothing else.
 *
 * ## The greens
 *
 * Sampled from the design rather than supplied as values, so they are what the
 * picture shows rather than what a brand book might say. `#045832` is the mark's
 * own ring; `#0A2723` is the rail it sits on, which is close to black and reads as
 * a dark neutral until the mark lands on it.
 */
export const EXPRESS_MISSION: BrandIdentity = {
  id: 'express-mission',
  name: 'Express Mission',
  blurb: 'The PoC fleet — mobile gensets at pencawang elektrik across the Peninsular, in their green.',
  logo: mark,
  mark,
  logoSize: {width: 48, height: 48},
  markSize: {width: 40, height: 40},
  theme: {
    // The mark's ring. Carries white, which is what the login CTA needs.
    brand: '#045832',
    brandForeground: '#FFFFFF',
    // The rail behind the mark, a shade off the ring rather than the ring itself:
    // a mark on its own colour has no silhouette.
    sidebar: '#0A2723',
  },
  dataset: 'utility',
};

export default EXPRESS_MISSION;
