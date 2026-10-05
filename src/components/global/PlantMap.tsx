import maplibregl from 'maplibre-gl';
import type {GeoJSONSource, MapMouseEvent} from 'maplibre-gl';
import {useEffect, useRef} from 'react';

import {attachClusterDonuts, clusterCount, refreshClusterDonuts} from '@/lib/clusterDonut';
import {
  MALAYSIA_STATE_CLUSTER_PROPERTIES,
  PENINSULA,
  PENINSULA_PADDING,
  malaysiaStateAt,
} from '@/lib/geo/malaysiaStates';
import {attachStateHover} from '@/lib/geo/stateHover';
import type {StateHoverHandle} from '@/lib/geo/stateHover';
import {lightToken} from '@/styles/colors';

/**
 * The estate map, for a register whose rows are points with a tone of their own.
 * Today that is the fuel trucks and their depots (`TrucksView`) and the deployments
 * (`DeploymentsMap`). It was written for the solar and battery registers, which
 * have since gone; the reasoning below is from then and still holds.
 *
 * ## Why this is one component and the other two are not
 *
 * `GensetsMap` and `SitesMap` are near-identical files, and the note at the top of
 * the second says why that was accepted: *"Everything structural here is
 * `GensetsMap`'s and deliberately so… Two maps in one product that cluster
 * differently or frame differently read as two products."* Two copies held in step
 * by a comment is a bet that comes off at two and does not come off at four. So
 * `/solar` and `/battery` share this one instead, and it takes the same argument
 * `SitesMap` once made about its own `colorBy` — *"a prop rather than a second map
 * component, because the two differ in one paint expression and nothing else"* —
 * and finishes it: the paint expression is the prop, and there is nothing else.
 *
 * That prop is **no longer on `SitesMap`**, which now paints one way only: its second
 * scale was the condition verdict, and the verdict was removed from the app on
 * 2026-09-14. The argument is unaffected — it is why this component has a `colorBy`
 * and `/solar` and `/battery` are not two files — but do not go looking for the
 * original there.
 *
 * What it does *not* do is reach back and rewrite the two existing maps. Both carry
 * things this does not — the fleet map's pin has no count to size itself by, the
 * sites map's does — and a refactor of two working screens is not the price of
 * standing up two new ones. They remain the reference for everything structural
 * here: same CARTO basemap, same three-circle bubble, same `style.load` timing,
 * same fit-then-fly viewport rules.
 *
 * ## What a caller supplies
 *
 * A flat list of points, each carrying a **tone** — a key from the caller's own
 * vocabulary — and the palette those keys mean, in the order the cluster ring reads.
 * Nothing here knows what a system state or a state of charge is; it knows about
 * coordinates and colours, which is the same line `clusterDonut.ts` draws.
 */

/**
 * CARTO's Voyager basemap — the fleet map's constant, for its reasons: no account
 * or token, and a light basemap to inset into the dark shell.
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const SOURCE = 'plant';
/** Landmarks — fixed places drawn as labelled pins, never clustered. */
const LANDMARK_SOURCE = 'plant-landmarks';
const LAYER = {
  clusterHalo: 'plant-cluster-halo',
  clusterRing: 'plant-cluster-ring',
  clusterCore: 'plant-cluster-core',
  clusterCount: 'plant-cluster-count',
  point: 'plant-point',
  landmark: 'plant-landmark',
  landmarkLabel: 'plant-landmark-label',
} as const;

/** The pin image for one landmark tone, registered with the map at load. */
const landmarkImage = (key: string) => `plant-landmark-${key}`;

/**
 * The lucide `warehouse` glyph, on its 24-unit grid — the icon the Fuel rail heads
 * its Depots group with, so the map and the rail name a depot the same way.
 */
const WAREHOUSE_PATHS = [
  'M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11',
  'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z',
  'M6 13h12',
  'M6 17h12',
];

/** The landmark pin's size in CSS pixels. Its tip is the bottom edge. */
// The head is a truck dot's width (Jeff, 2026-10-01): a dot is a 9px circle under a
// 2px stroke, 22px across, and the head's 9.25px fill under its 3.5px outline comes
// to the same 22px, so the two marks differ in shape and glyph and not in size.
const PIN = {width: 24, height: 30, radius: 9.25, centreY: 11.5};

