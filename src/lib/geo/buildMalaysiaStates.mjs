/**
 * Derives Malaysia's state boundaries from OpenStreetMap as it stands today, by way of
 * `fetchOsmStates.py` (2026-10-01).
 *
 * ## Why OpenStreetMap and not Natural Earth
 *
 * This started on Natural Earth 1:10m, which is public domain and small. It was
 * wrong for the one job the lines have: the basemap is CARTO Voyager, CARTO renders
 * OpenStreetMap, and Natural Earth disagrees with OSM by up to a kilometre in
 * places. Zoomed in, the app drew one Johor–Pahang border and the map underneath it
 * drew another, a few hundred metres away. Two borders is worse than none.
 *
 * So the shapes now come from the same survey the basemap does. They were geoBoundaries
 * `gbOpen` ADM1 for MYS until 2026-10-01, which is OSM as it stood in 2017; they are now
 * OSM's own state relations, fetched fresh and cut to OSM's land polygons — the data
 * the basemap's sea is cut from — under ODbL 1.0, attribution carried on the MapLibre
 * source in `stateHover.ts`.
 *
 * ## The polygons
 *
 * | file | tolerance | used for |
 * | --- | --- | --- |
 * | `public/malaysia-states.geo.json` | ~22 m | the hover wash, and telling Malaysia's shore from a neighbour's |
 * | `src/lib/geo/malaysiaStates.geo.json` | ~440 m | point-in-polygon, and the label anchors |
 *
 * ## The fine one, and what it is up against
 *
 * The wash over a hovered state comes from `public/malaysia-states.geo.json`, and the
 * borders around it are cut from the same outlines (below), so the wash fits inside
 * the border exactly — which is the whole reason the app draws its own borders rather
 * than restyling the basemap's.
 *
 * It does not try to agree with the basemap's own boundary layer: against the 2017
 * shapes that layer disagreed by 130 m on average and 850 m at worst, two OSM
 * snapshots cut at different times. Both are now recent OSM, but the basemap's is
 * still hidden, so there is one border on screen whatever its tiles' age. 22 m keeps a one-pixel line
 * true to the survey until past zoom 15.
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
 * ## The lines, and why the coast is not among them (2026-09-30)
 *
 * The polygons' coast was OSM's coast in 2017, and the basemap's is today's: Penang,
 * Melaka and Johor have reclaimed land since, and elsewhere the two drifted a hundred
 * metres apart. The polygons are now cut to today's land, but the map still draws no
 * coast from this data: the basemap's sea edge is the one on screen. It
 * strokes the basemap's own sea edge at runtime (`coastline.ts`), and from here takes
 * only the lines the basemap has no copy of:
 *
 * | file | holds |
 * | --- | --- |
 * | `public/malaysia-state-borders.geo.json` | every border between two states, and Malaysia's land borders, each drawn once |
 * | `public/malaysia-state-shores.geo.json` | each state's own coast, with how far past it the wash may reach |
 * | `public/malaysia-neighbours.geo.json` | the other countries' outlines within 6 km of Malaysia, never drawn |
 *
 * Each outline segment is sorted by what lies on its far side: another state (within
 * 25 m of that state's outline), another country (within 60 m of Malaysia's land
 * border, the non-maritime ways of OSM relation 2108121), or else the sea. Only the first two are kept. Where one of them reaches the coast it is
 * carried 1 km further out, and the map hides the part that lands in the sea under the
 * basemap's own ocean, so the line stops exactly where the basemap's shore does.
 *
 * The neighbours' outlines are their land within 7 km of Malaysia, from the same land
 * polygons, and let `coastline.ts` tell whose shore a stretch of sea edge is: the Johor Strait is 600 m wide at the Causeway, and only its northern bank is
 * Malaysia's.
 *
 * ## Running it
 *
 *   # writes osm-MYS-ADM1, malaysia-land-border and neighbours-land into <folder>;
 *   # its header has the land-polygon download and the Python it needs
 *   python src/lib/geo/fetchOsmStates.py land_polygons.shp <folder>
 *   node src/lib/geo/buildMalaysiaStates.mjs <folder>
 *
 * All five outputs are written in place; commit them together or they disagree.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const NEIGHBOURS_DIR = process.argv[2];
if (NEIGHBOURS_DIR === undefined) {
  console.error('usage: node buildMalaysiaStates.mjs <fetchOsmStates-output-dir>');
  process.exit(1);
}
const SRC = path.join(NEIGHBOURS_DIR, 'osm-MYS-ADM1.geojson');

/**
 * What each state is called here.
 *
 * OSM's `name:en` carries the English exonyms — `Malacca`, `Penang` — and this is a
 * Malaysian product, so the labels on the map are the local names. Keyed by ISO
 * rather than by the incoming name, which is the one field guaranteed stable across
 * downloads.
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
 * whole of it, and at this tolerance a border stays sub-pixel true to the survey until
 * past zoom 15 — further in than these maps ever fly themselves.
 */
