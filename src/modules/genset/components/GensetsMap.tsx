import maplibregl from 'maplibre-gl';
import type {GeoJSONSource, LngLatLike, MapMouseEvent} from 'maplibre-gl';
import {useEffect, useRef} from 'react';

import {attachClusterDonuts, clusterCount} from '@/lib/clusterDonut';
import {MALAYSIA_STATE_CLUSTER_PROPERTIES, malaysiaStateAt} from '@/lib/geo/malaysiaStates';
import {attachStateHover} from '@/lib/geo/stateHover';
import type {StateHoverHandle} from '@/lib/geo/stateHover';
import {lightToken} from '@/styles/colors';
import {RUN_STATE_META} from './runStateMeta';
import {RUN_STATES, gensetLabel} from '../types/genset.type';
import type {Genset} from '../types/genset.type';

/**
 * CARTO's Voyager basemap. Chosen because it needs no account or access token —
 * the prototype has to run on a fresh clone with nothing configured — and
 * because it's a light basemap, which is what the design insets into the dark
 * shell. Swap this one constant to move to Mapbox or a self-hosted style.
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const SOURCE = 'gensets';
const LAYER = {
  clusterHalo: 'gensets-cluster-halo',
  clusterRing: 'gensets-cluster-ring',
  clusterCore: 'gensets-cluster-core',
  clusterCount: 'gensets-cluster-count',
  point: 'gensets-point',
} as const;

/**
 * The layers a click can land on — and, read in the negative, what makes a click
 * a click on the basemap. The cluster's count is not here: it is a symbol drawn
 * inside the 18px core, so a click on the number hits `clusterCore` anyway.
 */
const INTERACTIVE_LAYERS = [LAYER.clusterHalo, LAYER.clusterCore, LAYER.point];

/**
 * Malaysia, for the moment before any data has been fitted.
 *
 * Centred on the South China Sea rather than on either landmass, because the
 * estate spans both: a peninsular centre puts Kapit and Belaga off the right edge
 * on arrival, and a Bornean one loses the Klang Valley cluster the other way.
 */
const INITIAL_CENTER: LngLatLike = [109.5, 3.8];
const INITIAL_ZOOM = 5;

const FIT_PADDING = {top: 56, right: 56, bottom: 56, left: 56};

type GensetsMapProps = {
  gensets: Array<Genset>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /**
   * Clearing the selection — a click that landed on the basemap and nothing else.
   *
   * Optional: a map whose selection isn't its own to clear (the overview's, which
   * hands a pin click straight to another route) simply doesn't pass one.
   */
  onDeselect?: () => void;
  /**
   * Right-hand inset in px for the floating detail panel, so `fitBounds` doesn't
   * tuck pins underneath it.
   */
  panelInset: number;
  /**
   * The subset the map should frame — the rows currently on screen in the list
   * beside it, in the split view.
   *
   * Every genset stays *drawn*; this only decides what the viewport is fitted to.
   * Hiding the off-screen ones would make the map a second rendering of the list's
   * scroll position rather than a map of the fleet, and the cluster the design is
   * built around would dissolve as you scrolled.
   *
   * Empty, or absent, means frame everything — which is what the full-width map
   * view and the first paint both want.
   */
  focusIds?: Array<string>;
  /**
   * A click on a state — on the basemap inside it, not on a pin or a bubble. The
   * register filters its list to that state; the map frames it either way.
   */
  onStateSelect?: (stateId: string) => void;
  /**
   * Keep the current frame rather than fitting to the fleet — set by the register
   * after a state click, which frames the state itself. Without it the filter the
   * click sets would re-fit the map to the state's pins a moment later and undo it.
   */
  holdFrame?: boolean;
};

/**
 * The card a hovered pin shows: the plate, and the street address under it.
 *
 * DOM, like the state hover's card and in its colours, so the two read as one family
 * — the state card says what the region holds, this one what the pin is and where.
 * It sits just above the pin and over the state card, and never takes the pointer,
 * so it cannot steal the click that selects the set.
 */
const buildPinCard = (): {element: HTMLDivElement; plate: HTMLSpanElement; address: HTMLSpanElement} => {
  const element = document.createElement('div');
  element.className =
    'pointer-events-none flex max-w-[260px] flex-col items-start gap-0.5 rounded-lg bg-brand px-3 py-2 text-brand-text shadow-lg';
  element.style.zIndex = '20';
  element.setAttribute('aria-hidden', 'true');
  element.dataset.pinCard = '';

  const plate = document.createElement('span');
  plate.className = 'text-sm leading-tight font-semibold whitespace-nowrap';

  const address = document.createElement('span');
  address.className = 'text-xs leading-snug opacity-80';

  element.append(plate, address);
  return {element, plate, address};
};