/**
 * A map pin in `color` — a round head over a point — with the warehouse glyph in
 * white on its head (Jeff, 2026-09-30). Outlined as a pin is, in the text colour
 * over a canvas-coloured ring, so it sits in the same family as the dots and is told
 * apart from them at a glance by its shape and its glyph. Drawn at twice the size
 * for a sharp edge on a high-density screen.
 */
const pinImage = (color: string): ImageData | undefined => {
  const ratio = 2;
  const canvas = document.createElement('canvas');
  canvas.width = PIN.width * ratio;
  canvas.height = PIN.height * ratio;
  const context = canvas.getContext('2d');
  if (context === null) return undefined;
  context.scale(ratio, ratio);

  const cx = PIN.width / 2;
  const cy = PIN.centreY;
  const r = PIN.radius;
  const tip = PIN.height - 1.5;
  const pin = new Path2D();
  pin.moveTo(cx, tip);
  pin.bezierCurveTo(cx - 3, tip - 4.6, cx - r, cy + 6.2, cx - r, cy);
  pin.arc(cx, cy, r, Math.PI, Math.PI * 2);
  pin.bezierCurveTo(cx + r, cy + 6.2, cx + 3, tip - 4.6, cx, tip);
  pin.closePath();

  context.lineJoin = 'round';
  context.strokeStyle = lightToken.primary;
  context.lineWidth = 3.5;
  context.stroke(pin);
  context.strokeStyle = lightToken.canvas;
  context.lineWidth = 2;
  context.stroke(pin);
  context.fillStyle = color;
  context.fill(pin);

  // The glyph, 11px square on the head, stroked as lucide draws it.
  const glyph = 11;
  context.save();
  context.translate(cx - glyph / 2, cy - glyph / 2);
  context.scale(glyph / 24, glyph / 24);
  context.strokeStyle = lightToken.canvas;
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const d of WAREHOUSE_PATHS) context.stroke(new Path2D(d));
  context.restore();

  return context.getImageData(0, 0, canvas.width, canvas.height);
};

/** The layers a click can land on — and, read in the negative, what a basemap click is. */
const INTERACTIVE_LAYERS = [LAYER.clusterHalo, LAYER.clusterCore, LAYER.point, LAYER.landmark, LAYER.landmarkLabel];

/** How close a landmark click brings the map: a town's scale, near enough to see what stands at it. */
const LANDMARK_ZOOM = 12;

const FIT_PADDING = {top: 56, right: 56, bottom: 56, left: 56};

/** One pin: where it is, and which of the caller's tones paints it. */
export type PlantPoint = {
  id: string;
  latitude: number;
  longitude: number;
  /** A key in `tones`. An unrecognised one falls back to the first tone's colour. */
  tone: string;
  /**
   * Marks a fixed place — a depot among trucks — rather than one of the things the
   * map is counting. Drawn as a labelled warehouse pin instead of a circle, kept out of
   * the clusters and the state hover's count, and never selected, so it can never
   * be mistaken for a pin. A click on it zooms in; a click on its name, drawn beside
   * it, goes to `onLandmarkOpen`.
   */
  landmark?: {label: string};
};

/**
 * A tone and its colour, as a literal rather than a token name: MapLibre evaluates
 * paint properties in a shader, where `var(--severity-ok)` means nothing. Callers
 * read the value off `lightToken` through whichever `*_META` record already owns the
 * colour, so the pin and the badge in the row beside it cannot disagree.
 */
export type PlantTone = {key: string; color: string};

