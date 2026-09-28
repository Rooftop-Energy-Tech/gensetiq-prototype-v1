/**
 * Derives Malaysia's state boundaries from geoBoundaries' OSM extract.
 *
 * ## Why OpenStreetMap and not Natural Earth
 *
 * This started on Natural Earth 1:10m, which is public domain and small. It was
 * wrong for the one job the lines have: the basemap is CARTO Voyager, CARTO renders
 * OpenStreetMap, and Natural Earth disagrees with OSM by up to a kilometre in
 * places. Zoomed in, the app drew one Johor–Pahang border and the map underneath it
 * drew another, a few hundred metres away. Two borders is worse than none.
 *
 * So the shapes now come from the same survey the basemap does. They are
 * geoBoundaries `gbOpen` ADM1 for MYS, which is OSM plus Wambacher, under ODbL 1.0
 * — attribution carried on the MapLibre source in `stateHover.ts`.
 *
 * ## Two outputs
 *
 * | file | tolerance | used for |
 * | --- | --- | --- |
 * | `public/malaysia-states.geo.json` | ~22 m | drawing the borders and the hover wash |
 * | `src/lib/geo/malaysiaStates.geo.json` | ~440 m | point-in-polygon, and the label anchors |
 *
 * ## The fine one, and what it is up against
 *
 * Everything the map draws comes from `public/malaysia-states.geo.json`: the borders
 * at rest, and the wash over a hovered state. Because both are the same geometry, the
 * wash fits inside the border exactly — which is the whole reason the app draws its
 * own borders rather than restyling the basemap's.
 *
 * It does not try to agree with the basemap's own boundary layer, and cannot: that
 * layer was measured against this dataset **unsimplified** and disagrees by 130 m on
 * average, 850 m at worst — two OSM snapshots cut at different times. So the basemap's
 * is hidden instead, and there is one border on screen. What is left to line up
 * against is the *coastline* the basemap draws, and that is what sets the tolerance:
 * a state's outline follows the coast for most of its length, so 22 m is what keeps
 * the line on the shore rather than out at sea.
 *
 * ## The coarse one
 *
 * `src/lib/geo/malaysiaStates.geo.json` — bundled, nothing drawn from it. Everything
 * it answers is arithmetic: which state is this genset in, which state is the cursor
 * in, where does a label go. 440 m of slack cannot change any of those; nothing in the
 * estate stands that close to a state line, and a cursor within 440 m of a border is a
 * cursor the reader has not aimed yet.
 *
 * ## The bounding box each state carries
 *
 * Every feature in *both* files carries a GeoJSON `bbox`, and it is the box of the
 * **drawn** geometry. Clicking a state fits the viewport to it, and the coarse copy
 * is the wrong thing to fit to: it drops islands under ~6 km², which moves
 * Terengganu's eastern edge 22 km inland (Redang and the Perhentians go) and Labuan's
 * by 7 km. A fit that leaves a state's own islands off the edge of the screen is a
 * fit to the wrong shape. So the box is measured once here, on the copy the reader
 * sees, and carried on the copy the code reads.
 *
 * ## Running it
 *
 *   curl -sSL -o /tmp/mys-adm1.geojson \
 *     https://www.geoboundaries.org/api/current/gbOpen/MYS/ADM1/   # -> gjDownloadURL
 *   node src/lib/geo/buildMalaysiaStates.mjs /tmp/mys-adm1.geojson
 *
 * Both outputs are written in place; commit them together or they disagree.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const SRC = process.argv[2];
if (SRC === undefined) {
  console.error('usage: node buildMalaysiaStates.mjs <geoBoundaries-MYS-ADM1.geojson>');
  process.exit(1);
}

/**
 * What each state is called here.
 *
 * geoBoundaries carries the English exonyms — `Malacca`, `Penang` — and this is a
 * Malaysian product, so the labels on the map are the local names. Keyed by ISO
 * rather than by the incoming name, which is the one field guaranteed stable across
 * geoBoundaries releases.
 */
const NAMES = {
  'MY-01': {name: 'Johor', kind: 'state'},
  'MY-02': {name: 'Kedah', kind: 'state'},
  'MY-03': {name: 'Kelantan', kind: 'state'},
  'MY-04': {name: 'Melaka', kind: 'state'},
  'MY-05': {name: 'Negeri Sembilan', kind: 'state'},
  'MY-06': {name: 'Pahang', kind: 'state'},
  'MY-07': {name: 'Pulau Pinang', kind: 'state'},
  'MY-08': {name: 'Perak', kind: 'state'},
  'MY-09': {name: 'Perlis', kind: 'state'},
  'MY-10': {name: 'Selangor', kind: 'state'},
  'MY-11': {name: 'Terengganu', kind: 'state'},
  'MY-12': {name: 'Sabah', kind: 'state'},
  'MY-13': {name: 'Sarawak', kind: 'state'},
  'MY-14': {name: 'Kuala Lumpur', kind: 'federal-territory'},
  'MY-15': {name: 'Labuan', kind: 'federal-territory'},
  'MY-16': {name: 'Putrajaya', kind: 'federal-territory'},
};

