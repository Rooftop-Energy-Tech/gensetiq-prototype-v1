import maplibregl from 'maplibre-gl';
import type {GeoJSONSource, LngLatLike, MapMouseEvent} from 'maplibre-gl';
import {useEffect, useRef} from 'react';

import {attachClusterDonuts, clusterCount, refreshClusterDonuts} from '@/lib/clusterDonut';
import {lightToken} from '@/styles/colors';
import {CONDITION_META} from '@/modules/genset/components/detail/severityMeta';
import {FLEET_STATUSES, STATUS_META} from '@/modules/genset/data/fleetStatus';
import {siteStatus} from '../data/estateSummary';
import type {SiteSummary} from '../data/sites';

/**
 * The sites map — the fleet map's twin, one level up.
 *
 * Everything structural here is `GensetsMap`'s and deliberately so: same CARTO
 * basemap, same three-circle cluster bubble, same `style.load` timing, same
 * fit-then-fly viewport rules. Two maps in one product that cluster differently or
 * frame differently read as two products.
 *
 * Two things are genuinely different, and both follow from what a site *is*:
 *
 *  - **pins are coloured by condition, not run state.** A site has no run state —
 *    it is a place with a load, and the machines standing on it are what turn. Its
 *    own verdict is the worst condition among them, which is also what the list
 *    ranks by, so the map and the list agree on which sites are worth looking at.
 *  - **a pin's size carries how many sets stand there.** On the fleet map every
 *    pin is one machine and size is free to mean selection alone. Here a pin is a
 *    yard, and "one set or three" is the difference between a site that loses its
 *    supply when a machine faults and one that does not.
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const SOURCE = 'sites';
const LAYER = {
  clusterHalo: 'sites-cluster-halo',
  clusterRing: 'sites-cluster-ring',
  clusterCore: 'sites-cluster-core',
  clusterCount: 'sites-cluster-count',
  point: 'sites-point',
} as const;

/** Sabah and Labuan, for the moment before any data has been fitted. */
const INITIAL_CENTER: LngLatLike = [116.9, 5.5];
const INITIAL_ZOOM = 7;

const FIT_PADDING = {top: 56, right: 56, bottom: 56, left: 56};

type SitesMapProps = {
  summaries: Array<SiteSummary>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /**
   * Right-hand inset in px for the floating preview panel, so `fitBounds` doesn't
   * tuck pins underneath it.
   */
  panelInset: number;
  /**
   * The subset to frame — the rows on screen in the list beside it. Every site
   * stays drawn; see `GensetsMap` for why framing and filtering are kept apart.
   */
  focusIds?: Array<string>;
  /**
   * Which verdict the pins are painted by.
   *
   * `condition` is the sites list's own scale — worst alarm among the sets — and is
   * what the list's Condition column shows, so the map beside it agrees with the
   * rows. `status` is the overview's four buckets, so the pins there agree with the
   * tiles above them.
   *
   * A prop rather than a second map component, because the two differ in one paint
   * expression and nothing else: the clustering, the framing, the fly-to and the
   * count-driven radius are the same map. A copy would drift on all of them to
   * express a difference in one.
   */
  colorBy?: 'condition' | 'status';
};

const toFeatureCollection = (
  summaries: Array<SiteSummary>,
  selectedId: string | undefined,
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: 'FeatureCollection',
  features: summaries.map((summary) => ({
    type: 'Feature',
    id: summary.site.id,
    geometry: {
      type: 'Point',
      coordinates: [summary.site.longitude, summary.site.latitude],
    },
    properties: {
      id: summary.site.id,
      condition: summary.condition,
      status: siteStatus(summary),
      // The yard's own count, so pin size says how much plant is standing here.
      // A site with no sets attached is a real state — see `siteSeed.ts` — and it
      // draws at the floor radius rather than vanishing.
      gensetCount: summary.gensets.length,
      selected: summary.site.id === selectedId,
    },
  })),
});

/**
 * Condition → pin fill, as a MapLibre `match` expression.
 *
 * Built from `CONDITION_META` rather than written out, for the reason the fleet
 * map builds its own from `RUN_STATE_META`: the arms come from a
 * `Record<GensetCondition, …>`, so they are exhaustive by construction and a new
 * condition cannot quietly fall through to the fallback.
 */
const conditionColor = (): maplibregl.ExpressionSpecification =>
  // A `match` expression is variadic — N label/value pairs then a fallback — and
  // TypeScript cannot derive that tuple shape from a `flatMap`, so the assertion
  // is unavoidable. It is not covering a missing case.
  [
    'match',
    ['get', 'condition'],
    ...Object.entries(CONDITION_META).flatMap(([condition, meta]) => [condition, meta.mapColor]),
    CONDITION_META.OPTIMUM.mapColor,
  ] as unknown as maplibregl.ExpressionSpecification;