const toFeatureCollection = (
  gensets: Array<Genset>,
  selectedId: string | undefined,
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: 'FeatureCollection',
  features: gensets.map((genset) => ({
    type: 'Feature',
    id: genset.id,
    geometry: {type: 'Point', coordinates: [genset.longitude, genset.latitude]},
    properties: {
      id: genset.id,
      runState: genset.runState,
      selected: genset.id === selectedId,
      // Which state this set stands in, so the hover can tell its own pins from
      // everyone else's — and so the cluster sums below have something to count.
      // Filed here rather than on the `Genset` itself because it is a fact about a
      // coordinate, not about a machine: move the set and it follows.
      stateId: malaysiaStateAt(genset.longitude, genset.latitude) ?? '',
    },
  })),
});

/**
 * Run state → pin fill, as a MapLibre `match` expression.
 *
 * Built from `RUN_STATE_META` rather than written out, so the map and the badges
 * can't drift apart: adding a state to the union breaks this at the type level
 * instead of silently falling through to the default colour.
 */
const runStateColor = (): maplibregl.ExpressionSpecification =>
  // A `match` expression is variadic — N label/value pairs then a fallback — and
  // TypeScript can't derive that tuple shape from a `flatMap`, so the assertion
  // is unavoidable here. What it is not doing is papering over a missing case:
  // the pairs come from `RUN_STATES`, so the arm list is exhaustive by
  // construction and a new state can't slip through.
  [
    'match',
    ['get', 'runState'],
    ...RUN_STATES.flatMap((state) => [state, RUN_STATE_META[state].mapColor]),
    RUN_STATE_META.OFFLINE.mapColor,
  ] as unknown as maplibregl.ExpressionSpecification;

