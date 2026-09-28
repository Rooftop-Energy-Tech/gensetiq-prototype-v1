import type maplibregl from 'maplibre-gl';
import type {ExpressionSpecification} from 'maplibre-gl';

import {lightToken} from '@/styles/colors';
import {
  MALAYSIA_STATE_LABEL_POINTS,
  malaysiaStateAt,
  malaysiaStateBounds,
  malaysiaStateName,
  stateClusterKey,
} from './malaysiaStates';

/**
 * Hovering a state isolates it: the state lights up under the cursor, its name and
 * count are drawn inside it, and everything standing anywhere else recedes.
 *
 * ## Why the hit test is ours and not MapLibre's
 *
 * The obvious build is a `fill` layer at zero opacity and `map.on('mousemove',
 * layer)`. It works, but it makes the interaction depend on whether MapLibre
 * considers an invisible fill worth hit-testing — which is a rendering detail, not
 * a promise. Since the app already needs point-in-polygon in JavaScript to file
 * each site under a state, running the cursor through the same function costs
 * nothing and means "inside the outline" has exactly one definition in the app.
 *
 * ## What dims, and how a cluster decides
 *
 * A pin dims when its own `stateId` isn't the hovered one. A cluster bubble can't
 * answer that about itself — it is several sites at once, and at low zoom the Klang
 * Valley bubble holds four states — so it is judged by membership instead: a bubble
 * stays lit if *any* of what it swallowed stands in the hovered state. That is why
 * the source has to carry `MALAYSIA_STATE_CLUSTER_PROPERTIES`. Judging a bubble by
 * its own centroid would be cheaper and would be wrong on every border.
 *
 * ## What is there before anyone hovers
 *
 * The borders themselves, and only those: a thin neutral line per state, drawn
 * whether or not a cursor is on the map. They started out hidden until hovered, on
 * the argument that a map of the country already has a country on it — which was
 * true and missed the point, because it left the reader nothing to aim at. A border
 * that only appears once you have already found it is not an affordance.
 *
 * The wash and the label are the hover, and those *are* absent at rest: the borders
 * say where the states are, and the hover says which one you are asking about. Two
 * different jobs, and the brand colour belongs to the second of them.
 *
 * ## One geometry, ours, for everything
 *
 * The borders and the hovered state's wash are the same polygons, which is what makes
 * the wash sit exactly inside the border instead of spilling across it.
 *
 * That is why the basemap's own boundary layer is switched off rather than restyled.
 * It was tried the other way, and it cannot be made to work: sampling Voyager's own
 * boundary tiles against these polygons **unsimplified** gives a median disagreement
 * of 130 m and a worst case of 850 m — two OpenStreetMap snapshots cut at different
 * times. No amount of detail closes that, so anything we shade or outline spills past
 * a border drawn from the basemap's copy. With the basemap's hidden there is one
 * border on screen and nothing for ours to disagree with.
 *
 * What ours still has to line up with is the *coastline* the basemap draws, since a
 * state's outline follows the coast for most of its length — which is what the drawn
 * copy's 22 m tolerance is for.
 *
 * ## Clicking a state frames it
 *
 * The hover answers *how much is here*; the click answers *show me*. A click on the
 * basemap inside a state fits the viewport to that state's bounding box — the whole
 * of it, islands included, centred — and leaves everything else alone. It is not a
 * selection and it is not a filter: the fleet outside the state is still drawn, and
 * the list beside the map is untouched. A click on a pin or a bubble is not a click on
 * a state, and is left to the layer handlers that already own it.
 */

/**
 * The polygons everything on the map is drawn from — the borders, and the wash over a
 * hovered state.
 *
 * `public/malaysia-states.geo.json` is the same OpenStreetMap extract the module
 * beside this one carries, at ~22 m instead of ~440 m. It is 810 kB, which is why it
 * is served rather than bundled: MapLibre fetches a source by URL perfectly happily,
 * and nothing needs it before the map has painted. Still a file in this repo, so a
 * fresh clone with no network still has its borders.
 *
 * `BASE_URL` rather than a bare `/`, so this survives being served from a subpath.
 */
const SOURCE = 'malaysia-states';
const BOUNDARY_URL = `${import.meta.env.BASE_URL}malaysia-states.geo.json`;

/**
 * Who the shapes belong to. ODbL asks for it, and the basemap's own attribution
 * already names OpenStreetMap — this is the second row of the same credit.
 */
const BOUNDARY_ATTRIBUTION =
  '<a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a> (OpenStreetMap, ODbL)';

