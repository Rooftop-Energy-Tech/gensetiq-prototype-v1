/**
 * Which of a site's devices the page is reporting on.
 *
 * ## Why a string and not `{kind, id}`
 *
 * Because it is held in component state and compared against a list on every
 * render. A string compares with `===` and needs no memoised identity; an object
 * would need either a deep compare at each call site or a stable reference threaded
 * through the tree, for a value whose whole content is "which box did they click".
 *
 * ## Why only the genset carries an id
 *
 * A site has any number of sets and one monitoring unit of its own. So `site` is a
 * complete name and a set needs saying which. The `genset:` prefix is what keeps a
 * machine's own tag from ever reading as the yard.
 */
export type SiteDeviceKey = `genset:${string}` | 'site';

const GENSET_PREFIX = 'genset:';

export const gensetDeviceKey = (gensetId: string): SiteDeviceKey =>
  `${GENSET_PREFIX}${gensetId}`;

/** The set a `genset:` key names, or `undefined` for the yard itself. */
export const deviceGensetId = (device: SiteDeviceKey): string | undefined =>
  device.startsWith(GENSET_PREFIX) ? device.slice(GENSET_PREFIX.length) : undefined;