/**
 * The four buckets → pin fill, built from `STATUS_META` for the reason above: the
 * arms come from the `FleetStatus` union, so they cannot fall out of step with the
 * tiles that share the record.
 */
const statusColor = (): maplibregl.ExpressionSpecification =>
  [
    'match',
    ['get', 'status'],
    ...FLEET_STATUSES.flatMap((status) => [status, STATUS_META[status].mapColor]),
    STATUS_META.OK.mapColor,
  ] as unknown as maplibregl.ExpressionSpecification;

/**
 * Conditions worst-first, which is the order the donut ring inside a cluster's
 * count is drawn in — critical from twelve o'clock, so the same estate always
 * draws the same ring and the eye learns where to look. `CONDITION_META` is a
 * record and carries no order of its own; this is that order written down.
 */
const CONDITIONS = ['CRITICAL', 'ATTENTION', 'OPTIMUM'] as const;

/**
 * The per-bucket tallies each cluster carries up from its sites.
 *
 * Both vocabularies are accumulated, not just the one in force: `colorBy` can
 * change without the data moving — the overview paints by status and the sites
 * page by condition, off the same component — and a source rebuilt to follow it
 * would drop every cluster and re-cluster the estate to recolour a ring.
 *
 * Namespaced because the two unions are only accidentally disjoint; `ALARM` and
 * `ATTENTION` sitting in one flat namespace is a collision waiting for whichever
 * vocabulary grows first.
 */
const conditionKey = (condition: string) => `condition:${condition}`;
const statusKey = (status: string) => `status:${status}`;

const CLUSTER_PROPERTIES = Object.fromEntries([
  ...CONDITIONS.map((condition) => [
    conditionKey(condition),
    ['+', ['case', ['==', ['get', 'condition'], condition], 1, 0]],
  ]),
  ...FLEET_STATUSES.map((status) => [
    statusKey(status),
    ['+', ['case', ['==', ['get', 'status'], status], 1, 0]],
  ]),
]) as Record<string, maplibregl.ExpressionSpecification>;

/**
 * Radius from genset count: 8px for one set, 12px at four or more, interpolated
 * between — and 1.5× that when selected, the ratio the fleet map's pins keep.
 *
 * Interpolated rather than one radius per count so the scale keeps working if a
 * yard ever holds six, and floored at 8px because a pin below that stops being a
 * click target.
 */
const COUNT_RADIUS: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'gensetCount'],
  0,
  8,
  4,
  12,
];

const POINT_RADIUS: maplibregl.ExpressionSpecification = [
  'case',
  ['get', 'selected'],
  ['*', COUNT_RADIUS, 1.5],
  COUNT_RADIUS,
];