export const GensetsMap = ({
  gensets,
  selectedId,
  onSelect,
  onDeselect,
  panelInset,
  focusIds,
  onStateSelect,
  holdFrame,
}: GensetsMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

  // `onSelect` is read from inside a MapLibre click handler that is registered
  // once. Holding it in a ref keeps that handler pointed at the current closure
  // without tearing the map down and rebuilding it on every render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onDeselectRef = useRef(onDeselect);
  onDeselectRef.current = onDeselect;
  const onStateSelectRef = useRef(onStateSelect);
  onStateSelectRef.current = onStateSelect;

  // Read by the fleet fit below, which stands down while it is set. A ref so the
  // effect sees this render's value without re-running on it.
  const holdFrameRef = useRef(holdFrame);
  holdFrameRef.current = holdFrame;

  // The rows currently drawn, read from inside the state hover's count. A ref for
  // the same reason as the handlers above — and because the count has to follow the
  // toolbar: hovering Sarawak with the list filtered to Offline answers "how many
  // offline sets are in Sarawak", which is the question the screen is already asking.
  const gensetsRef = useRef(gensets);
  gensetsRef.current = gensets;

  // Read by the state click's fit, which runs after the same click may have closed
  // the panel — so a ref the fit reads late, not a width captured at attach.
  const panelInsetRef = useRef(panelInset);
  panelInsetRef.current = panelInset;

  // Which selection we last flew to. Without this the map re-centres on every
  // unrelated render, yanking the viewport away from wherever the user panned.
  //
  // Seeded with whatever was selected on the first render, which is what stops
  // the map zooming straight into one unit on arrival: opening the map view with
  // a genset already chosen should land on the fleet with its panel open — the
  // view the design shows — not on a single pin at street level.
  const flownToRef = useRef<string | undefined>(selectedId);

  // — Create the map once.
  useEffect(() => {
    if (containerRef.current === null) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: {compact: true},
    });
    mapRef.current = map;

    // Dev-only handle. Map bugs are hard to reach from React DevTools — almost
    // everything worth checking (zoom, source data, rendered features) lives on
    // this object and nowhere in the component tree.
    if (import.meta.env.DEV) {
      (window as unknown as {__gensetMap?: maplibregl.Map}).__gensetMap = map;
    }

    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'bottom-right');

    // `style.load`, not `load`: MapLibre defers `load` until the style has
    // parsed *and* the map has painted a frame. A hidden or backgrounded tab
    // gets no animation frames, so `load` never fires there and the fleet layers
    // are never added — the map comes up as an empty basemap and stays that way
    // until the tab is focused. `style.load` fires as soon as the style is
    // parsed, which is all that adding sources and layers actually requires.
    // Assigned at the end of `style.load`, once there are fleet layers for it to
    // dim. The donut rings below close over it and are attached first, so they read
    // it lazily rather than being handed it.
    let stateHover: StateHoverHandle | undefined;

    map.on('style.load', () => {
      map.addSource(SOURCE, {
        type: 'geojson',
        data: toFeatureCollection([], undefined),
        cluster: true,
        // Stop clustering before the city scale, so zooming into the Klang
        // Valley always resolves the group into individual units.
        clusterMaxZoom: 11,
        clusterRadius: 60,
        // Carry a per-run-state count up into every cluster, so a bubble knows
        // the mix of what it swallowed and not just how much. This is what the
        // donut ring is drawn from — the alternative, `getClusterLeaves` per
        // bubble, is async and would leave the rings a frame behind the map.
        clusterProperties: {
          ...(Object.fromEntries(
            RUN_STATES.map((state) => [
              state,
              ['+', ['case', ['==', ['get', 'runState'], state], 1, 0]],
            ]),
          ) as Record<string, maplibregl.ExpressionSpecification>),
          // And the same again per Malaysian state, so a bubble knows whether any
          // of what it swallowed stands in the one under the cursor.
          ...MALAYSIA_STATE_CLUSTER_PROPERTIES,
        },
      });

      // The cluster bubble is three stacked circles — two translucent haloes and
      // an opaque core — which is how the design draws its concentric rings.
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
          'circle-color': lightToken.canvas,
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
        paint: {'text-color': lightToken.primary},
      });

      map.addLayer({
        id: LAYER.point,
        type: 'circle',
        source: SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          // 9 at rest, 13.5 selected — both scaled up by half from the 6/9 the
          // pins started at. The fill is what carries run state, and at a 6px
          // radius behind a 2px stroke there was barely any of it left to read:
          // an offline pin and a running pin were distinguishable by inspection but
          // not at a glance, which is the only thing a pin is for. The selected
          // pin scales with it so the pair keeps its 1.5× relationship, and
          // separation stays a matter of size rather than of stroke alone.
          'circle-radius': ['case', ['get', 'selected'], 13.5, 9],
          'circle-color': runStateColor(),
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
          gensetsRef.current.filter(
            (genset) => malaysiaStateAt(genset.longitude, genset.latitude) === stateId,
          ).length,
        countLabel: (count) => `${count} ${count === 1 ? 'genset' : 'gensets'}`,
        // The same frame the fleet gets, so a clicked state sits where a fitted fleet
        // would — clear of the panel, if the panel is still there.
        fitPadding: () => ({...FIT_PADDING, right: FIT_PADDING.right + panelInsetRef.current}),
        onStateClick: (stateId) => onStateSelectRef.current?.(stateId),
      });

      loadedRef.current = true;
      // The data effect below may have run before `load` fired; push whatever it
      // last wanted now that the source exists.
      map.fire('gensetiq.ready');
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
     * A click on the basemap — no bubble, no pin — clears the selection and puts
     * the detail panel away.
     *
     * Bound to the map rather than to a layer, because what it listens for is the
     * *absence* of a feature and there is no background layer to bind to. The
     * layer-scoped handlers above fire for this same event, so it re-queries the
     * interactive layers and stands down whenever one of them was hit — which
     * keeps it independent of the order MapLibre dispatches the two in, rather
     * than relying on a flag one of them sets.
     *
     * Guarded on `loadedRef` because those layers only exist from `style.load`,
     * and querying a layer the style hasn't got raises a map error.
     *
     * A pan doesn't reach here: MapLibre's 3px `clickTolerance` means a drag ends
     * as `dragend` and never fires `click`. So dragging the map past a pin leaves
     * the selection where it was.
     */
    const handleBackgroundClick = (event: MapMouseEvent) => {
      if (!loadedRef.current) return;
      const hits = map.queryRenderedFeatures(event.point, {layers: INTERACTIVE_LAYERS});
      if (hits.length > 0) return;
      onDeselectRef.current?.();
    };

    // The pin hover card. Placed at the pin's own coordinates rather than the
    // cursor's, so it stays put while the cursor moves across the dot.
    const pinCard = buildPinCard();
    const pinMarker = new maplibregl.Marker({element: pinCard.element, anchor: 'bottom', offset: [0, -14]});
    let pinShown: string | undefined;
    const handlePinMove = (event: MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {layers: [LAYER.point]});
      const id = feature?.properties?.id as string | undefined;
      const genset = id === undefined ? undefined : gensetsRef.current.find((candidate) => candidate.id === id);
      if (genset === undefined) {
        handlePinLeave();
        return;
      }
      if (pinShown === genset.id) return;
      pinCard.plate.textContent = gensetLabel(genset);
      pinCard.address.textContent = genset.address;
      pinMarker.setLngLat([genset.longitude, genset.latitude]).addTo(map);
      pinShown = genset.id;
    };
    const handlePinLeave = () => {
      if (pinShown === undefined) return;
      pinMarker.remove();
      pinShown = undefined;
    };
    map.on('mousemove', LAYER.point, handlePinMove);
    map.on('mouseleave', LAYER.point, handlePinLeave);

    const setPointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', LAYER.clusterCore, handleClusterClick);
    map.on('click', LAYER.clusterHalo, handleClusterClick);
    map.on('click', LAYER.point, handlePointClick);
    map.on('click', handleBackgroundClick);
    for (const layer of INTERACTIVE_LAYERS) {
      map.on('mouseenter', layer, setPointer);
      map.on('mouseleave', layer, clearPointer);
    }

    // The run-state ring inside each cluster's count. Segments run in
    // `RUN_STATES` order — running first, from twelve o'clock — so the same fleet
    // always draws the same ring and the eye learns where to look for trouble.
    const detachDonuts = attachClusterDonuts(map, {
      sourceId: SOURCE,
      clusterLayerId: LAYER.clusterCore,
      segmentsFor: (properties) =>
        RUN_STATES.map((state) => ({
          color: RUN_STATE_META[state].mapColor,
          count: clusterCount(properties, state),
        })),
      opacityFor: (properties) => stateHover?.clusterOpacity(properties) ?? 1,
    });

    map.on('error', (event) => {
      // Tile and glyph failures are recoverable — surface them rather than
      // letting the basemap silently come up blank.
      console.error('[GensetsMap]', event.error?.message ?? event);
    });

    return () => {
      loadedRef.current = false;
      detachDonuts();
      stateHover?.();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // — Push data (and the selection highlight) into the source.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const push = () => {
      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      if (source === undefined) return;
      source.setData(toFeatureCollection(gensets, selectedId));
    };

    if (loadedRef.current) {
      push();
      return;
    }
    map.once('gensetiq.ready', push);
  }, [gensets, selectedId]);

  // — Frame the fleet: the filtered set, or the rows the list is showing.
  //
  // Keyed on the *ids* rather than on the focus array's identity, so a scroll that
  // ends up on the same rows doesn't re-fit. `useVisibleRowIds` already collapses
  // most of that, but a re-render of the page hands over a fresh array and this is
  // what stops it reaching MapLibre as a new instruction.
  const focusKey = focusIds === undefined || focusIds.length === 0 ? '' : focusIds.join(',');

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || gensets.length === 0) return;
    if (holdFrameRef.current === true) return;

    const framed =
      focusKey === '' ? gensets : gensets.filter((genset) => focusKey.split(',').includes(genset.id));
    if (framed.length === 0) return;

    const fit = () => {
      const bounds = new maplibregl.LngLatBounds();
      for (const genset of framed) bounds.extend([genset.longitude, genset.latitude]);

      map.fitBounds(bounds, {
        padding: {...FIT_PADDING, right: FIT_PADDING.right + panelInset},
        // A single result would otherwise fit to street level, which loses all
        // sense of where in the country it is. Scrolling to the bottom of the list
        // is the ordinary way to reach that case, so it earns its keep here.
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
    map.once('gensetiq.ready', fit);
    // `panelInset` deliberately excluded: toggling the detail panel shouldn't
    // re-frame the map out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gensets, focusKey]);

  // — Centre on a selection made elsewhere (the list, or a shared URL).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    // Deselecting forgets what we last flew to, so picking the same unit again is
    // treated as a fresh selection and centres it — rather than being swallowed as
    // a repeat of a selection that is no longer on screen.
    if (selectedId === undefined) {
      flownToRef.current = undefined;
      return;
    }
    if (flownToRef.current === selectedId) return;

    const genset = gensets.find((candidate) => candidate.id === selectedId);
    if (genset === undefined) return;

    flownToRef.current = selectedId;

    const fly = () => {
      map.easeTo({
        center: [genset.longitude, genset.latitude],
        // Close enough to break the unit out of its cluster, so the selected pin
        // is actually the thing on screen.
        zoom: Math.max(map.getZoom(), 12),
        duration: 600,
        offset: [-panelInset / 2, 0],
      });
    };

    if (loadedRef.current) {
      fly();
      return;
    }
    map.once('gensetiq.ready', fly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, gensets]);

  return <div ref={containerRef} className="size-full" aria-label="Genset locations map" />;
};
