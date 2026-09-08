import logo from '@/assets/redtone-logo.png';
import mark from '@/assets/redtone-mark.png';

import type {BrandIdentity} from '../types';

/**
 * REDTONE — a network infrastructure operator's own tower estate.
 *
 * See `celcomdigi.ts` for why each brand is a separate module: the registry is
 * generated per build, so this file and its assets are absent from a build that is
 * not Redtone's.
 *
 * ## Why the rail is black rather than red
 *
 * Because the wordmark is two inks and only one of them is the red. `REDTONE` sets
 * `RED` in #D3131E and `tone` in white, and the customer's own pages hang it on
 * near-black — which is the ground both halves need: on a red rail the red half
 * disappears into it, and there is no shade of red that a white `tone` and a red
 * `RED` are both legible on. So #070707 carries the mark, exactly as the design
 * has it, and the red is spent where it reads as a decision rather than a
 * background: the sign-out disc, the login button, every `bg-brand` control.
 *
 * That is the same call CelcomDigi's file makes for the opposite reason — their
 * rail is navy so their mark's bright-blue gradient has something to sit on.
 *
 * ## Two cuts of one wordmark
 *
 * `mark` is the artwork as exported, ground and all: it goes on the rail, whose
 * #070707 the export's own #090909 is indistinguishable from. `logo` is the same
 * artwork unmatted off that ground, with the white half re-inked in it — the login
 * page is `bg-canvas`, and the reversed cut would put a white `tone` on an
 * off-white card. Both are the same file at 1024×342; drop the customer's official
 * lockup in over either one and nothing else here changes.
 */
export const REDTONE: BrandIdentity = {
  id: 'redtone',
  name: 'REDTONE',
  blurb: 'A network operator’s tower estate, in their red on near-black.',
  logo,
  // The full wordmark, not a crop of it. CelcomDigi's rail carries a cropped mark
  // because their lockup has no legible form at 94px; `REDTONE` is seven letters
  // on one line and reads at 76px, which is what the design draws.
  mark,
  logoSize: {width: 240, height: 80},
  markSize: {width: 76, height: 26},
  theme: {
    // The `RED` half of the wordmark, eyedropped off the artwork itself rather
    // than quoted from a brand sheet nobody here has.
    brand: '#D3131E',
    // White. Near-black on a mid-red is the pairing that fails contrast at every
    // text size the buttons use.
    brandForeground: '#FFFFFF',
    // The ground the customer's own pages hang the wordmark on, and the design's
    // value for this rail.
    sidebar: '#070707',
    // No brand storage colour: the wordmark is two inks and neither is a plausible
    // charge colour — a red battery reads as a fault on a page whose whole job is
    // to say the bank is fine. The product's blue stands.
  },
  dataset: 'carrier',
};

export default REDTONE;
