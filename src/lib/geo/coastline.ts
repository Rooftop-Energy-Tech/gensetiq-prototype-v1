import type maplibregl from 'maplibre-gl';

/**
 * Malaysia's coast, traced off the basemap's own sea at whatever zoom is on screen
 * (2026-09-30).
 *
 * The state polygons carry a coast too. It was OSM's in 2017 until 2026-10-01, and even
 * cut to today's land it is fixed at one detail where the basemap's is generalised
 * afresh at every zoom. Drawn from the polygons, the line cut
 * across Penang's reclaimed land and ran a hundred metres off the Johor shore. Traced
 * from the ocean polygons in the tiles the reader is looking at, it cannot be off:
 * it is the edge of the blue.
 *
 * ## Whose shore
 *
 * The ocean polygons hold every coast in the tile: Sumatra's, Singapore's, the Thai
 * islands off Langkawi. Each stretch is kept only if Malaysia's outline is both
 * within reach (3–5 km, slack the 2017 shapes needed for land reclaimed since) and nearer than any
 * neighbour's. That is what gives the Johor Strait, 600 m wide at the Causeway, a
 * line on its northern bank only.
 *
 * ## Tiles
 *
 * Each tile's geometry runs past its edge into a buffer, and a polygon that crosses
 * the edge is closed along it. So every segment is clipped to the tile, and one that
 * lies along the tile's edge is dropped: that is a seam, not a shore. What is left
 * from neighbouring tiles joins end to end. A tile's lines are kept once worked out,
 * and the source is rewritten only when the set of tiles on screen changes.
 *
 * Just after a zoom the screen holds both the old tiles and the new ones over the same
 * ground, and tracing both drew the coast twice, a few pixels apart. So a tile is only
 * traced if no tile at the zoom the map is asking for covers the same ground.
 */

type Point = [number, number];
type Segment = [Point, Point];

const DRAWN_URL = `${import.meta.env.BASE_URL}malaysia-states.geo.json`;
const NEIGHBOURS_URL = `${import.meta.env.BASE_URL}malaysia-neighbours.geo.json`;

/** Past this, a shore is somebody else's however few neighbours are in the file. */
const REACH_MIN = 3000;
/** The neighbours file holds outlines to 6 km out, so reach never goes past it. */
const REACH_MAX = 5000;
/** A shore this close to Malaysia's outline is Malaysia's without asking the neighbours. */
const CERTAIN = 30;

/** CARTO's vector tiles stop here and are overzoomed past it. */
const MAX_TILE_ZOOM = 14;

const CELL = 0.02;
const CELL_METRES = CELL * 111320;

/** Metres from p to a→b, flat-earth: exact enough inside 5 km. */
const metres = (p: Point, a: Point, b: Point): number => {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = a[0] * k;
  const px = p[0] * k;
  const dx = b[0] * k - ax;
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

type SegmentGrid = {
  /** Metres to the nearest segment within `reach`, or `Infinity`; stops early under `enough`. */
  nearest: (p: Point, reach: number, enough: number) => number;
};

const segmentGrid = (lines: Array<Array<Point>>): SegmentGrid => {
  const grid = new Map<number, Array<Segment>>();
  const key = (x: number, y: number) => x * 100_000 + y;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1] as Point;
      const b = line[i] as Point;
      for (
        let x = Math.floor(Math.min(a[0], b[0]) / CELL);
        x <= Math.floor(Math.max(a[0], b[0]) / CELL);
        x += 1
      ) {
        for (
          let y = Math.floor(Math.min(a[1], b[1]) / CELL);
          y <= Math.floor(Math.max(a[1], b[1]) / CELL);
          y += 1
        ) {
          const bucket = grid.get(key(x, y));
          if (bucket === undefined) grid.set(key(x, y), [[a, b]]);
          else bucket.push([a, b]);
        }
      }
    }
  }
  return {
    nearest(p, reach, enough) {
      const cells = Math.ceil(reach / CELL_METRES);
      const cx = Math.floor(p[0] / CELL);
      const cy = Math.floor(p[1] / CELL);
      let best = Infinity;
      for (let x = cx - cells; x <= cx + cells; x += 1) {
        for (let y = cy - cells; y <= cy + cells; y += 1) {
          for (const [a, b] of grid.get(key(x, y)) ?? []) {
            const d = metres(p, a, b);
            if (d < best) {
              best = d;
              if (d < enough) return d;
            }
          }
        }
      }
      return best <= reach ? best : Infinity;
    },
  };
};

