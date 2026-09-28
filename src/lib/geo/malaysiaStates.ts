import type {ExpressionSpecification} from 'maplibre-gl';

import collection from './malaysiaStates.geo.json';

/**
 * Malaysia's thirteen states and three federal territories, as polygons.
 *
 * ## Why the shapes are in the repo rather than fetched
 *
 * The same reason the basemap is CARTO's: this prototype has to come up on a fresh
 * clone with nothing configured and no account anywhere. A boundary service would
 * be one more thing to be down, rate-limited or newly requiring a token on the
 * morning of a demo.
 *
 * ## Why OpenStreetMap
 *
 * These were Natural Earth 1:10m to begin with — public domain, and small. Wrong
 * survey: CARTO renders OpenStreetMap, and Natural Earth disagrees with OSM by up
 * to a kilometre. Zoomed in, the app drew one Johor–Pahang border and the basemap
 * underneath drew another a few hundred metres off, which is worse than drawing
 * none. So the shapes now come from geoBoundaries `gbOpen` ADM1 for MYS — OSM under
 * ODbL 1.0, attributed on the source in `stateHover.ts`.
 *
 * ## Nothing on screen is drawn from this
 *
 * What the reader sees — the borders, and the wash over a hovered state — is drawn
 * from `public/malaysia-states.geo.json`, the same extract at ~22 m, which MapLibre
 * fetches by URL (see `stateHover.ts`). This copy is arithmetic only: which state a
 * genset stands in, which state the cursor is in, and where each state's label is
 * anchored. ~440 m of slack cannot change any of those answers.
 *
 * The one thing it carries that is *not* coarse is each feature's `bbox`, which the
 * build script measures on the drawn copy. Clicking a state fits the viewport to that
 * box, and this copy's own extent would be the wrong one to fit: it has shed every
 * island under ~6 km², which puts its east edge of Terengganu 22 km inland of Redang.
 *
 * Re-run `buildMalaysiaStates.mjs` against a newer geoBoundaries release to refresh.
 *
 * ## What the ids are
 *
 * ISO 3166-2 (`MY-01` … `MY-16`), not Natural Earth's own row ids, so the key is
 * one somebody else's data can also be keyed by if a real boundary/asset join ever
 * lands. `kind` separates the thirteen states from Kuala Lumpur, Labuan and
 * Putrajaya, which are federal territories — nothing reads it yet, but the
 * distinction is free to carry and expensive to add back later.
 */
export const MALAYSIA_STATES = collection as GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  MalaysiaStateProperties
>;

export type MalaysiaStateProperties = {
  id: string;
  name: string;
  kind: 'state' | 'federal-territory';
};

/** Every state id, in the collection's own (alphabetical by name) order. */
export const MALAYSIA_STATE_IDS: Array<string> = MALAYSIA_STATES.features.map(
  (feature) => feature.properties.id,
);

const nameById = new Map(
  MALAYSIA_STATES.features.map((feature) => [feature.properties.id, feature.properties.name]),
);

/** Display name for a state id, or `undefined` for an id that isn't one. */
export const malaysiaStateName = (id: string): string | undefined => nameById.get(id);

const ringsOf = (
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): Array<GeoJSON.Position[][]> =>
  feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;

/**
 * Ray casting — the crossing-number test. Counts how many times a ray east from
 * the point crosses the ring; odd means inside.
 */
const inRing = (lon: number, lat: number, ring: GeoJSON.Position[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Inside the outer ring and outside every hole. */
const inPolygon = (lon: number, lat: number, rings: GeoJSON.Position[][]): boolean =>
  inRing(lon, lat, rings[0] as GeoJSON.Position[]) &&
  !rings.slice(1).some((hole) => inRing(lon, lat, hole));

/** Distance from a point to the segment a→b, in degrees. */
const segmentDistance = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => {
  let x = ax;
  let y = ay;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = bx;
      y = by;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  return Math.hypot(px - x, py - y);
};

const distanceToFeature = (
  lon: number,
  lat: number,
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): number => {
  let best = Infinity;
  for (const rings of ringsOf(feature)) {
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [ax, ay] = ring[j] as [number, number];
        const [bx, by] = ring[i] as [number, number];
        best = Math.min(best, segmentDistance(lon, lat, ax, ay, bx, by));
      }
    }
  }
  return best;
};