export const SitesMap = ({
  summaries,
  selectedId,
  onSelect,
  panelInset,
  focusIds,
  colorBy = 'condition',
}: SitesMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

  // Read inside the layer-creation closure, which runs once. Held in a ref for the
  // reason `onSelect` is: so the map is not torn down and rebuilt to change a colour.
  const colorByRef = useRef(colorBy);
  colorByRef.current = colorBy;

  // `onSelect` is read from inside a MapLibre click handler registered once.
  // Holding it in a ref keeps that handler pointed at the current closure without
  // tearing the map down and rebuilding it on every render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Which selection we last flew to, seeded with whatever was selected on the
  // first render — so arriving with a site already chosen lands on the estate with
  // its panel open rather than zoomed into one yard.
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

    // Dev-only handle, same as the fleet map's: zoom, source data and rendered
    // features all live on this object and nowhere in the component tree.
    if (import.meta.env.DEV) {
      (window as unknown as {__siteMap?: maplibregl.Map}).__siteMap = map;
    }

    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'bottom-right');

    // `style.load`, not `load`: MapLibre defers `load` until the map has painted a
    // frame, which a hidden or backgrounded tab never does — so the layers would
    // never be added and the map would come up as a bare basemap until focused.
    map.on('style.load', () => {
      map.addSource(SOURCE, {
        type: 'geojson',
        data: toFeatureCollection([], undefined),
        cluster: true,
        // Sites are sparser than gensets — several sets share one yard — so this
        // stops clustering a zoom level earlier than the fleet map does. Past the
        // Klang Valley's own scale, a bubble over two yards hides more than the
        // overlap it prevents.
        clusterMaxZoom: 10,
        clusterRadius: 55,
        // Carry the per-bucket counts up into every cluster, so a bubble knows the
        // mix of what it swallowed and not just how much — which is what its donut
        // ring is drawn from. The alternative, `getClusterLeaves` per bubble, is
        // async and would leave the rings a frame behind the map.
        clusterProperties: CLUSTER_PROPERTIES,
      });

      // Three stacked circles — two translucent haloes and an opaque core — which
      // is how the design draws its concentric rings.
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
          // Geist isn't in CARTO's glyph set; Open Sans is the closest it serves.
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
          'circle-radius': POINT_RADIUS,
          // The mount-time value. The map is built once in an effect with no deps,
          // so a `colorBy` that changed later would never reach the shader — the
          // effect below is what keeps the paint current.
          'circle-color': colorByRef.current === 'status' ? statusColor() : conditionColor(),
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
      // The data effect below may have run before this fired; push whatever it
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

    const setPointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', LAYER.clusterCore, handleClusterClick);
    map.on('click', LAYER.clusterHalo, handleClusterClick);
    map.on('click', LAYER.point, handlePointClick);
    for (const layer of [LAYER.clusterCore, LAYER.clusterHalo, LAYER.point]) {
      map.on('mouseenter', layer, setPointer);
      map.on('mouseleave', layer, clearPointer);
    }

    // The ring inside each cluster's count, on whichever scale the pins are using:
    // the mix of conditions in that group of yards, or the mix of fleet-status
    // buckets. Read through the ref so a scale change recolours the rings without
    // rebuilding the map, exactly as it recolours the pins.
    const detachDonuts = attachClusterDonuts(map, {
      sourceId: SOURCE,
      clusterLayerId: LAYER.clusterCore,
      segmentsFor: (properties) =>
        colorByRef.current === 'status'
          ? FLEET_STATUSES.map((status) => ({
              color: STATUS_META[status].mapColor,
              count: clusterCount(properties, statusKey(status)),
            }))
          : CONDITIONS.map((condition) => ({
              color: CONDITION_META[condition].mapColor,
              count: clusterCount(properties, conditionKey(condition)),
            })),
    });

    map.on('error', (event) => {
      // Tile and glyph failures are recoverable — surface them rather than letting
      // the basemap silently come up blank.
      console.error('[SitesMap]', event.error?.message ?? event);
    });

    return () => {
      loadedRef.current = false;
      detachDonuts();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // — Repaint when the scale changes, since the layer was built with the old one.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const repaint = () => {
      if (map.getLayer(LAYER.point) === undefined) return;
      map.setPaintProperty(
        LAYER.point,
        'circle-color',
        colorBy === 'status' ? statusColor() : conditionColor(),
      );
      // The pins are the shader's business and repaint themselves; the rings are
      // DOM, and nothing about the map has moved to make them redraw.
      refreshClusterDonuts(map);
    };

    if (loadedRef.current) {
      repaint();
      return;
    }
    map.once('gensetiq.ready', repaint);
  }, [colorBy]);

  // — Push data (and the selection highlight) into the source.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const push = () => {
      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      if (source === undefined) return;
      source.setData(toFeatureCollection(summaries, selectedId));
    };

    if (loadedRef.current) {
      push();
      return;
    }
    map.once('gensetiq.ready', push);
  }, [summaries, selectedId]);

  // — Frame the estate: the filtered set, or the rows the list is showing. Keyed on
  // ids rather than array identity, for the reason `GensetsMap` gives.
  const focusKey = focusIds === undefined || focusIds.length === 0 ? '' : focusIds.join(',');

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || summaries.length === 0) return;

    const framed =
      focusKey === ''
        ? summaries
        : summaries.filter((summary) => focusKey.split(',').includes(summary.site.id));
    if (framed.length === 0) return;

    const fit = () => {
      const bounds = new maplibregl.LngLatBounds();
      for (const summary of framed) {
        bounds.extend([summary.site.longitude, summary.site.latitude]);
      }

      map.fitBounds(bounds, {
        padding: {...FIT_PADDING, right: FIT_PADDING.right + panelInset},
        // A single result would otherwise fit to street level, which loses all
        // sense of where in the country it is.
        maxZoom: 11,
        duration: focusKey === '' ? 500 : 350,
      });
    };

    if (loadedRef.current) {
      fit();
      return;
    }
    map.once('gensetiq.ready', fit);
    // `panelInset` deliberately excluded: toggling the preview panel shouldn't
    // re-frame the map out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, focusKey]);

  // — Centre on a selection made elsewhere (the list, or a shared URL).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || selectedId === undefined) return;
    if (flownToRef.current === selectedId) return;

    const summary = summaries.find((candidate) => candidate.site.id === selectedId);
    if (summary === undefined) return;

    flownToRef.current = selectedId;

    const fly = () => {
      map.easeTo({
        center: [summary.site.longitude, summary.site.latitude],
        // Close enough to break the yard out of its cluster, so the selected pin
        // is actually the thing on screen.
        zoom: Math.max(map.getZoom(), 11),
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
  }, [selectedId, summaries]);

  return <div ref={containerRef} className="size-full" aria-label="Site locations map" />;
};