type Shores = {malaysia: SegmentGrid; neighbours: SegmentGrid};

const outlinesOf = (geometry: GeoJSON.Geometry): Array<Array<Point>> => {
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates as Array<Array<Point>>;
    case 'MultiPolygon':
      return geometry.coordinates.flat() as Array<Array<Point>>;
    case 'MultiLineString':
      return geometry.coordinates as Array<Array<Point>>;
    default:
      return [];
  }
};

/** Both outlines, fetched once per page and shared by every map on it. */
let shores: Promise<Shores> | undefined;
const loadShores = (): Promise<Shores> => {
  shores ??= Promise.all([
    fetch(DRAWN_URL).then((response) => response.json() as Promise<GeoJSON.FeatureCollection>),
    fetch(NEIGHBOURS_URL).then((response) => response.json() as Promise<GeoJSON.Feature>),
  ]).then(([drawn, neighbours]) => ({
    malaysia: segmentGrid(drawn.features.flatMap((feature) => outlinesOf(feature.geometry))),
    neighbours: segmentGrid(outlinesOf(neighbours.geometry)),
  }));
  // A failed fetch is retried by the next map rather than remembered.
  shores.catch(() => {
    shores = undefined;
  });
  return shores;
};

/** Liang–Barsky: the part of a→b inside the square [0, extent]², or `undefined`. */
const clip = (
  a: maplibregl.Point,
  b: maplibregl.Point,
  extent: number,
): [Point, Point] | undefined => {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x],
    [dx, extent - a.x],
    [-dy, a.y],
    [dy, extent - a.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) return undefined;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return undefined;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return undefined;
      if (r < t1) t1 = r;
    }
  }
  return [
    [a.x + t0 * dx, a.y + t0 * dy],
    [a.x + t1 * dx, a.y + t1 * dy],
  ];
};

const onTileEdge = ([a, b]: [Point, Point], extent: number): boolean =>
  (a[0] === b[0] && (a[0] <= 0 || a[0] >= extent)) ||
  (a[1] === b[1] && (a[1] <= 0 || a[1] >= extent));

/** What MapLibre hands back from `querySourceFeatures`, with the tile it came from. */
type TileFeature = maplibregl.MapGeoJSONFeature & {
  _vectorTileFeature: {extent: number; loadGeometry: () => Array<Array<maplibregl.Point>>};
  _x: number;
  _y: number;
  _z: number;
};