/**
 * One point per state, for the label. Separate from the polygons because a symbol
 * layer over a MultiPolygon draws a label per *part* — eight of them on Sabah, one
 * per island — and the states are meant to be named once each.
 */
const LABEL_SOURCE = 'malaysia-state-labels';
const LAYER = {
  /** A pale band under every border, so the line reads over a busy basemap. */
  borderCasing: 'malaysia-states-border-casing',
  /** Every border, all the time. Not part of the hover. */
  border: 'malaysia-states-border',
  fill: 'malaysia-states-fill',
  label: 'malaysia-states-label',
} as const;

/**
 * What the hover switches on and off. The borders are not in it: they are map
 * furniture, and a border that appeared and vanished with the cursor would be the
 * thing the reader was chasing rather than the thing they were reading.
 */
const HOVER_LAYERS = [LAYER.fill, LAYER.label] as const;

/**
 * A filter no feature can satisfy — how "nothing hovered" is expressed. Every
 * state's id is an ISO code, so the empty string matches none of them.
 */
const MATCHES_NOTHING: ExpressionSpecification = ['==', ['get', 'id'], ''];

/**
 * What an unhovered pin or bubble fades to.
 *
 * Low enough that the hovered state reads as the only thing on the map, high enough
 * that the fleet is still visibly *there* — dimming to nothing would turn a hover
 * into a filter, and the point of the gesture is to compare one state against the
 * rest, not to hide the rest.
 */
const DIM = 0.18;

/**
 * How long the click's fit takes, in ms. The same as the maps' own fly-to-selection,
 * so a click on a state and a click on a pin move the map at one speed.
 */
const FIT_DURATION = 600;

/** What the two border layers are given for source, source-layer and filter. */
type BorderSource = {
  source: string;
  'source-layer'?: string;
  filter?: maplibregl.FilterSpecification;
};

/**
 * Where the basemap keeps its own state borders, if it has any — so they can be
 * switched off.
 *
 * Voyager's tiles carry a `boundary` layer and the style draws `admin_level == 4`
 * from it as `boundary_state`. Left on, it would be a second border a few hundred
 * metres from the one this file draws. Nothing is ever drawn *from* it: see the
 * border block for why the wash makes that impossible.
 *
 * Found structurally rather than by its id: a line layer over a vector source whose
 * filter names `admin_level` and `4`. The id is checked first because it costs
 * nothing and is right today, but a basemap is a thing somebody else versions, and
 * the shape of the layer is the more durable fact about it. `maritime` is left to the
 * style's own filter — Voyager already excludes sea boundaries, and re-deciding that
 * here would be this file disagreeing with the map again, in a different place.
 */
const findBasemapStateBoundary = (
  map: maplibregl.Map,
):
  | {id: string; source: string; sourceLayer: string; filter: unknown}
  | undefined => {
  const layers = map.getStyle().layers ?? [];

  const usable = (layer: (typeof layers)[number]) => {
    if (layer.type !== 'line') return undefined;
    const sourceLayer = (layer as {'source-layer'?: string})['source-layer'];
    const source = (layer as {source?: string}).source;
    const filter = (layer as {filter?: unknown}).filter;
    if (sourceLayer === undefined || source === undefined || filter === undefined) return undefined;
    const printed = JSON.stringify(filter);
    if (!printed.includes('admin_level') || !printed.includes('4')) return undefined;
    return {id: layer.id, source, sourceLayer, filter};
  };

  const byId = layers.find((layer) => layer.id === 'boundary_state');
  const fromId = byId === undefined ? undefined : usable(byId);
  if (fromId !== undefined) return fromId;

  for (const layer of layers) {
    const hit = usable(layer);
    if (hit !== undefined) return hit;
  }
  return undefined;
};

type DimTarget = {
  layerId: string;
  property: 'circle-opacity' | 'circle-stroke-opacity' | 'text-opacity' | 'icon-opacity';
  /** Whatever the layer was painted with before the hover touched it. */
  base: unknown;
  /** Pins answer for themselves; bubbles answer by membership. */
  scope: 'point' | 'cluster';
};