type PlantMapProps = {
  points: Array<PlantPoint>;
  /**
   * The palette, **in the order the cluster ring is drawn** — worst first, from
   * twelve o'clock, so the same estate always draws the same ring and the eye
   * learns where to look.
   *
   * Expected to be a module constant. The colours may change between renders (a
   * caller repainting by a different scale) and the effect below follows that; the
   * set of *keys* is read once, when the source's per-tone cluster tallies are
   * declared, so a caller that wants a different vocabulary wants a remount.
   */
  tones: ReadonlyArray<PlantTone>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /**
   * Clearing the selection — a click that landed on the basemap and nothing else.
   *
   * Optional, as on the other two maps: a map whose selection is not its own to
   * clear (one that hands a pin click straight to another route) passes nothing.
   */
  onDeselect?: () => void;
  /**
   * A landmark's name was clicked — open the place it names. Its pin zooms in; its
   * name leads away, as a name does elsewhere in the app (Jeff, 2026-09-30).
   * Absent, the name is plain text.
   */
  onLandmarkOpen?: (id: string) => void;
  /**
   * The cluster bubble's fill and count colour, as literals for the shader. Absent,
   * a bubble is the canvas colour with the count in text colour. The Trucks map
   * fills its bubbles in fuel violet (Jeff, 2026-09-30), so a cluster of trucks
   * reads as the same thing as a truck; a tone ring segment in the fill colour then
   * drops into it and only the other tones' share shows.
   */
  clusterFill?: {color: string; text: string};
  /**
   * Right-hand inset in px for a floating panel, so `fitBounds` does not tuck pins
   * underneath it. `0` where there is no panel.
   */
  panelInset?: number;
  /**
   * The subset to frame — the rows on screen in the list beside it, in a split view.
   *
   * Every point stays *drawn*. Hiding the off-screen ones would make the map a
   * second rendering of the list's scroll position rather than a map of the estate,
   * and the clusters would dissolve as you scrolled. Empty or absent means frame
   * everything, which is what a full-width map and a first paint both want.
   */
  focusIds?: Array<string>;
  /** The map's accessible name — `Fuel truck locations map`. */
  label: string;
  /**
   * What one of these pins is called, for the count drawn inside a hovered state.
   *
   * This component is deliberately domain-free — it draws points and tones, and the
   * caller supplies the vocabulary, the same way it supplies `label`. Defaults to
   * the neutral word rather than guessing at solar or battery.
   */
  countNoun?: {one: string; many: string};
};

const DEFAULT_COUNT_NOUN = {one: 'unit', many: 'units'};

const toFeatureCollection = (
  points: Array<PlantPoint>,
  selectedId: string | undefined,
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: 'FeatureCollection',
  features: points.map((point) => ({
    type: 'Feature',
    id: point.id,
    geometry: {type: 'Point', coordinates: [point.longitude, point.latitude]},
    properties: {
      id: point.id,
      tone: point.tone,
      label: point.landmark?.label ?? '',
      // Which state this pin stands in, so the hover can tell its own from everyone
      // else's — and so the per-state cluster sums have something to count. Filed on
      // the feature rather than on the record, because it is a fact about a
      // coordinate: move the thing and it follows.
      stateId: malaysiaStateAt(point.longitude, point.latitude) ?? '',
      selected: point.id === selectedId,
    },
  })),
});

/**
 * Tone → pin fill, as a MapLibre `match` expression.
 *
 * A `match` is variadic — N label/value pairs then a fallback — and TypeScript
 * cannot derive that tuple shape from a `flatMap`, so the assertion is unavoidable
 * here. What it is not doing is covering a missing case: the arms are the caller's
 * whole palette, and the fallback is its first entry rather than an invented colour.
 */
const toneColor = (tones: ReadonlyArray<PlantTone>): maplibregl.ExpressionSpecification =>
  [
    'match',
    ['get', 'tone'],
    ...tones.flatMap((tone) => [tone.key, tone.color]),
    tones[0]?.color ?? lightToken.primary,
  ] as unknown as maplibregl.ExpressionSpecification;

/** Namespaced, so a tone called `id` or `selected` cannot collide with a feature's own keys. */
const toneKey = (key: string) => `tone:${key}`;

