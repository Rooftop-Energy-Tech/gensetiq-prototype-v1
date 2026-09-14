import maplibregl from 'maplibre-gl';
import type {GeoJSONSource, LngLatLike, MapMouseEvent} from 'maplibre-gl';
import {useEffect, useRef} from 'react';

import {attachClusterDonuts, clusterCount, refreshClusterDonuts} from '@/lib/clusterDonut';
import {lightToken} from '@/styles/colors';

/**
 * The estate map, for a register whose rows are **plant at a site** — a solar
 * system, a battery bank.
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
const LAYER = {
  clusterHalo: 'plant-cluster-halo',
  clusterRing: 'plant-cluster-ring',
  clusterCore: 'plant-cluster-core',
  clusterCount: 'plant-cluster-count',
  point: 'plant-point',
} as const;

/** The layers a click can land on — and, read in the negative, what a basemap click is. */
const INTERACTIVE_LAYERS = [LAYER.clusterHalo, LAYER.clusterCore, LAYER.point];

/**
 * Malaysia, for the moment before any data has been fitted. Centred on the South
 * China Sea rather than either landmass, because the estate spans both.
 */
const INITIAL_CENTER: LngLatLike = [109.5, 3.8];
const INITIAL_ZOOM = 5;

const FIT_PADDING = {top: 56, right: 56, bottom: 56, left: 56};

/** One pin: where it is, and which of the caller's tones paints it. */
export type PlantPoint = {
  id: string;
  latitude: number;
  longitude: number;
  /** A key in `tones`. An unrecognised one falls back to the first tone's colour. */
  tone: string;
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
  /** The map's accessible name — `Solar system locations map`. */
  label: string;
};

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
  panelInset = 0,
  focusIds,
  label,
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
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
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
        clusterProperties: Object.fromEntries(
          tonesRef.current.map((tone) => [
            toneKey(tone.key),
            ['+', ['case', ['==', ['get', 'tone'], tone.key], 1, 0]],
          ]),
        ) as Record<string, maplibregl.ExpressionSpecification>,
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
    });

    map.on('error', (event) => {
      // Tile and glyph failures are recoverable — surface them rather than letting
      // the basemap silently come up blank.
      console.error('[PlantMap]', event.error?.message ?? event);
    });

    return () => {
      loadedRef.current = false;
      detachDonuts();
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
      source.setData(toFeatureCollection(points, selectedId));
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