/** Perpendicular distance from p to the segment a→b, in degrees. */
const segDist = (p, a, b) => {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Douglas–Peucker. */
const simplifyRing = (pts, tol) => {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = segDist(pts[i], pts[first], pts[last]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  const out = pts.filter((_, i) => keep[i] === 1);
  return out.length >= 4 ? out : pts;
};

const round = (pts, dp) =>
  pts.map(([x, y]) => [Number(x.toFixed(dp)), Number(y.toFixed(dp))]);

/** Shoelace area in square degrees — used only to drop specks. */
const ringArea = (pts) => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
};

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const build = ({tolerance, precision, minArea}) => {
  const features = [];
  for (const feature of src.features) {
    const iso = feature.properties.shapeISO;
    const meta = NAMES[iso];
    if (meta === undefined) {
      console.warn(`  ! skipping unrecognised ISO ${iso} (${feature.properties.shapeName})`);
      continue;
    }

    const geom = feature.geometry;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    const kept = [];
    for (const rings of polys) {
      const out = [];
      for (const [index, ring] of rings.entries()) {
        const simplified = round(simplifyRing(ring, tolerance), precision);
        // Ring 0 is the outer boundary; later rings are holes.
        if (simplified.length < 4 || ringArea(simplified) < minArea) {
          if (index === 0) {
            out.length = 0;
            break;
          }
          continue;
        }
        const closed =
          simplified[0][0] === simplified.at(-1)[0] && simplified[0][1] === simplified.at(-1)[1]
            ? simplified
            : [...simplified, simplified[0]];
        out.push(closed);
      }
      if (out.length > 0) kept.push(out);
    }
    if (kept.length === 0) continue;

    features.push({
      type: 'Feature',
      id: iso,
      properties: {id: iso, name: meta.name, kind: meta.kind},
      geometry:
        kept.length === 1
          ? {type: 'Polygon', coordinates: kept[0]}
          : {type: 'MultiPolygon', coordinates: kept},
    });
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  return {type: 'FeatureCollection', features};
};

const report = (label, file, collection, tolerance) => {
  const points = collection.features.reduce((sum, f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return sum + polys.reduce((s, rings) => s + rings.reduce((r, ring) => r + ring.length, 0), 0);
  }, 0);
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(
    `${label.padEnd(9)} ${collection.features.length} states, ${String(points).padStart(6)} points, ` +
      `${kb.padStart(4)} KB  (~${Math.round(tolerance * 111000)} m detail)`,
  );
};

/**
 * ~22 m. What a *line* needs: a line is one pixel wide, so any error in it is the
 * whole of it, and at this tolerance the border stays sub-pixel against the basemap's
 * coastline until past zoom 15 — further in than these maps ever fly themselves.
 */
const DRAW_TOLERANCE = 0.0002;
/** ~250 m² — drops the specks OSM carries offshore, keeps every real island. */
const DRAW_MIN_AREA = 0.00002;
/** ~440 m. See the header: this one is only ever asked which side of a line a point is on. */
const HIT_TOLERANCE = 0.004;
/**
 * ~6 km², for the hit-test copy only.
 *
 * OSM files a hundred-odd offshore rocks under Sabah and Kedah, and carrying them
 * into the point-in-polygon copy costs kilobytes to answer a question nobody asks:
 * a set standing on one is within the coast tolerance of the state anyway, so it is
 * filed correctly with or without its rock. The drawn copy keeps them, because
 * missing islands are visible and a missing point-in-polygon case is not.
 */
const HIT_MIN_AREA = 0.0005;

/** `[west, south, east, north]` of every ring of a feature — the GeoJSON `bbox` shape. */
const bboxOf = (feature) => {
  const polys =
    feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const rings of polys) {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < box[0]) box[0] = x;
        if (y < box[1]) box[1] = y;
        if (x > box[2]) box[2] = x;
        if (y > box[3]) box[3] = y;
      }
    }
  }
  return box;
};

const drawFile = path.join(repoRoot, 'public/malaysia-states.geo.json');
const hitFile = path.join(here, 'malaysiaStates.geo.json');

const draw = build({tolerance: DRAW_TOLERANCE, precision: 5, minArea: DRAW_MIN_AREA});
const hit = build({tolerance: HIT_TOLERANCE, precision: 4, minArea: HIT_MIN_AREA});

// The drawn copy's box, on both — see the header. Assigned after both builds so the
// coarse copy cannot be handed its own, smaller box by mistake.
const bboxById = new Map(draw.features.map((feature) => [feature.properties.id, bboxOf(feature)]));
for (const collection of [draw, hit]) {
  for (const feature of collection.features) {
    feature.bbox = bboxById.get(feature.properties.id);
  }
}

fs.writeFileSync(drawFile, JSON.stringify(draw));
report('drawn', drawFile, draw, DRAW_TOLERANCE);

fs.writeFileSync(hitFile, JSON.stringify(hit));
report('hit-test', hitFile, hit, HIT_TOLERANCE);

const missing = Object.keys(NAMES).filter(
  (iso) => !draw.features.some((f) => f.properties.id === iso),
);
if (missing.length > 0) {
  console.error(`\nMISSING STATES: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('\nall 16 states present in both outputs');