const DRAW_TOLERANCE = 0.0002;
/** ~250 m² — drops the specks OSM carries offshore, keeps every real island. */
const DRAW_MIN_AREA = 0.00000002;
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

/** Metres from p to the segment a→b, flat-earth, which is exact enough under 10 km. */
const metres = (p, a, b) => {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = a[0] * k;
  const bx = b[0] * k;
  const px = p[0] * k;
  const dx = bx - ax;
  const dy = b[1] - a[1];
  let x = ax;
  let y = a[1];
  if (dx !== 0 || dy !== 0) {
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    x += t * dx;
    y += t * dy;
  }
  return Math.hypot(px - x, p[1] - y) * 111320;
};

/** Segments bucketed on a 0.01° grid, so "what is within 60 m" reads nine cells. */
const segmentIndex = (cell = 0.01) => {
  const grid = new Map();
  const at = (x, y) => `${x},${y}`;
  return {
    add(a, b, tag) {
      for (let x = Math.floor(Math.min(a[0], b[0]) / cell); x <= Math.floor(Math.max(a[0], b[0]) / cell); x += 1) {
        for (let y = Math.floor(Math.min(a[1], b[1]) / cell); y <= Math.floor(Math.max(a[1], b[1]) / cell); y += 1) {
          const bucket = grid.get(at(x, y)) ?? [];
          bucket.push([a, b, tag]);
          grid.set(at(x, y), bucket);
        }
      }
    },
    /**
     * The nearest segment not tagged `skip`, as `[metres, tag]`, searching `reach` cells
     * out. With `enough`, the first segment closer than that is answer enough.
     */
    nearest(p, skip, reach = 1, enough = 0) {
      let best = Infinity;
      let tag;
      const cx = Math.floor(p[0] / cell);
      const cy = Math.floor(p[1] / cell);
      for (let x = cx - reach; x <= cx + reach; x += 1) {
        for (let y = cy - reach; y <= cy + reach; y += 1) {
          for (const [a, b, t] of grid.get(at(x, y)) ?? []) {
            if (t === skip) continue;
            const d = metres(p, a, b);
            if (d < best) {
              best = d;
              tag = t;
              if (d < enough) return [best, tag];
            }
          }
        }
      }
      return [best, tag];
    },
  };
};

