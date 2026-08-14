/**
 * A stable 0–1 from a string.
 *
 * FNV-1a, because it is four lines and has no dependencies. The point is not
 * distribution quality — it is that `spread('brf9540', 'load')` returns the same
 * number in every render, in every tab, forever, so a genset's page does not
 * reshuffle itself when React re-renders or the user hits back.
 *
 * It lives in its own file rather than inside `detail.ts` because `history.ts`
 * has to draw from the *same* generator. Two hash functions would mean a unit's
 * run log and its readings were seeded independently, and the pair would drift
 * apart on every reload — which is the one thing this whole data layer exists to
 * prevent.
 */
export const spread = (id: string, salt: string): number => {
  let hash = 0x81_1c_9d_c5;
  for (const char of `${id}:${salt}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
};

/** `spread()` mapped onto a range — the form most callers actually want. */
export const spreadBetween = (id: string, salt: string, min: number, max: number): number =>
  min + spread(id, salt) * (max - min);
