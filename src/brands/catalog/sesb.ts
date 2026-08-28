import logo from '@/assets/sesb-logo.png';
import mark from '@/assets/sesb-mark-white.png';

import type {BrandIdentity} from '../types';

/**
 * Sabah Electricity — a state distribution licensee's own injection points.
 *
 * See `celcomdigi.ts` for why each brand is a separate module: the registry is
 * generated per build, so this file and its assets are absent from a build that is
 * not SESB's.
 */
export const SESB: BrandIdentity = {
  id: 'sesb',
  name: 'Sabah Electricity',
  blurb: 'A state utility’s substations and rural mini-grids, in their electric blue.',
  logo,
  // The white cut, not the dark one: the rail is SESB blue and the standard mark
  // is drawn for a light ground.
  mark,
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

export default SESB;
