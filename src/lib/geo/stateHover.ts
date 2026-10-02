import maplibregl from 'maplibre-gl';
import type {ExpressionSpecification} from 'maplibre-gl';

import {lightToken} from '@/styles/colors';
import {
  MALAYSIA_STATE_LABEL_POINTS,
  malaysiaStateAt,
  malaysiaStateBounds,
  malaysiaStateName,
  stateClusterKey,
} from './malaysiaStates';
import {traceCoastline} from './coastline';

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
 * ## One survey, ours, for the borders and the wash
 *
 * The borders and the hovered state's wash are cut from the same extract, which is
 * what makes the wash sit exactly inside the border instead of spilling across it.
 *
 * That is why the basemap's own boundary layer is switched off rather than restyled.
 * It was tried the other way, and it cannot be made to work: sampling Voyager's own
 * boundary tiles against these polygons **unsimplified** gives a median disagreement
 * of 130 m and a worst case of 850 m — two OpenStreetMap snapshots cut at different
 * times. Since 2026-10-01 the shapes are OSM as it stands today and lie on the
 * basemap's own line, but the basemap's stays hidden: its tiles carry no state
 * identity to wash, and one border on screen leaves nothing for ours to disagree with.
 *
 * The coast is the exception, and is the basemap's (2026-09-30): our extract was OSM in
 * 2017, the basemap's sea is OSM today, and a coast drawn from ours cut across Penang's
 * reclaimed land. Our shapes are now cut to today's land too, but the coast stays the
 * basemap's, generalised afresh at every zoom. So the coast is traced off the basemap's own ocean (`coastline.ts`),
 * and every border that reaches it is trimmed there by that same ocean — see
 * `liftOcean`.
 *
 * ## Clicking a state frames it
 *
 * The hover answers *how much is here*; the click answers *show me*. A click on the
 * basemap inside a state fits the viewport to that state's bounding box — the whole
 * of it, islands included, centred — and tells the map through `onStateClick`, so a
 * map that has a state filter beside it can narrow its list to the same state. What
 * the click does beyond the fit is the map's to decide; this module only frames. A
 * click on a pin or a bubble is not a click on a state, and is left to the layer
 * handlers that already own it.
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
 * One point per state, for the label. Separate from the polygons because anything
 * anchored to a MultiPolygon lands once per *part* — eight times on Sabah, one per
 * island — and the states are meant to be named once each.
 */
const LABEL_POINT = new Map(
  MALAYSIA_STATE_LABEL_POINTS.features.map((feature) => [
    feature.properties.id,
    feature.geometry.coordinates as [number, number],
  ]),
);

/**
 * The borders between states and Malaysia's land borders, each drawn once, cut from
 * the same extract by `buildMalaysiaStates.mjs`. The coast is not in it: that is traced
 * off the basemap's own sea (`coastline.ts`).
 */
const BORDERS_SOURCE = 'malaysia-state-borders';
const BORDERS_URL = `${import.meta.env.BASE_URL}malaysia-state-borders.geo.json`;
/** Malaysia's shore as the basemap draws it at the zoom on screen. */
const COAST_SOURCE = 'malaysia-coast';
/** Each state's coast with how far past it the wash may reach; see `buildMalaysiaStates.mjs`. */
const SHORES_SOURCE = 'malaysia-state-shores';
const SHORES_URL = `${import.meta.env.BASE_URL}malaysia-state-shores.geo.json`;

const LAYER = {
  /** A pale band under every border, so the line reads over a busy basemap. */
  borderCasing: 'malaysia-states-border-casing',
  /** Every border, all the time. Not part of the hover. */
  border: 'malaysia-states-border',
  coastCasing: 'malaysia-states-coast-casing',
  coast: 'malaysia-states-coast',
  fill: 'malaysia-states-fill',
  /** The wash's band out over land reclaimed since the polygons were surveyed. */
  fillShore: 'malaysia-states-fill-shore',
} as const;

/**
 * What the hover switches on and off, of the canvas layers. The borders are not in
 * it: they are map furniture, and a border that appeared and vanished with the
 * cursor would be the thing the reader was chasing rather than the thing they were
 * reading. The label is the hover's too, but it is a DOM card rather than a layer —
 * see `buildLabelCard`.
 */
const HOVER_LAYERS = [LAYER.fill, LAYER.fillShore] as const;