export type StateHoverOptions = {
  /** The layer drawing individual (unclustered) pins, whose features carry `stateId`. */
  pointLayerId: string;
  /** The `circle` layers drawing cluster bubbles — haloes, ring, core. */
  clusterCircleLayerIds: Array<string>;
  /** The `symbol` layer drawing a bubble's count. */
  clusterCountLayerId: string;
  /** The border and the hover wash go underneath this, so pins stay on top of them. */
  beforeLayerId: string;
  /**
   * How many of the things currently drawn stand in this state.
   *
   * Read through a getter rather than passed as data because it has to follow the
   * list's filters — the count under the cursor is a count of what is on the map,
   * not of the whole fleet.
   */
  countIn: (stateId: string) => number;
  /** `(2) => '2 gensets'`. Each map names its own units. */
  countLabel: (count: number) => string;
  /**
   * What the click's fit keeps clear of the viewport's edges — the same padding the
   * map uses to frame the fleet, panel inset included.
   *
   * A getter, and read late (see `handleClick`), because the click that frames a
   * state is also the click that closes the map's floating panel: by the time the
   * fit runs, the right-hand inset is not what it was when the click began.
   */
  fitPadding: () => maplibregl.PaddingOptions;
  /** Told when the hovered state changes, for anything outside the canvas. */
  onHoverChange?: (stateId: string | undefined) => void;
};

/**
 * The shape `attachStateHover` returns: the teardown, with the donut rings' share of
 * the dimming hung off it.
 *
 * Handing `clusterOpacity` back rather than taking the donuts as an input is what
 * lets a map attach the two in either order — and the rings are attached first
 * everywhere, because they are the older of the two.
 */
export type StateHoverHandle = (() => void) & {
  clusterOpacity: (properties: Record<string, unknown>) => number;
};

/**
 * Adds the boundary layers and the hover behaviour to `map`, and returns the
 * teardown. Safe to call before the fleet layers exist only if they exist by the
 * time it runs — callers attach from `style.load`, alongside everything else.
 */