/**
 * How far offshore a site may sit and still be counted as standing in the state it
 * is obviously standing in, in degrees (~5.5 km).
 *
 * This is not a fudge factor, it is the coastline's error bar. A coastline is a
 * generalisation, and a tower on reclaimed land or at a river mouth can fall the
 * wrong side of it — in which case it is stateless, every state counts it nowhere,
 * and hovering Sabah dims a pin that is visibly inside Sabah.
 *
 * How much it is carrying is a measure of the dataset: fifteen of the estate's sites
 * needed it under Natural Earth's 1:10m coast; one needs it under OSM.
 *
 * Deliberately smaller than the narrowest gap between two Malaysian states, so it
 * can only ever rescue a point from the sea — never move one across a land border.
 */
const COAST_TOLERANCE = 0.05;

type Bounds = {west: number; south: number; east: number; north: number};

/**
 * One bounding box per state, read from the `bbox` the build script wrote.
 *
 * It does two jobs. For the hit test it is the cheap first question — "no, not this
 * one" costs four comparisons instead of walking a coastline, which matters because
 * this is asked on `mousemove`. For the click it is the frame: what the viewport is
 * fitted to. The second job is why it is read rather than measured — see
 * `malaysiaStateBounds`. It is a superset of this copy's own extent, which for the
 * first job only means a handful more polygon tests along the east coast.
 *
 * A collection without the boxes is a collection the build script did not write, and
 * that is worth failing on at load rather than at the first click.
 */
const boundsById = new Map<string, Bounds>(
  MALAYSIA_STATES.features.map((feature) => {
    const box = feature.bbox;
    if (box === undefined || box.length !== 4) {
      throw new Error(
        `malaysiaStates.geo.json: ${feature.properties.id} has no bbox — rebuild with buildMalaysiaStates.mjs`,
      );
    }
    const [west, south, east, north] = box;
    return [feature.properties.id, {west, south, east, north}];
  }),
);

/**
 * The box to fit the viewport to when a state is clicked, as MapLibre's
 * `[[west, south], [east, north]]` — or `undefined` for an id that isn't a state.
 *
 * Measured on the drawn copy, by the build script, and carried here as each
 * feature's `bbox`. This copy's own extent would be the wrong one: it has shed every
 * island under ~6 km², which runs its east edge of Terengganu 22 km short of Redang
 * and the Perhentians and its box of Labuan 7 km short. A fit that leaves a state's
 * own islands off the edge of the screen is a fit to the wrong shape.
 */
export const malaysiaStateBounds = (
  id: string,
): [[number, number], [number, number]] | undefined => {
  const bounds = boundsById.get(id);
  return bounds === undefined
    ? undefined
    : [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ];
};

const withinBounds = (lon: number, lat: number, bounds: Bounds, pad = 0): boolean =>
  lon >= bounds.west - pad &&
  lon <= bounds.east + pad &&
  lat >= bounds.south - pad &&
  lat <= bounds.north + pad;

/**
 * Answers keyed by rounded coordinate. The estate is static, so the ~120 site
 * lookups every data push makes are the same ~120 questions each time.
 *
 * Bounded because the other caller is `mousemove`, which invents a new coordinate
 * several times a second and would otherwise grow this without limit for the life
 * of the page. Clearing wholesale rather than evicting least-recently-used: the
 * site answers are cheap to rebuild and an LRU is more bookkeeping than the thing
 * it is protecting.
 */
const CACHE_LIMIT = 4096;
const cache = new Map<string, string | undefined>();

/**
 * Which state a coordinate stands in, as an ISO id — `undefined` out at sea or
 * over another country.
 *
 * Point-in-polygon first; the nearest state within `COAST_TOLERANCE` if that
 * misses. Memoised on the rounded coordinate because the estate is static and every
 * map asks the same ~120 questions on every data push.
 */