/**
 * The hovered state's name and count, as a card filled with the brand colour.
 *
 * It was a symbol layer — two lines of 14px text in `text-primary` with a thin pale
 * halo — and it lost to the map under it: over Voyager's roads and place names the
 * answer to the gesture read as one more label among hundreds. A solid plate is the
 * one thing on the map nothing else looks like.
 *
 * **The fill is the brand and the text is `brand-text`**, the pairing the login
 * button already makes. Brand-coloured *text* on a light plate was the other way to
 * carry the brand, and it fails on the product's own teal: `#21B0B0` on
 * `bg-element` is about 2.5:1, which would make the name fainter than the black it
 * replaced. The fill clears that on every brand, because `brandForeground` is chosen
 * per brand to stay legible on it.
 *
 * **Name over count, at two sizes.** The state is the title and the count is its
 * figure; at one size the two lines read as a sentence broken in the middle.
 *
 * **DOM, not a symbol layer**, because a symbol layer cannot draw a plate without a
 * stretchable sprite, cannot take the app's own font (CARTO's glyph set has no
 * Geist), and cannot cast a shadow. A marker can do all three off the same tokens
 * as the rest of the app. It ignores the pointer, so the cursor passing over the
 * card is still over the state and the hover does not flicker.
 *
 * It stays pinned to the state's centre, as the layer was: zoom into a corner of
 * Sarawak and the card is off-screen, because it belongs to a place rather than to
 * the viewport. And it sits above the donut rings, which are DOM too and would
 * otherwise paint over it in whatever order they were last rebuilt.
 */
const buildLabelCard = (): {element: HTMLDivElement; name: HTMLSpanElement; count: HTMLSpanElement} => {
  const element = document.createElement('div');
  element.className =
    'pointer-events-none flex flex-col items-start gap-0.5 rounded-lg bg-brand px-3 py-2 text-brand-text shadow-lg';
  element.style.zIndex = '10';
  element.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'text-lg leading-tight font-semibold whitespace-nowrap';

  const count = document.createElement('span');
  count.className = 'text-[15px] leading-tight whitespace-nowrap opacity-80';

  element.append(name, count);
  return {element, name, count};
};

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

const OCEAN: maplibregl.FilterSpecification = ['==', ['get', 'class'], 'ocean'];
const NOT_OCEAN: maplibregl.FilterSpecification = ['!=', ['get', 'class'], 'ocean'];

/**
 * Lifts the basemap's sea above the borders, leaving lakes and rivers where they were.
 *
 * A border that reaches the coast is carried a kilometre out to sea by the build, and
 * the sea drawn over it is what cuts it off at the basemap's own shore. Only the ocean
 * is lifted: the Bernam, the Golok and a dozen other rivers *are* borders, and a
 * border drawn under its river would vanish for its whole length.
 *
 * The sea goes up past the roads and buildings, not just past the water, so the
 * borders under it draw over them too (2026-10-01): left at the water's own height a
 * border sank under every road it crossed, which in a town is most of its length. The
 * bridges go up over the sea after it, or the Penang Bridge and the Second Link would
 * vanish under the water they cross; on land that puts a bridge over a border, which
 * is where a bridge is anyway.
 *
 * Voyager draws water as two fills, the water and a 1 px shadow; each is split into its
 * ocean and the rest, so the sea looks exactly as it did. Found structurally, as fill
 * layers over the `water` source layer, for the same reason `findBasemapBoundaries` is;
 * the bridges by Voyager's `bridge_` ids, and the height as just over its buildings.
 */
const liftOcean = (map: maplibregl.Map) => {
  const layers = map.getStyle().layers ?? [];
  const sourceLayer = (layer: maplibregl.LayerSpecification) =>
    (layer as {'source-layer'?: string})['source-layer'];
  const water = layers.filter(
    (layer) => layer.type === 'fill' && sourceLayer(layer) === 'water',
  ) as Array<maplibregl.FillLayerSpecification>;
  const last = water.at(-1);
  if (last === undefined) return undefined;
  const buildings = layers.filter((layer) => sourceLayer(layer) === 'building').at(-1);
  const top = buildings ?? last;
  const above = layers[layers.indexOf(top) + 1]?.id;
  const bridges = buildings === undefined ? [] : layers.filter((layer) => layer.id.startsWith('bridge_'));
  const afterBridges = bridges.map((layer) => layers[layers.indexOf(layer) + 1]?.id);

  const copies = water.map((layer) => ({...layer, id: `malaysia-states-ocean-${layer.id}`, filter: OCEAN}));
  for (const copy of copies) map.addLayer(copy, above);
  for (const layer of water) map.setFilter(layer.id, NOT_OCEAN);
  for (const bridge of bridges) map.moveLayer(bridge.id, above);

  return {
    /** Where the borders go: over lakes, rivers, roads and buildings, under the sea. */
    below: (copies[0] as maplibregl.FillLayerSpecification).id,
    /** Where the coast goes: on the sea, under the bridges and labels. */
    above: bridges[0]?.id ?? above,
    source: last.source,
    restore: () => {
      // Back to front, so each bridge's old neighbour is already home when it moves.
      bridges.forEach((_, index) => {
        const at = bridges.length - 1 - index;
        const id = (bridges[at] as maplibregl.LayerSpecification).id;
        if (map.getLayer(id) !== undefined) map.moveLayer(id, afterBridges[at]);
      });
      for (const copy of copies) if (map.getLayer(copy.id) !== undefined) map.removeLayer(copy.id);
      for (const layer of water) {
        if (map.getLayer(layer.id) !== undefined) map.setFilter(layer.id, layer.filter ?? null);
      }
    },
  };
};