export const attachStateHover = (
  map: maplibregl.Map,
  {
    pointLayerId,
    clusterCircleLayerIds,
    clusterCountLayerId,
    beforeLayerId,
    countIn,
    countLabel,
    fitPadding,
    onHoverChange,
  }: StateHoverOptions,
): StateHoverHandle => {
  if (map.getSource(SOURCE) === undefined) {
    map.addSource(SOURCE, {
      type: 'geojson',
      data: BOUNDARY_URL,
      attribution: BOUNDARY_ATTRIBUTION,
    });
  }
  if (map.getSource(LABEL_SOURCE) === undefined) {
    map.addSource(LABEL_SOURCE, {
      type: 'geojson',
      data: MALAYSIA_STATE_LABEL_POINTS as GeoJSON.FeatureCollection,
    });
  }

  // — The hovered state, washed in.
  //
  // Same polygons as the borders below, which is the point: the tint stops exactly
  // where the line is, because they are the same geometry. Shading from one dataset
  // inside a border drawn from another is what this arrangement exists to avoid.
  map.addLayer(
    {
      id: LAYER.fill,
      type: 'fill',
      source: SOURCE,
      filter: MATCHES_NOTHING,
      paint: {
        'fill-color': lightToken.brand,
        // A tint, not a fill. The pins standing in the state are the thing to look
        // at, and the label and the dimmed remainder are saying the same thing at the
        // same time — this only has to make the area legible, not announce it.
        'fill-opacity': 0.18,
      },
    },
    beforeLayerId,
  );

  // — The borders themselves, drawn whether or not anything is hovered.
  //
  // Without them the hover is a control with no affordance: the states are really
  // there, but nothing on screen says so, and a reader has to sweep the cursor
  // around to discover that pointing at the map does anything at all.
  //
  // ## Why ours and not the basemap's
  //
  // Drawing the basemap's own boundary layer instead was tried, and it is exact — it
  // is the same geometry the reader can see, so it cannot be a pixel off. What it
  // cannot do is have anything drawn *inside* it. Those tiles carry only
  // `admin_level` and `maritime`, with no per-state identity, so "Sarawak" cannot be
  // selected out of them; the wash has to come from our polygons, and our polygons
  // disagree with the basemap's boundary by 130 m on average and 850 m at worst. The
  // shading spilled across the line.
  //
  // So both come from one set of shapes, ours, and the basemap's own boundary layer
  // is switched off. That leaves one border on screen with a wash that fits it, and
  // nothing for either to disagree with. Voyager's is a pale pink dashed hairline that
  // starts at zoom 9 and sits *underneath* water and landuse, so hiding it costs
  // nothing a reader would miss.
  const basemapBoundary = findBasemapStateBoundary(map);

  // Both weight and opacity ramp with zoom. Zoomed out the line sits on flat sea and
  // empty land, where anything heavier than a hairline reads as a net thrown over the
  // country; zoomed in it sits on Voyager at its busiest — white roads, buildings,
  // park fill — where a thin grey line is simply one more grey line.
  const BORDER_WIDTH: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4,
    0.8,
    7,
    1.4,
    10,
    2.2,
    14,
    3.4,
    18,
    4.5,
  ];

  /**
   * The pale band under the line, so it holds up over whatever it crosses. It is what
   * makes the border read as a boundary rather than as an unlabelled road: nothing
   * else on this basemap is drawn dark-on-light that way.
   */
  const CASING_WIDTH: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4,
    2.6,
    7,
    4,
    10,
    5.6,
    14,
    8,
    18,
    10,
  ];

  /**
   * Our own polygons, the same ones the wash above is drawn from. `basemapBoundary` is
   * found only so it can be switched off below — never drawn from.
   */
  const borderSource: BorderSource = {source: SOURCE};

  map.addLayer(
    {
      id: LAYER.borderCasing,
      type: 'line',
      ...borderSource,
      layout: {'line-join': 'round'},
      paint: {
        'line-color': lightToken.canvas,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.35, 8, 0.6, 12, 0.8],
        'line-width': CASING_WIDTH,
      },
    } as maplibregl.LayerSpecification,
    beforeLayerId,
  );

  map.addLayer(
    {
      id: LAYER.border,
      type: 'line',
      ...borderSource,
      layout: {'line-join': 'round'},
      paint: {
        'line-color': lightToken.primary,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.45, 12, 0.6, 16, 0.7],
        'line-width': BORDER_WIDTH,
      },
    } as maplibregl.LayerSpecification,
    beforeLayerId,
  );

  // Two renderings of one border is the thing this was all to avoid, so the basemap's
  // own goes quiet while ours is up. Restored on detach.
  const hiddenBasemapLayer =
    basemapBoundary === undefined
      ? undefined
      : {id: basemapBoundary.id, opacity: map.getPaintProperty(basemapBoundary.id, 'line-opacity')};
  if (hiddenBasemapLayer !== undefined) {
    map.setPaintProperty(hiddenBasemapLayer.id, 'line-opacity', 0);
  }

  // The label goes on top of the fleet rather than under it: it is the answer to the
  // gesture, and a pin sitting on the word "Sarawak" would make it unreadable at
  // exactly the moment somebody is reading it.
  //
  // It is pinned to the state's centre and stays there. Zoom into a corner of Sarawak
  // and the label is off-screen, which is the honest reading of a label that belongs
  // to a place: one that slid around to stay visible would be a floating readout
  // wearing a map label's clothes, and it would move while the thing it names did not.
  map.addLayer({
    id: LAYER.label,
    type: 'symbol',
    source: LABEL_SOURCE,
    filter: MATCHES_NOTHING,
    layout: {
      'text-field': '',
      // Geist isn't in CARTO's glyph set; Open Sans is the closest it serves — the
      // same substitution the cluster counts make.
      'text-font': ['Open Sans Bold', 'Open Sans Regular'],
      'text-size': 14,
      'text-line-height': 1.3,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': lightToken.primary,
      // The basemap under a label is whatever it happens to be — coastline, a road,
      // another state's fill. The halo is what makes the text legible over all of
      // them without a plate behind it.
      'text-halo-color': lightToken.canvas,
      'text-halo-width': 1.6,
    },
  });

  // — Capture what the fleet layers were painted with, so the hover can be undone
  //   exactly rather than by re-stating constants this file would then own.
  const targets: Array<DimTarget> = [];
  const capture = (
    layerId: string,
    property: DimTarget['property'],
    scope: DimTarget['scope'],
    fallback: unknown,
  ) => {
    if (map.getLayer(layerId) === undefined) return;
    const base = map.getPaintProperty(layerId, property);
    targets.push({layerId, property, base: base ?? fallback, scope});
  };

  capture(pointLayerId, 'circle-opacity', 'point', 1);
  capture(pointLayerId, 'circle-stroke-opacity', 'point', 1);
  for (const layerId of clusterCircleLayerIds) {
    capture(layerId, 'circle-opacity', 'cluster', 1);
  }
  capture(clusterCountLayerId, 'text-opacity', 'cluster', 1);

  /**
   * `base × 1` where the feature belongs to the hovered state, `base × DIM` where it
   * doesn't.
   *
   * Multiplying rather than substituting is what keeps the bubble looking like
   * itself: its three circles are painted at 0.18, 0.35 and 1, and a hover that
   * replaced those with one number would flatten the concentric rings the design is
   * built on into a single disc.
   */
  const dimmed = (target: DimTarget, stateId: string): ExpressionSpecification => {
    const belongs: ExpressionSpecification =
      target.scope === 'point'
        ? ['==', ['get', 'stateId'], stateId]
        : ['>', ['coalesce', ['get', stateClusterKey(stateId)], 0], 0];
    const base = typeof target.base === 'number' ? target.base : 1;
    return ['case', belongs, base, base * DIM];
  };

  let hovered: string | undefined;

  const apply = (stateId: string | undefined) => {
    if (stateId === hovered) return;
    hovered = stateId;

    if (stateId === undefined) {
      for (const target of targets) {
        map.setPaintProperty(target.layerId, target.property, target.base);
      }
      for (const layerId of HOVER_LAYERS) {
        map.setFilter(layerId, MATCHES_NOTHING);
      }
      onHoverChange?.(undefined);
      // Let the donut rings pick up the cleared state on the next frame.
      map.triggerRepaint();
      return;
    }

    for (const target of targets) {
      map.setPaintProperty(target.layerId, target.property, dimmed(target, stateId));
    }

    const matches: ExpressionSpecification = ['==', ['get', 'id'], stateId];
    for (const layerId of HOVER_LAYERS) {
      map.setFilter(layerId, matches);
    }

    const name = malaysiaStateName(stateId) ?? stateId;
    map.setLayoutProperty(
      LAYER.label,
      'text-field',
      `${name}\n${countLabel(countIn(stateId))}`,
    );

    onHoverChange?.(stateId);
    map.triggerRepaint();
  };

  const handleMove = (event: maplibregl.MapMouseEvent) => {
    apply(malaysiaStateAt(event.lngLat.lng, event.lngLat.lat));
  };
  const handleOut = () => {
    apply(undefined);
  };

  map.on('mousemove', handleMove);
  // The cursor can leave the canvas without a final `mousemove` inside it — off the
  // top of the map, or onto the detail panel floating over it — which would leave a
  // state highlighted with nothing pointing at it.
  map.on('mouseout', handleOut);

  /**
   * Clicking a state fits the viewport to it.
   *
   * A click that landed on a pin or a bubble is theirs: the maps bind selection and
   * cluster expansion to those layers, and a fit started underneath would fight the
   * ease they start. So the fleet layers are re-queried at the click point and the
   * click is ignored if any of them was hit — the same test the maps' own background
   * click makes, and for the same reason: it keeps this independent of the order
   * MapLibre dispatches the handlers in.
   *
   * The fit is deferred a tick rather than run in the handler. The same click also
   * clears the selection when one is open, and the maps close their floating panel in
   * response, which changes how much of the right edge the fit has to keep clear.
   * React flushes that before the timeout fires — a click is a discrete event, so the
   * update is synchronous-lane and lands in a microtask — and `fitPadding` then reads
   * the panel's *new* width. The state lands centred in the map that is left, not in
   * the map that was there when the click began.
   */
  let pendingFit: number | undefined;
  const handleClick = (event: maplibregl.MapMouseEvent) => {
    const fleetLayers = [pointLayerId, ...clusterCircleLayerIds].filter(
      (layerId) => map.getLayer(layerId) !== undefined,
    );
    if (map.queryRenderedFeatures(event.point, {layers: fleetLayers}).length > 0) return;

    const stateId = malaysiaStateAt(event.lngLat.lng, event.lngLat.lat);
    const bounds = stateId === undefined ? undefined : malaysiaStateBounds(stateId);
    if (bounds === undefined) return;

    window.clearTimeout(pendingFit);
    pendingFit = window.setTimeout(() => {
      pendingFit = undefined;
      map.fitBounds(bounds, {padding: fitPadding(), duration: FIT_DURATION});
    }, 0);
  };
  map.on('click', handleClick);

  /** What the donut rings ask, one bubble at a time. */
  const clusterOpacity = (properties: Record<string, unknown>): number => {
    if (hovered === undefined) return 1;
    const raw = properties[stateClusterKey(hovered)];
    const count = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0;
    return Number.isFinite(count) && count > 0 ? 1 : DIM;
  };

  const detach = () => {
    map.off('mousemove', handleMove);
    map.off('mouseout', handleOut);
    map.off('click', handleClick);
    // A fit still queued against a map that is about to be removed.
    window.clearTimeout(pendingFit);
    if (hiddenBasemapLayer !== undefined && map.getLayer(hiddenBasemapLayer.id) !== undefined) {
      map.setPaintProperty(hiddenBasemapLayer.id, 'line-opacity', hiddenBasemapLayer.opacity);
    }
    apply(undefined);
    for (const layerId of Object.values(LAYER)) {
      if (map.getLayer(layerId) !== undefined) map.removeLayer(layerId);
    }
    if (map.getSource(SOURCE) !== undefined) map.removeSource(SOURCE);
    if (map.getSource(LABEL_SOURCE) !== undefined) map.removeSource(LABEL_SOURCE);
  };

  return Object.assign(detach, {clusterOpacity});
};
