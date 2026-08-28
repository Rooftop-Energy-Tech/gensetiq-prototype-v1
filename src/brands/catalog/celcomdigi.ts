import logo from '@/assets/celcomdigi-logo.svg';
import mark from '@/assets/celcomdigi-mark.svg';

import type {BrandIdentity} from '../types';

/**
 * CelcomDigi — a mobile carrier's own tower network.
 *
 * One file per brand, and this is the shape of it: a customer's chrome, their four
 * colours, and the estate they walk through. Nothing else in the app may vary by
 * customer — see `../types.ts` for where that line is drawn.
 *
 * ## Why each brand is its own module
 *
 * So a build can leave the others out. The registry that collects these is
 * **generated per build** by the `brands` plugin in `vite.config.ts`: a customer's
 * deployment statically imports only its own file, and the other customers'
 * names, marks and estates never enter the module graph — so they are not in the
 * bundle to be found by anyone who opens devtools.
 *
 * That is the whole reason for the split. A single `Record` of all three, however
 * neatly written, ships all three.
 *
 * The colours are the customer's own, recorded with the variable names their
 * stylesheet uses so the next person can check a value rather than re-eyedrop it.
 */
export const CELCOMDIGI: BrandIdentity = {
  id: 'celcomdigi',
  name: 'CelcomDigi',
  blurb: 'A mobile carrier’s tower network, in their navy and bright blue.',
  logo,
  mark,
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

export default CELCOMDIGI;