/**
 * Where the basemap keeps its own state and country borders, if it has any — so they
 * can be switched off.
 *
 * Voyager's tiles carry a `boundary` layer, and the style draws `admin_level == 4`
 * from it as `boundary_state` and `admin_level == 2` as `boundary_country_outline` and
 * `boundary_country_inner` — a pale 8px band with a pink line on it. Left on, each is
 * a second border a few hundred metres from the one this file draws, in a different
 * style: the state line would double every internal border, and the country pair
 * would give Malaysia's land borders with Thailand, Indonesia and Brunei a look of
 * their own when they are meant to read exactly like the coast and the line between
 * two states. Nothing is ever drawn *from* them: see the border block for why the
 * wash makes that impossible.
 *
 * The cost of hiding the country layers, stated: they hold every country border in
 * the tiles, not only Malaysia's, so Thailand–Myanmar and the like go as well. Every
 * border of Malaysia is still drawn, from our own shapes; what goes is borders
 * between two other countries, which this map is not about.
 *
 * Found structurally rather than by id: a line layer over a vector source whose
 * filter compares `admin_level` to 2 or 4. A basemap is a thing somebody else
 * versions, and the shape of the layer is the more durable fact about it. `maritime`
 * is left to the style's own filter — Voyager already excludes sea boundaries, and
 * re-deciding that here would be this file disagreeing with the map again, in a
 * different place.
 */
const findBasemapBoundaries = (map: maplibregl.Map): Array<string> => {
  const layers = map.getStyle().layers ?? [];

  return layers
    .filter((layer) => {
      if (layer.type !== 'line') return false;
      const sourceLayer = (layer as {'source-layer'?: string})['source-layer'];
      const filter = (layer as {filter?: unknown}).filter;
      if (sourceLayer === undefined || filter === undefined) return false;
      const printed = JSON.stringify(filter);
      return printed.includes('"admin_level",4') || printed.includes('"admin_level",2');
    })
    .map((layer) => layer.id);
};

/** `#rrggbb` → `[r, g, b]`, or `undefined` for anything else. */
const parseHex = (value: unknown): [number, number, number] | undefined => {
  if (typeof value !== 'string') return undefined;
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim());
  if (match === null) return undefined;
  return [parseInt(match[1] as string, 16), parseInt(match[2] as string, 16), parseInt(match[3] as string, 16)];
};

/**
 * `color` laid over `ground` at `alpha`, as the solid colour that results.
 *
 * What makes every edge draw alike: see the border block. A token that will not
 * parse falls back to itself, which keeps the line drawn — only its weight between
 * shared and unshared edges would then differ again.
 */