const ringsOf = (geometry) =>
  (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat();
const readNeighbour = (name) => JSON.parse(fs.readFileSync(path.join(NEIGHBOURS_DIR, name), 'utf8'));
/** Whether a point is anywhere near Malaysia: its box, with a degree to spare. */
const inRegion = ([x, y]) => x > 98.5 && x < 120.5 && y > -0.2 && y < 8.5;

/** Two outlines this close are one border, surveyed twice. See the histogram in the header. */
const SAME_STATE_BORDER = 25;
const SAME_COUNTRY_BORDER = 60;
/** How far a border that reaches the coast is carried out to sea, for the ocean to trim. */
const OUT_TO_SEA = 1000;
/** How far from Malaysia's coast another country's outline is still worth shipping. */
const NEIGHBOUR_REACH = 6000;

const states = segmentIndex();
for (const feature of src.features) {
  for (const ring of ringsOf(feature.geometry)) {
    for (let i = 1; i < ring.length; i += 1) states.add(ring[i - 1], ring[i], feature.properties.shapeISO);
  }
}

const landBorders = segmentIndex();
const addLandBorder = (coordinates) => {
  for (let i = 1; i < coordinates.length; i += 1) {
    if (inRegion(coordinates[i])) landBorders.add(coordinates[i - 1], coordinates[i], 'country');
  }
};
for (const feature of readNeighbour('malaysia-land-border.geojson').features) {
  addLandBorder(feature.geometry.coordinates);
}

/**
 * What lies across each segment of a state's outline.
 *
 * `state` and `twin` are the same border seen from its two sides; only the side with
 * the lower ISO code keeps it, so every internal border is drawn once.
 */
const classify = (ring, iso) => {
  const kinds = [];
  for (let i = 1; i < ring.length; i += 1) {
    const mid = [(ring[i - 1][0] + ring[i][0]) / 2, (ring[i - 1][1] + ring[i][1]) / 2];
    const [toState, other] = states.nearest(mid, iso);
    if (toState < SAME_STATE_BORDER) kinds.push(iso < other ? 'state' : 'twin');
    else if (landBorders.nearest(mid)[0] < SAME_COUNTRY_BORDER) kinds.push('country');
    else kinds.push('coast');
  }
  return kinds;
};

/** `from` pushed `distance` metres further along the direction `toward → from`. */
const carryOn = (from, toward, distance) => {
  const k = Math.cos((from[1] * Math.PI) / 180);
  const dx = (from[0] - toward[0]) * k;
  const dy = from[1] - toward[1];
  const length = Math.hypot(dx, dy) * 111320;
  if (length === 0) return from;
  return [from[0] + (dx / k) * (distance / length), from[1] + dy * (distance / length)];
};

/** A point roughly `distance` metres back along `line` from its end, for a stable heading. */
const pointBack = (line, distance) => {
  let walked = 0;
  for (let i = line.length - 1; i > 0; i -= 1) {
    walked += metres(line[i], line[i - 1], line[i - 1]);
    if (walked >= distance) return line[i - 1];
  }
  return line[0];
};

const borderLines = {state: [], country: []};
/** Each state's own coast, for the wash's band out to the basemap's shore. */
const coastRuns = [];
for (const feature of src.features) {
  const iso = feature.properties.shapeISO;
  if (NAMES[iso] === undefined) continue;
  for (const ring of ringsOf(feature.geometry)) {
    const kinds = classify(ring, iso);
    const n = kinds.length;
    const kept = (kind) => kind === 'state' || kind === 'country';
    if (kinds.every((kind) => kind === kinds[0])) {
      if (kept(kinds[0])) borderLines[kinds[0]].push(round(simplifyRing(ring, DRAW_TOLERANCE), 5));
      if (kinds[0] === 'coast') coastRuns.push({iso, line: ring});
      continue;
    }
    // Start the walk at a change of kind, so no run wraps around the ring's seam.
    const start = kinds.findIndex((kind, i) => kind !== kinds[(i - 1 + n) % n]);
    for (let offset = 0; offset < n; ) {
      const first = (start + offset) % n;
      const kind = kinds[first];
      let length = 1;
      while (length < n && kinds[(first + length) % n] === kind) length += 1;
      if (kept(kind)) {
        let line = [];
        for (let i = 0; i <= length; i += 1) line.push(ring[(first + i) % n]);
        line = simplifyRing(line, DRAW_TOLERANCE);
        if (kinds[(first - 1 + n) % n] === 'coast') {
          line.unshift(carryOn(line[0], pointBack([...line].reverse(), 200), OUT_TO_SEA));
        }
        if (kinds[(first + length) % n] === 'coast') {
          line.push(carryOn(line.at(-1), pointBack(line, 200), OUT_TO_SEA));
        }
        borderLines[kind].push(round(line, 5));
      } else if (kind === 'coast') {
        const line = [];
        for (let i = 0; i <= length; i += 1) line.push(ring[(first + i) % n]);
        coastRuns.push({iso, line});
      }
      offset += length;
    }
  }
}

const bordersFile = path.join(repoRoot, 'public/malaysia-state-borders.geo.json');
fs.writeFileSync(
  bordersFile,
  JSON.stringify({
    type: 'FeatureCollection',
    features: Object.entries(borderLines).map(([kind, lines]) => ({
      type: 'Feature',
      properties: {kind},
      geometry: {type: 'MultiLineString', coordinates: lines},
    })),
  }),
);

const outline = segmentIndex(0.05);
for (const feature of src.features) {
  for (const ring of ringsOf(feature.geometry)) {
    for (let i = 1; i < ring.length; i += 1) outline.add(ring[i - 1], ring[i], 'MY');
  }
}
const neighbourLines = [];
{
  for (const feature of readNeighbour('neighbours-land.geojson').features) {
    for (const ring of ringsOf(feature.geometry)) {
      let run = [];
      const flush = () => {
        if (run.length > 1) neighbourLines.push(round(simplifyRing(run, DRAW_TOLERANCE), 5));
        run = [];
      };
      for (const point of ring) {
        const near =
          inRegion(point) &&
          outline.nearest(point, undefined, 3, NEIGHBOUR_REACH)[0] < NEIGHBOUR_REACH;
        if (near) run.push(point);
        else flush();
      }
      flush();
    }
  }
}
const neighboursFile = path.join(repoRoot, 'public/malaysia-neighbours.geo.json');
fs.writeFileSync(
  neighboursFile,
  JSON.stringify({
    type: 'Feature',
    properties: {},
    geometry: {type: 'MultiLineString', coordinates: neighbourLines},
  }),
);

/**
 * The wash's reach past each state's coast, so it covers land the basemap has and OSM
 * did not when these were cut (reclaimed land, in 2017's shapes).
 *
 * The map draws each run as a band `2 × reach` wide in the wash colour, under the
 * basemap's water, so the sea trims it to today's shore. The reach is 1.5 km, the
 * most Penang, Melaka and Forest City have been built out, but never more than
 * 0.45 of the way to another state or country: across the Johor Strait the band
 * would otherwise wash Singapore's shore when Johor is hovered.
 */
const SHORE_REACH = 1500;
const SHORE_STEPS = [1500, 800, 400, 200];
const SHORE_TOLERANCE = 0.0005;
const others = segmentIndex();
for (const line of neighbourLines) {
  for (let i = 1; i < line.length; i += 1) others.add(line[i - 1], line[i], 'other');
}
const reachAt = (point, iso) => {
  const room = Math.min(states.nearest(point, iso, 4)[0], others.nearest(point, undefined, 4)[0]);
  const reach = Math.min(SHORE_REACH, room * 0.45);
  return SHORE_STEPS.find((step) => step <= reach) ?? 0;
};
const shores = new Map();
for (const {iso, line} of coastRuns) {
  const simple = simplifyRing(line, SHORE_TOLERANCE);
  let piece = [];
  let pieceReach;
  const flush = () => {
    if (piece.length > 1 && pieceReach > 0) {
      const key = `${iso} ${pieceReach}`;
      shores.set(key, [...(shores.get(key) ?? []), round(piece, 4)]);
    }
  };
  for (const point of simple) {
    const reach = reachAt(point, iso);
    if (reach !== pieceReach) {
      // The vertex where the reach changes ends one piece and starts the next.
      if (piece.length > 0) piece.push(point);
      flush();
      piece = [];
      pieceReach = reach;
    }
    piece.push(point);
  }
  flush();
}
const shoresFile = path.join(repoRoot, 'public/malaysia-state-shores.geo.json');
fs.writeFileSync(
  shoresFile,
  JSON.stringify({
    type: 'FeatureCollection',
    features: [...shores].map(([key, lines]) => {
      const [id, reach] = key.split(' ');
      return {
        type: 'Feature',
        properties: {id, reach: Number(reach)},
        geometry: {type: 'MultiLineString', coordinates: lines},
      };
    }),
  }),
);

const pointCount = (lines) => lines.reduce((sum, line) => sum + line.length, 0);
const kb = (file) => (fs.statSync(file).size / 1024).toFixed(0);
console.log(
  `borders   ${borderLines.state.length} state lines, ${borderLines.country.length} country lines, ` +
    `${pointCount([...borderLines.state, ...borderLines.country])} points, ${kb(bordersFile)} KB`,
);
console.log(
  `shores    ${shores.size} features, ${pointCount([...shores.values()].flat())} points, ${kb(shoresFile)} KB`,
);
console.log(`neighbours ${neighbourLines.length} lines, ${pointCount(neighbourLines)} points, ${kb(neighboursFile)} KB`);

const missing = Object.keys(NAMES).filter(
  (iso) => !draw.features.some((f) => f.properties.id === iso),
);
if (missing.length > 0) {
  console.error(`\nMISSING STATES: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('\nall 16 states present in both outputs');