export const PlantMap = ({
  points,
  tones,
  selectedId,
  onSelect,
  onDeselect,
  onLandmarkOpen,
  clusterFill,
  panelInset = 0,
  focusIds,
  label,
  countNoun = DEFAULT_COUNT_NOUN,
}: PlantMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

  // Read inside the layer-creation closure and the donut callback, both of which are
  // registered once. Held in a ref for the reason `onSelect` is below: so a change
  // of palette repaints rather than tearing the map down and rebuilding it.
  const tonesRef = useRef(tones);
  tonesRef.current = tones;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onDeselectRef = useRef(onDeselect);
  onDeselectRef.current = onDeselect;
  const clusterFillRef = useRef(clusterFill);
  clusterFillRef.current = clusterFill;
  const onLandmarkOpenRef = useRef(onLandmarkOpen);
  onLandmarkOpenRef.current = onLandmarkOpen;

  // The plant currently drawn, and what to call it, read from inside the state
  // hover's count. Refs for the same reason as the handlers above: the hover is
  // registered once and has to keep seeing the current render's answer.
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const countNounRef = useRef(countNoun);
  countNounRef.current = countNoun;

  // Read by the state click's fit, which runs after the same click may have closed
  // the panel — so a ref the fit reads late, not a width captured at attach.
  const panelInsetRef = useRef(panelInset);
  panelInsetRef.current = panelInset;

  // Which selection we last flew to. Without this the map re-centres on every
  // unrelated render, yanking the viewport away from wherever the user panned.
  //
  // Seeded with whatever was selected on the first render, so arriving with a row
  // already chosen lands on the estate with its preview open rather than zoomed
  // into one site.
  const flownToRef = useRef<string | undefined>(selectedId);

  // — Create the map once.
  useEffect(() => {
    if (containerRef.current === null) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: PENINSULA,
      fitBoundsOptions: {padding: PENINSULA_PADDING},
      attributionControl: {compact: true},
    });
    mapRef.current = map;

    // Dev-only handle. Map bugs are hard to reach from React DevTools — almost
    // everything worth checking (zoom, source data, rendered features) lives on this
    // object and nowhere in the component tree.
    if (import.meta.env.DEV) {
      (window as unknown as {__plantMap?: maplibregl.Map}).__plantMap = map;
    }

    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'bottom-right');

    // `style.load`, not `load`: MapLibre defers `load` until the style has parsed
    // *and* the map has painted a frame. A hidden or backgrounded tab gets no
    // animation frames, so `load` never fires there and the layers are never added —
    // the map comes up as a bare basemap and stays that way until the tab is focused.
    // Assigned at the end of `style.load`, once there are fleet layers for it to
    // dim. The donut rings close over it and are attached first, so they read it
    // lazily rather than being handed it.
    let stateHover: StateHoverHandle | undefined;

    map.on('style.load', () => {
      map.addSource(SOURCE, {
        type: 'geojson',
        data: toFeatureCollection([], undefined),
        cluster: true,
        // One row per site here, as on the sites map, so this stops clustering a
        // zoom level earlier than the fleet map does: past the Klang Valley's own
        // scale a bubble over two sites hides more than the overlap it prevents.
        clusterMaxZoom: 10,
        clusterRadius: 55,
        // Carry a per-tone count up into every cluster, so a bubble knows the mix of
        // what it swallowed and not just how much. This is what the donut ring is
        // drawn from — the alternative, `getClusterLeaves` per bubble, is async and
        // would leave the rings a frame behind the map.
        clusterProperties: {
          ...(Object.fromEntries(
            tonesRef.current.map((tone) => [
              toneKey(tone.key),
              ['+', ['case', ['==', ['get', 'tone'], tone.key], 1, 0]],
            ]),
          ) as Record<string, maplibregl.ExpressionSpecification>),
          // And the same again per Malaysian state, so a bubble knows whether any of
          // what it swallowed stands in the one under the cursor.
          ...MALAYSIA_STATE_CLUSTER_PROPERTIES,
        },
      });

      // The cluster bubble is three stacked circles — two translucent haloes and an
      // opaque core — which is how the design draws its concentric rings.
      map.addLayer({
        id: LAYER.clusterHalo,
        type: 'circle',
        source: SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': 27,
          'circle-color': lightToken.canvas,
          'circle-opacity': 0.18,
        },
      });
      map.addLayer({
        id: LAYER.clusterRing,
        type: 'circle',
        source: SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': 23,
          'circle-color': lightToken.canvas,
          'circle-opacity': 0.35,
        },
      });
      map.addLayer({
        id: LAYER.clusterCore,
        type: 'circle',
        source: SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': 18,
          'circle-color': clusterFillRef.current?.color ?? lightToken.canvas,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': lightToken.primary,
        },
      });
      map.addLayer({
        id: LAYER.clusterCount,
        type: 'symbol',
        source: SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          // Geist isn't in CARTO's glyph set; Open Sans is the closest thing it
          // serves. The stack falls back rather than rendering nothing.
          'text-font': ['Open Sans Bold', 'Open Sans Regular'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: {'text-color': clusterFillRef.current?.text ?? lightToken.primary},
      });

      map.addLayer({
        id: LAYER.point,
        type: 'circle',
        source: SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          // 9 at rest, 13.5 selected — the fleet map's radii and its 1.5×
          // relationship. A pin is read by its fill, and there is not enough of it
          // left to read at 6px behind a 2px stroke.
          'circle-radius': ['case', ['get', 'selected'], 13.5, 9],
          // The mount-time palette. The map is built once in an effect with no deps,
          // so a palette that changed later would never reach the shader — the
          // repaint effect below is what keeps this current.
          'circle-color': toneColor(tonesRef.current),
          'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
          'circle-stroke-color': [
            'case',
            ['get', 'selected'],
            lightToken.brand,
            lightToken.primary,
          ],
        },
      });

      // Attached here rather than beside the donuts, because it reads the fleet
      // layers' own paint to know what to dim them *from* — which means they have to
      // exist first.
      stateHover = attachStateHover(map, {
        pointLayerId: LAYER.point,
        clusterCircleLayerIds: [LAYER.clusterHalo, LAYER.clusterRing, LAYER.clusterCore],
        clusterCountLayerId: LAYER.clusterCount,
        // Under the bubbles and the pins: the wash is context for the fleet, not a
        // thing to read over it.
        beforeLayerId: LAYER.clusterHalo,
        countIn: (stateId) =>
          pointsRef.current.filter(
            (point) =>
              point.landmark === undefined && malaysiaStateAt(point.longitude, point.latitude) === stateId,
          ).length,
        countLabel: (count) => `${count} ${count === 1 ? countNounRef.current.one : countNounRef.current.many}`,
        // The same frame the fleet gets, so a clicked state sits where a fitted fleet
        // would — clear of the panel, if the panel is still there.
        fitPadding: () => ({...FIT_PADDING, right: FIT_PADDING.right + panelInsetRef.current}),
      });

      // Landmarks over everything: few, fixed, and the places the pins move
      // between. One image per tone, since a symbol's icon cannot take a colour.
      for (const tone of tonesRef.current) {
        const image = pinImage(tone.color);
        if (image !== undefined) map.addImage(landmarkImage(tone.key), image, {pixelRatio: 2});
      }
      // `promoteId` so a name's hover can be held as feature state.
      map.addSource(LANDMARK_SOURCE, {type: 'geojson', data: toFeatureCollection([], undefined), promoteId: 'id'});
      map.addLayer({
        id: LAYER.landmark,
        type: 'symbol',
        source: LANDMARK_SOURCE,
        layout: {
          'icon-image': ['concat', 'plant-landmark-', ['get', 'tone']],
          // The pin's tip on the place, as a map pin stands.
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
        },
      });
      // The name as a layer of its own, so a click can tell it from the pin: the
      // pin zooms, the name opens the place. Drawn as a link (Jeff, 2026-09-30):
      // the brand colour and a trailing `›`, going to the text colour on hover —
      // a map label cannot be underlined. Plain text where nothing opens it.
      map.addLayer({
        id: LAYER.landmarkLabel,
        type: 'symbol',
        source: LANDMARK_SOURCE,
        layout: {
          'text-field': onLandmarkOpenRef.current === undefined ? ['get', 'label'] : ['concat', ['get', 'label'], ' ›'],
          'text-font': ['Open Sans Bold', 'Open Sans Regular'],
          'text-size': 11,
          'text-anchor': 'left',
          // Beside the pin's head, which stands 18.5px above the place.
          'text-offset': [1.25, -1.7],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color':
            onLandmarkOpenRef.current === undefined
              ? lightToken.primary
              : ['case', ['boolean', ['feature-state', 'hover'], false], lightToken.primary, lightToken.brand],
          'text-halo-color': lightToken.canvas,
          'text-halo-width': 1.5,
        },
      });

      loadedRef.current = true;
      // The effects below may have run before this fired; push whatever they last
      // wanted now that the source exists.
      map.fire('plant.ready');
    });

    const handleClusterClick = (event: MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {layers: [LAYER.clusterCore]});
      const clusterId = feature?.properties?.cluster_id as number | undefined;
      if (clusterId === undefined) return;

      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      if (source === undefined) return;

      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
          duration: 500,
        });
      });
    };

    const handlePointClick = (event: MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {layers: [LAYER.point]});
      const id = feature?.properties?.id as string | undefined;
      if (id === undefined) return;
      onSelectRef.current(id);
    };

    /**
     * A landmark click zooms in on it (Jeff, 2026-09-30), and selects nothing: a
     * depot is where the trucks are, not one of them. To a town's scale, or one step
     * closer if the map is already there, and clear of the panel on the right.
     */
    const handleLandmarkClick = (event: MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {layers: [LAYER.landmark]});
      if (feature === undefined) return;
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom: Math.min(16, Math.max(LANDMARK_ZOOM, map.getZoom() + 1)),
        padding: {top: 0, bottom: 0, left: 0, right: panelInsetRef.current},
        duration: 600,
      });
    };

    const handleLandmarkLabelClick = (event: MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {layers: [LAYER.landmarkLabel]});
      const id = feature?.properties?.id as string | undefined;
      if (id !== undefined) onLandmarkOpenRef.current?.(id);
    };

    /**
     * A click on the basemap — no bubble, no pin — clears the selection.
     *
     * Bound to the map rather than to a layer, because what it listens for is the
     * *absence* of a feature and there is no background layer to bind to. The
     * layer-scoped handlers above fire for this same event, so it re-queries the
     * interactive layers and stands down whenever one of them was hit — which keeps
     * it independent of the order MapLibre dispatches the two in.
     *
     * A pan does not reach here: MapLibre's 3px `clickTolerance` means a drag ends
     * as `dragend` and never fires `click`.
     */
    const handleBackgroundClick = (event: MapMouseEvent) => {
      if (!loadedRef.current) return;
      const hits = map.queryRenderedFeatures(event.point, {layers: INTERACTIVE_LAYERS});
      if (hits.length > 0) return;
      onDeselectRef.current?.();
    };

    const setPointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', LAYER.clusterCore, handleClusterClick);
    map.on('click', LAYER.clusterHalo, handleClusterClick);
    map.on('click', LAYER.point, handlePointClick);
    map.on('click', LAYER.landmark, handleLandmarkClick);
    map.on('click', LAYER.landmarkLabel, handleLandmarkLabelClick);

    // The name's hover, as feature state the label's paint reads.
    let hoveredLandmark: string | undefined;
    const setLandmarkHover = (id: string | undefined) => {
      if (hoveredLandmark !== undefined) {
        map.setFeatureState({source: LANDMARK_SOURCE, id: hoveredLandmark}, {hover: false});
      }
      hoveredLandmark = id;
      if (id !== undefined) map.setFeatureState({source: LANDMARK_SOURCE, id}, {hover: true});
    };
    map.on('mousemove', LAYER.landmarkLabel, (event) => {
      setLandmarkHover(event.features?.[0]?.properties?.id as string | undefined);
    });
    map.on('mouseleave', LAYER.landmarkLabel, () => setLandmarkHover(undefined));
    map.on('click', handleBackgroundClick);
    for (const layer of INTERACTIVE_LAYERS) {
      map.on('mouseenter', layer, setPointer);
      map.on('mouseleave', layer, clearPointer);
    }

    // The tone ring inside each cluster's count, in the caller's order. Read through
    // the ref so a palette change recolours the rings without rebuilding the map,
    // exactly as it recolours the pins.
    const detachDonuts = attachClusterDonuts(map, {
      sourceId: SOURCE,
      clusterLayerId: LAYER.clusterCore,
      segmentsFor: (properties) =>
        tonesRef.current.map((tone) => ({
          color: tone.color,
          count: clusterCount(properties, toneKey(tone.key)),
        })),
      opacityFor: (properties) => stateHover?.clusterOpacity(properties) ?? 1,
    });

    map.on('error', (event) => {
      // Tile and glyph failures are recoverable — surface them rather than letting
      // the basemap silently come up blank.
      console.error('[PlantMap]', event.error?.message ?? event);
    });

    return () => {
      loadedRef.current = false;
      detachDonuts();
      stateHover?.();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // — Repaint when the palette changes, since the layer was built with the old one.
  //
  // Keyed on the colours rather than on the array's identity, so a caller passing a
  // fresh array of the same tones is not an instruction to the shader.
  const paletteKey = tones.map((tone) => `${tone.key}:${tone.color}`).join('|');

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const repaint = () => {
      if (map.getLayer(LAYER.point) === undefined) return;
      map.setPaintProperty(LAYER.point, 'circle-color', toneColor(tonesRef.current));
      // The pins are the shader's business and repaint themselves; the rings are
      // DOM, and nothing about the map has moved to make them redraw.
      refreshClusterDonuts(map);
    };

    if (loadedRef.current) {
      repaint();
      return;
    }
    map.once('plant.ready', repaint);
  }, [paletteKey]);

  // — Push data (and the selection highlight) into the source.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const push = () => {
      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      if (source === undefined) return;
      source.setData(
        toFeatureCollection(
          points.filter((point) => point.landmark === undefined),
          selectedId,
        ),
      );
      (map.getSource(LANDMARK_SOURCE) as GeoJSONSource | undefined)?.setData(
        toFeatureCollection(
          points.filter((point) => point.landmark !== undefined),
          undefined,
        ),
      );
    };

    if (loadedRef.current) {
      push();
      return;
    }
    map.once('plant.ready', push);
  }, [points, selectedId]);

  // — Frame the estate: the filtered set, or the rows the list is showing.
  //
  // Keyed on the *ids* rather than on the focus array's identity, so a scroll that
  // ends up on the same rows does not re-fit.
  const focusKey = focusIds === undefined || focusIds.length === 0 ? '' : focusIds.join(',');

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || points.length === 0) return;

    const framed =
      focusKey === ''
        ? points
        : points.filter((point) => focusKey.split(',').includes(point.id));
    if (framed.length === 0) return;

    const fit = () => {
      const bounds = new maplibregl.LngLatBounds();
      for (const point of framed) bounds.extend([point.longitude, point.latitude]);

      map.fitBounds(bounds, {
        padding: {...FIT_PADDING, right: FIT_PADDING.right + panelInset},
        // A single result would otherwise fit to street level, which loses all sense
        // of where in the country it is. Scrolling to the bottom of the list is the
        // ordinary way to reach that case, so it earns its keep here.
        maxZoom: 11,
        // Shorter than the 500ms a filter change gets: scrolling produces a run of
        // these, and a long ease would still be settling when the next one lands.
        duration: focusKey === '' ? 500 : 350,
      });
    };

    if (loadedRef.current) {
      fit();
      return;
    }
    map.once('plant.ready', fit);
    // `panelInset` deliberately excluded: toggling a panel should not re-frame the
    // map out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, focusKey]);

  // — Centre on a selection made elsewhere (the list, or a shared URL).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    // Deselecting forgets what we last flew to, so picking the same row again is
    // treated as a fresh selection and centres it — rather than being swallowed as a
    // repeat of a selection that is no longer on screen.
    if (selectedId === undefined) {
      flownToRef.current = undefined;
      return;
    }
    if (flownToRef.current === selectedId) return;

    const point = points.find((candidate) => candidate.id === selectedId);
    if (point === undefined) return;

    flownToRef.current = selectedId;

    const fly = () => {
      map.easeTo({
        center: [point.longitude, point.latitude],
        // Close enough to break the point out of its cluster, so the selected pin is
        // actually the thing on screen.
        zoom: Math.max(map.getZoom(), 11),
        duration: 600,
        offset: [-panelInset / 2, 0],
      });
    };

    if (loadedRef.current) {
      fly();
      return;
    }
    map.once('plant.ready', fly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, points]);

  return <div ref={containerRef} className="size-full" aria-label={label} />;
};