const flatten = (color: string, ground: [number, number, number], alpha: number): string => {
  const rgb = parseHex(color);
  if (rgb === undefined) return color;
  const mix = rgb.map((channel, i) => Math.round(channel * alpha + (ground[i] as number) * (1 - alpha)));
  return `#${mix.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * The opacity a line reaches where it is drawn twice at `alpha` — which is what a
 * border between two states always is, once per polygon. `1 − (1 − a)²`.
 */
const twice = (alpha: number): number => 1 - (1 - alpha) ** 2;

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
  /**
   * The hover wash goes underneath this, so pins stay on top of it. The borders and the
   * coast sit lower, with the basemap's sea (see `liftOcean`), unless it has none.
   */
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
  /**
   * Told when a click frames a state — the gensets register filters its list to it.
   *
   * A getter like `fitPadding`, so the map can hand in a ref-backed handler and the
   * latest one is what a click reaches.
   */
  onStateClick?: (stateId: string) => void;
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
    onStateClick,
  }: StateHoverOptions,
): StateHoverHandle => {
  if (map.getSource(SOURCE) === undefined) {
    map.addSource(SOURCE, {
      type: 'geojson',
      data: BOUNDARY_URL,
    });
  }

  const ground =
    parseHex(map.getLayer('background') === undefined ? undefined : map.getPaintProperty('background', 'background-color')) ??
    parseHex(lightToken.canvas) ?? [255, 255, 255];

  // — The hovered state, washed in.
  //
  // Cut from the same survey as the borders, so the tint stops where the line is.
  //
  // It is painted on the basemap's bare ground, under everything else, and as a solid
  // colour: the tint the translucent wash used to reach, flattened onto the ground.
  // That is what let it reach past the polygons' 2017 coast, and it still covers any
  // land the basemap has that OSM lacked when the shapes were cut. A band along each
  // state's shore carries it out over Penang's and Melaka's reclaimed land, the
  // basemap's water above it cuts it off at today's shore, and a solid colour drawn
  // twice where band and polygon overlap is still one colour. The basemap's parks and
  // forests are translucent until zoom 15 and tint through; its roads and labels sit
  // on top, untinted. A brand colour that is not plain hex keeps the old translucent
  // wash over the top of the map, and no band.
  const washColor = flatten(lightToken.brand, ground, 0.18);
  const washIsSolid = parseHex(lightToken.brand) !== undefined;
  const bareGround = (map.getStyle().layers ?? []).find((layer) => layer.type !== 'background')?.id;
  map.addLayer(
    {
      id: LAYER.fill,
      type: 'fill',
      source: SOURCE,
      filter: MATCHES_NOTHING,
      // A tint, not a fill. The pins standing in the state are the thing to look at,
      // and the label and the dimmed remainder are saying the same thing at the same
      // time — this only has to make the area legible, not announce it.
      paint: washIsSolid
        ? {'fill-color': washColor, 'fill-antialias': false}
        : {'fill-color': lightToken.brand, 'fill-opacity': 0.18},
    },
    washIsSolid ? bareGround : beforeLayerId,
  );
  if (washIsSolid) {
    if (map.getSource(SHORES_SOURCE) === undefined) {
      map.addSource(SHORES_SOURCE, {type: 'geojson', data: SHORES_URL});
    }
    // Each run's `reach` in metres, as pixels: a 512 px world at zoom 0, at Malaysia's
    // latitude, halving per zoom. Twice the reach wide, because the band is centred on
    // the old coast and only its seaward half is new.
    const metresPerPixelAtZoom0 = (40_075_016 * Math.cos((4 * Math.PI) / 180)) / 512;
    const band = (zoom: number): ExpressionSpecification => [
      '/',
      ['*', 2, ['get', 'reach']],
      metresPerPixelAtZoom0 / 2 ** zoom,
    ];
    map.addLayer(
      {
        id: LAYER.fillShore,
        type: 'line',
        source: SHORES_SOURCE,
        filter: MATCHES_NOTHING,
        layout: {'line-join': 'round', 'line-cap': 'round'},
        paint: {
          'line-color': washColor,
          'line-width': ['interpolate', ['exponential', 2], ['zoom'], 0, band(0), 24, band(24)],
        },
      } as maplibregl.LayerSpecification,
      bareGround,
    );
  }

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
  // So both come from one survey, ours, and the basemap's own state and country
  // layers are switched off (see `findBasemapBoundaries`). That leaves one border on
  // screen with a wash that fits it, and nothing for either to disagree with. The
  // coast is the basemap's own sea edge, which nothing of ours can disagree with.
  //
  // ## Every edge is drawn alike
  //
  // A coast, a border with Thailand and a border between two states are the same line.
  // They once were not: the layer stroked every state's *outline*, so an edge two
  // states share was stroked twice and a coast once, and at a translucent opacity the
  // coast read as a fainter kind of line. Each edge is now drawn once, from the build's
  // border lines and the traced coast, but the colour is still the one a doubled
  // stroke reached over the basemap's land: `twice(alpha)` of the token, flattened onto
  // Voyager's own background, opaque. That keeps the weight the internal borders
  // always had, and the casing gets the same treatment.
  const hiddenBasemapLayers = findBasemapBoundaries(map);

  /** A zoom ramp of solid colours: `color` at each stop's doubled opacity, on land. */
  const flatRamp = (color: string, stops: Array<[number, number]>): ExpressionSpecification =>
    ['interpolate', ['linear'], ['zoom'], ...stops.flatMap(([zoom, alpha]) => [zoom, flatten(color, ground, twice(alpha))])] as ExpressionSpecification;

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

  const casingPaint = {
    // The ramp the casing had as a translucent band, doubled and flattened — see
    // "Every edge is drawn alike" above.
    'line-color': flatRamp(lightToken.canvas, [
      [4, 0.35],
      [8, 0.6],
      [12, 0.8],
    ]),
    'line-width': CASING_WIDTH,
  };
  const linePaint = {
    // What an internal border used to look like — `primary` at this ramp, drawn
    // twice — as one solid colour, so every edge now draws it.
    'line-color': flatRamp(lightToken.primary, [
      [4, 0.3],
      [8, 0.45],
      [12, 0.6],
      [16, 0.7],
    ]),
    'line-width': BORDER_WIDTH,
  };

  if (map.getSource(BORDERS_SOURCE) === undefined) {
    map.addSource(BORDERS_SOURCE, {type: 'geojson', data: BORDERS_URL});
  }
  if (map.getSource(COAST_SOURCE) === undefined) {
    map.addSource(COAST_SOURCE, {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
  }

  // Borders under the sea, the coast on it; see `liftOcean`. A basemap with no water
  // layer to lift gets its borders under the pins and no coast.
  const ocean = liftOcean(map);
  for (const [id, source, paint, before] of [
    [LAYER.borderCasing, BORDERS_SOURCE, casingPaint, ocean?.below ?? beforeLayerId],
    [LAYER.border, BORDERS_SOURCE, linePaint, ocean?.below ?? beforeLayerId],
    [LAYER.coastCasing, COAST_SOURCE, casingPaint, ocean?.above ?? beforeLayerId],
    [LAYER.coast, COAST_SOURCE, linePaint, ocean?.above ?? beforeLayerId],
  ] as const) {
    map.addLayer(
      {id, type: 'line', source, layout: {'line-join': 'round'}, paint} as maplibregl.LayerSpecification,
      before,
    );
  }
  const stopCoast =
    ocean === undefined
      ? () => {}
      : traceCoastline(map, {
          sourceId: COAST_SOURCE,
          basemapSource: ocean.source,
          sourceLayer: 'water',
          oceanFilter: OCEAN,
        });

  // Two renderings of one border is the thing this was all to avoid, so the basemap's
  // own go quiet while ours are up. Restored on detach.
  const hiddenBasemap = hiddenBasemapLayers.map((id) => ({
    id,
    opacity: map.getPaintProperty(id, 'line-opacity'),
  }));
  for (const {id} of hiddenBasemap) {
    map.setPaintProperty(id, 'line-opacity', 0);
  }

  // The label goes on top of the fleet rather than under it: it is the answer to the
  // gesture, and a pin sitting on the word "Sarawak" would make it unreadable at
  // exactly the moment somebody is reading it. Being DOM puts it over the canvas by
  // construction; see `buildLabelCard` for the rest.
  //
  // It is pinned to the state's centre and stays there. Zoom into a corner of Sarawak
  // and the label is off-screen, which is the honest reading of a label that belongs
  // to a place: one that slid around to stay visible would be a floating readout
  // wearing a map label's clothes, and it would move while the thing it names did not.
  const card = buildLabelCard();
  const cardMarker = new maplibregl.Marker({element: card.element, anchor: 'center'});
  let cardShown = false;

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
      if (cardShown) {
        cardMarker.remove();
        cardShown = false;
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

    card.name.textContent = malaysiaStateName(stateId) ?? stateId;
    card.count.textContent = countLabel(countIn(stateId));
    const point = LABEL_POINT.get(stateId);
    if (point === undefined) {
      if (cardShown) cardMarker.remove();
      cardShown = false;
    } else {
      cardMarker.setLngLat(point);
      if (!cardShown) cardMarker.addTo(map);
      cardShown = true;
    }

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
    if (bounds === undefined || stateId === undefined) return;

    onStateClick?.(stateId);
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
    for (const {id, opacity} of hiddenBasemap) {
      if (map.getLayer(id) !== undefined) map.setPaintProperty(id, 'line-opacity', opacity);
    }
    apply(undefined);
    stopCoast();
    for (const layerId of Object.values(LAYER)) {
      if (map.getLayer(layerId) !== undefined) map.removeLayer(layerId);
    }
    ocean?.restore();
    for (const source of [SOURCE, BORDERS_SOURCE, COAST_SOURCE, SHORES_SOURCE]) {
      if (map.getSource(source) !== undefined) map.removeSource(source);
    }
  };

  return Object.assign(detach, {clusterOpacity});
};
