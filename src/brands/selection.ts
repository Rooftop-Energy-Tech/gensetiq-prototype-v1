import {BRAND_IDS} from './types';
import type {BrandId} from './types';

/**
 * The brand a reader picked in Settings, if they picked one.
 *
 * ## Why switching reloads the page
 *
 * Because a brand is not only colours. It names a **dataset**, and the site and
 * genset modules build their whole graph once at module load — `GENSETS`,
 * `SITE_SEED`, and every summary, economic and hybrid figure derived from them.
 * That is deliberate and stated in `siteConfig.ts`: built once "so two sites cannot
 * report figures from different moments".
 *
 * A live swap would have to tear that graph down and rebuild it mid-render, and the
 * failure mode is not a crash — it is a screen showing one estate's site names over
 * another estate's totals for a frame or two. Nobody would notice in review and
 * everybody would notice in a demo.
 *
 * So the choice is persisted and the page reloads. Every part of the brand — rail
 * colour, marks, tab title, the estate itself — comes back from one resolution, and
 * there is no state that is half-switched. A reload on a prototype with no backend
 * costs about as long as the click.
 *
 * ## Why this is separate from `active.ts`
 *
 * `active.ts` resolves the brand and is imported by `identity.ts`, which is on the
 * pre-paint path. It needs the *read* and nothing else. The write, the reload and
 * the picker's questions live here, so the resolution stays a few lines that cannot
 * throw for an interesting reason.
 */

const STORAGE_KEY = 'gensetiq.brand';

const isBrandId = (value: string): value is BrandId =>
  (BRAND_IDS as ReadonlyArray<string>).includes(value);

/**
 * The stored override, or `undefined`.
 *
 * Every failure is the same answer: no override. A private-mode `localStorage`
 * *throws* on access rather than returning null, and a value written by an earlier
 * version might name a brand that no longer exists — neither is worth taking the
 * app down for when "use the build's own brand" is a complete, correct fallback.
 *
 * A stale value is cleared rather than merely ignored, so a reader who once picked a
 * since-removed brand stops carrying a key that does nothing.
 */
export const storedBrandId = (): BrandId | undefined => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }

  if (raw === null) return undefined;
  if (isBrandId(raw)) return raw;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to do — it is already being ignored. */
  }
  return undefined;
};

/**
 * Pick a brand, or pass `undefined` to go back to the one the build was compiled
 * as. Reloads either way — see the header.
 */
export const setStoredBrandId = (id: BrandId | undefined): void => {
  try {
    if (id === undefined) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode. Reloading anyway would drop the reader back on the brand they
    // started from with no explanation, so say nothing changed and let the caller's
    // radio snap back.
    return;
  }

  window.location.reload();
};