/** One tile's share of Malaysia's shore, in longitude and latitude. */
const tileShore = (
  features: Array<TileFeature>,
  {malaysia, neighbours}: Shores,
): Array<Array<Point>> => {
  const lines: Array<Array<Point>> = [];
  const tile = features[0];
  if (tile === undefined) return lines;
  const rings = features.flatMap((feature) => feature._vectorTileFeature.loadGeometry());

  const extent = tile._vectorTileFeature.extent;
  const size = extent * 2 ** tile._z;
  const x0 = extent * tile._x;
  const y0 = extent * tile._y;
  const toLngLat = ([x, y]: Point): Point => [
    ((x + x0) * 360) / size - 180,
    (360 / Math.PI) * Math.atan(Math.exp((1 - ((y + y0) * 2) / size) * Math.PI)) - 90,
  ];
  // Two pixels, as the reach: zoomed out, a generalised coast sits further off.
  const pixelMetres = 40_075_016 / 2 ** tile._z / 512;
  const reach = Math.min(REACH_MAX, Math.max(REACH_MIN, pixelMetres * 2));
  const isMalaysian = (p: Point): boolean => {
    const toMalaysia = malaysia.nearest(p, reach, CERTAIN);
    if (toMalaysia === Infinity) return false;
    return !(neighbours.nearest(p, toMalaysia, toMalaysia) < toMalaysia);
  };

  for (const ring of rings) {
    let line: Array<Point> | undefined;
    const flush = () => {
      if (line !== undefined && line.length > 1) lines.push(line);
      line = undefined;
    };
    for (let i = 1; i < ring.length; i += 1) {
      const piece = clip(ring[i - 1] as maplibregl.Point, ring[i] as maplibregl.Point, extent);
      if (piece === undefined || onTileEdge(piece, extent)) {
        flush();
        continue;
      }
      const a = toLngLat(piece[0]);
      const b = toLngLat(piece[1]);
      if (!isMalaysian([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) {
        flush();
        continue;
      }
      const last = line?.at(-1);
      if (line !== undefined && last !== undefined && last[0] === a[0] && last[1] === a[1])
        line.push(b);
      else {
        flush();
        line = [a, b];
      }
    }
    flush();
  }
  return lines;
};

/**
 * Keeps the GeoJSON source `sourceId` holding Malaysia's shore as the basemap draws it
 * in `basemapSource`'s `sourceLayer`, filtered by `oceanFilter`. Returns the teardown.
 */
export const traceCoastline = (
  map: maplibregl.Map,
  {
    sourceId,
    basemapSource,
    sourceLayer,
    oceanFilter,
  }: {
    sourceId: string;
    basemapSource: string;
    sourceLayer: string;
    oceanFilter: maplibregl.FilterSpecification;
  },
): (() => void) => {
  const byTile = new Map<string, Array<Array<Point>>>();
  let onScreen = '';
  let stopped = false;
  let timer: number | undefined;

  const rebuild = async () => {
    const loaded = await loadShores();
    if (stopped) return;
    const features = map.querySourceFeatures(basemapSource, {
      sourceLayer,
      filter: oceanFilter,
    }) as Array<TileFeature>;
    const tiles = new Map<string, Array<TileFeature>>();
    for (const feature of features) {
      const id = `${feature._z}/${feature._x}/${feature._y}`;
      const list = tiles.get(id);
      if (list === undefined) tiles.set(id, [feature]);
      else list.push(feature);
    }
    // The zoom the map is loading tiles for: 512 px tiles, so the floor of the view's.
    const wanted = Math.min(MAX_TILE_ZOOM, Math.floor(map.getZoom()));
    const coordsOf = (id: string) => id.split('/').map(Number) as [number, number, number];
    const atWanted = new Set([...tiles.keys()].filter((id) => coordsOf(id)[0] === wanted));
    const coveredAtWanted = (id: string): boolean => {
      const [z, x, y] = coordsOf(id);
      if (z === wanted) return false;
      if (z > wanted) {
        const shift = 2 ** (z - wanted);
        return atWanted.has(`${wanted}/${Math.floor(x / shift)}/${Math.floor(y / shift)}`);
      }
      const shift = 2 ** (wanted - z);
      return [...atWanted].some((other) => {
        const [, ox, oy] = coordsOf(other);
        return Math.floor(ox / shift) === x && Math.floor(oy / shift) === y;
      });
    };
    for (const id of [...tiles.keys()]) if (coveredAtWanted(id)) tiles.delete(id);

    const signature = [...tiles.keys()].sort().join(' ');
    if (signature === onScreen) return;
    onScreen = signature;

    for (const [id, list] of tiles) {
      if (!byTile.has(id)) byTile.set(id, tileShore(list, loaded));
    }
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiLineString',
        coordinates: [...tiles.keys()].flatMap((id) => byTile.get(id) ?? []),
      },
    });
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void rebuild(), 120);
  };
  const handleData = (event: maplibregl.MapSourceDataEvent) => {
    if (event.sourceId === basemapSource) schedule();
  };

  map.on('sourcedata', handleData);
  map.on('moveend', schedule);
  // Tiles leaving the screen send no data event; `idle` is what says the swap is over.
  map.on('idle', schedule);
  schedule();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    map.off('sourcedata', handleData);
    map.off('moveend', schedule);
    map.off('idle', schedule);
  };
};