export const malaysiaStateAt = (lon: number, lat: number): string | undefined => {
  const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit !== undefined || cache.has(key)) return hit;

  let answer: string | undefined;
  for (const feature of MALAYSIA_STATES.features) {
    const bounds = boundsById.get(feature.properties.id);
    if (bounds === undefined || !withinBounds(lon, lat, bounds)) continue;
    if (ringsOf(feature).some((rings) => inPolygon(lon, lat, rings))) {
      answer = feature.properties.id;
      break;
    }
  }

  if (answer === undefined) {
    let nearest: string | undefined;
    let nearestDistance = COAST_TOLERANCE;
    for (const feature of MALAYSIA_STATES.features) {
      const bounds = boundsById.get(feature.properties.id);
      if (bounds === undefined || !withinBounds(lon, lat, bounds, COAST_TOLERANCE)) continue;
      const distance = distanceToFeature(lon, lat, feature);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = feature.properties.id;
      }
    }
    answer = nearest;
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, answer);
  return answer;
};

/**
 * Centroid of one ring, with the area it was weighted by, by the shoelace formula.
 */
const ringCentroid = (ring: GeoJSON.Position[]): {x: number; y: number; area: number} => {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    const cross = xj * yi - xi * yj;
    a += cross;
    x += (xj + xi) * cross;
    y += (yj + yi) * cross;
  }
  a *= 0.5;
  if (a === 0) {
    const [fx, fy] = ring[0] as [number, number];
    return {x: fx, y: fy, area: 0};
  }
  return {x: x / (6 * a), y: y / (6 * a), area: Math.abs(a)};
};

/**
 * One point per state, at the centre of all the land that state is made of — where
 * its name and count are drawn.
 *
 * ## Why this is a source of its own
 *
 * A `symbol` layer over the polygons draws **one label per part**, and seven of the
 * sixteen states are multi-part: Sabah is eight pieces, so it wrote its name eight
 * times, once on each offshore island. Labelling a separate point source is what
 * makes "one state, one label" structural rather than something collision detection
 * is asked to clean up afterwards.
 *
 * ## Where the point is
 *
 * The area-weighted centroid across every part — the balance point of the whole
 * state, islands included, not the middle of its biggest landmass. Penang is the
 * case that shows the difference: it is 71% mainland and 29% island, and its centre
 * sits between them rather than deep in Seberang Perai.
 *
 * All sixteen land on solid ground, which is checked rather than assumed — a
 * balance point can perfectly well fall in the water for a crescent or a scattered
 * archipelago, and this collection simply has none of that shape. If a future
 * Natural Earth release moves one into the sea, this is the comment that says so.
 *
 * Holes are ignored in the weighting. Malaysia's state polygons have almost none,
 * and the largest is far too small to move a centre by a pixel at any zoom this map
 * reaches.
 */
export const MALAYSIA_STATE_LABEL_POINTS: GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {id: string; name: string}
> = {
  type: 'FeatureCollection',
  features: MALAYSIA_STATES.features.map((feature) => {
    let x = 0;
    let y = 0;
    let weight = 0;
    for (const rings of ringsOf(feature)) {
      const centroid = ringCentroid(rings[0] as GeoJSON.Position[]);
      x += centroid.x * centroid.area;
      y += centroid.y * centroid.area;
      weight += centroid.area;
    }
    return {
      type: 'Feature' as const,
      id: feature.properties.id,
      geometry: {type: 'Point' as const, coordinates: [x / weight, y / weight]},
      properties: {id: feature.properties.id, name: feature.properties.name},
    };
  }),
};

/**
 * The cluster property that carries how many of a bubble's members stand in one
 * state. Prefixed so it can't collide with the run-state and severity counts the
 * maps already accumulate.
 */
export const stateClusterKey = (stateId: string): string => `mys_${stateId}`;

/**
 * Per-state member counts, to spread into a clustered source's `clusterProperties`.
 *
 * Sixteen extra sums on a source of ~120 points is nothing, and it buys the one
 * thing the hover needs that nothing else can give it: a cluster bubble knows
 * whether *any* of what it swallowed stands in the hovered state. Judging a bubble
 * by its own centroid instead would get every cluster that straddles a border
 * wrong, and the Klang Valley — four states inside one bubble at low zoom — is
 * exactly where the question gets asked.
 */
export const MALAYSIA_STATE_CLUSTER_PROPERTIES: Record<string, ExpressionSpecification> =
  Object.fromEntries(
    MALAYSIA_STATE_IDS.map((id) => [
      stateClusterKey(id),
      ['+', ['case', ['==', ['get', 'stateId'], id], 1, 0]] as ExpressionSpecification,
    ]),
  );
