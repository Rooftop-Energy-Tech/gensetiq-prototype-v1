import maplibregl from 'maplibre-gl';
import type {GeoJSONSource, LngLatLike, MapMouseEvent} from 'maplibre-gl';
import {useEffect, useRef} from 'react';

import {attachClusterDonuts, clusterCount} from '@/lib/clusterDonut';
import {lightToken} from '@/styles/colors';
import type {DeploymentRow} from '../data/feed';

/**
 * Where the fleet has been sent — the registers' map, over postings.
 *
 * Everything structural is `SitesMap`'s and deliberately so: same CARTO basemap,
 * same three-circle cluster bubble, same `style.load` timing, same fit-then-fly
 * viewport rules. Three maps in one product that cluster or frame differently read
 * as three products.
 *
 * What is different follows from what a posting *is*:
 *
 *  - **a pin is a posting, not a place.** Two sets standing at one substation are two
 *    pins at one coordinate, because two machines is two lorries and two fuel bills.
 *    The map jitters nothing to separate them — the cluster bubble already says "more
 *    than one here", and moving a pin off its yard to make it visible would put a
 *    machine somewhere it has never been.
 *  - **colour is the posting's state**, which is the whole of what a posting has:
 *    open in the live green this app uses for a running machine, closed in the muted
 *    grey it uses for a record. Those are the strip's own two chips, so the filter
 *    above the map and the colours on it agree.
 *  - **closed postings are drawn at all**, which is the call worth stating. A map of
 *    only what is out would be a smaller and cleaner map; it would also be unable to
 *    answer "have we had a set at Kapit before", which is the question a dispatcher
 *    asks before quoting one. The strip's `Deployed` chip is one click away for
 *    anybody who wants the smaller map.
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const SOURCE = 'deployments';
const LAYER = {
  clusterHalo: 'deployments-cluster-halo',
  clusterRing: 'deployments-cluster-ring',
  clusterCore: 'deployments-cluster-core',
  clusterCount: 'deployments-cluster-count',
  point: 'deployments-point',
} as const;

const INTERACTIVE_LAYERS = [LAYER.clusterHalo, LAYER.clusterCore, LAYER.point];

/** Malaysia, before any data has been fitted — `SitesMap`'s centre, for its reason. */
const INITIAL_CENTER: LngLatLike = [109.5, 3.8];
const INITIAL_ZOOM = 5;

const FIT_PADDING = {top: 56, right: 56, bottom: 56, left: 56};

/** The three states, and the one place their colours are written down. */
const STATE_COLOR = {
  active: lightToken['severity-ok'],
  // The brand accent, for the reason `stateMeta.ts` gives: a booked job is not a
  // condition, so it does not take a severity colour.
  planned: lightToken.brand,
  // A literal rather than `lightToken.tertiary`, which is the text scale's 40%
  // black-on-white: an alpha colour over a basemap takes the roads' own colour
  // through it, and a pin that changes hue as it crosses a motorway is not a
  // category any more. This is that grey resolved against the canvas.
  completed: '#9A9DA6',
} as const;

type DeploymentsMapProps = {
  rows: Array<DeploymentRow>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** A click that landed on the basemap and nothing else. */
  onDeselect?: () => void;
  /** Right-hand inset in px for the floating preview panel. */
  panelInset: number;
  /**
   * The subset to frame — the rows on screen in the list beside it. Every posting
   * stays drawn; see `GensetsMap` for why framing and filtering are kept apart.
   */
  focusIds?: Array<string>;
};

/**
 * Only the jobs whose yard is still in the dataset can be drawn.
 *
 * A job keeps its placename but not its coordinates — see `Deployment`, where the
 * label is copied so history survives a rename — so a site dropped from a brand's
 * dataset leaves rows the table can still print and the map cannot place. They are
 * filtered out here rather than drawn at [0, 0] in the Gulf of Guinea.
 */
const placed = (rows: Array<DeploymentRow>): Array<DeploymentRow> =>
  rows.filter((row) => row.latitude !== undefined && row.longitude !== undefined);

const toFeatureCollection = (
  rows: Array<DeploymentRow>,
  selectedId: string | undefined,
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: 'FeatureCollection',
  features: placed(rows).map((row) => ({
    type: 'Feature',
    id: row.deployment.id,
    geometry: {
      type: 'Point',
      coordinates: [row.longitude as number, row.latitude as number],
    },
    properties: {
      id: row.deployment.id,
      state: row.state,
      // The pin's size says how much plant is standing there, which is the sites
      // map's channel and the same question here: one set for a fortnight and three
      // for a fortnight are not the same job.
      members: row.members.length,
      selected: row.deployment.id === selectedId,
    },
  })),
});

const stateColor = (): maplibregl.ExpressionSpecification => [
  'match',
  ['get', 'state'],
  'active',
  STATE_COLOR.active,
  'planned',
  STATE_COLOR.planned,
  'completed',
  STATE_COLOR.completed,
  STATE_COLOR.completed,
];

/**
 * The per-state tallies each cluster carries up — the donut ring inside its count.
 *
 * Standing first, so the ring is drawn from twelve o'clock in the same order every
 * time and the eye learns where to look. Namespaced like the sites map's, which costs
 * nothing and is what keeps two vocabularies from colliding the day a second one
 * arrives.
 */
const stateKey = (state: string) => `state:${state}`;

const CLUSTER_PROPERTIES = Object.fromEntries(
  (['active', 'planned', 'completed'] as const).map((state) => [
    stateKey(state),
    ['+', ['case', ['==', ['get', 'state'], state], 1, 0]],
  ]),
) as Record<string, maplibregl.ExpressionSpecification>;

/**
 * A standing job draws larger than a booked or closed one, and a job with more
 * machines on it larger again.
 *
 * Two channels doing two jobs. Colour is the state; size is *how much is there*,
 * which is the sites map's own channel and the question this map is asked next: a
 * stack of last year's history at a yard should not out-shout three sets standing in
 * it today. 1.5× when selected, the ratio every pin in this app keeps.
 */
const stateBase: maplibregl.ExpressionSpecification = [
  'case',
  ['==', ['get', 'state'], 'active'],
  10,
  ['==', ['get', 'state'], 'planned'],
  8,
  7,
];

const POINT_RADIUS: maplibregl.ExpressionSpecification = [
  '*',
  ['case', ['get', 'selected'], 1.5, 1],
  // A third machine adds as much as a second, and a fourth would too: the growth is
  // linear and capped by there being three sets at most on this fleet's jobs.
  ['+', stateBase, ['*', 1.5, ['-', ['min', ['get', 'members'], 4], 1]]],
];

export const DeploymentsMap = ({
  rows,
  selectedId,
  onSelect,
  onDeselect,
  panelInset,
  focusIds,
}: DeploymentsMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

  // Read from inside handlers registered once — the registers' refs, for their
  // reason: it keeps the handler pointed at the current closure without tearing the
  // map down and rebuilding it on every render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onDeselectRef = useRef(onDeselect);
  onDeselectRef.current = onDeselect;

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

    if (import.meta.env.DEV) {
      (window as unknown as {__deploymentMap?: maplibregl.Map}).__deploymentMap = map;
    }

    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'bottom-right');

    // `style.load`, not `load` — see `SitesMap`: MapLibre defers `load` until the map
    // has painted a frame, which a backgrounded tab never does.
    map.on('style.load', () => {
      map.addSource(SOURCE, {
        type: 'geojson',
        data: toFeatureCollection([], undefined),
        cluster: true,
        // Tighter than the sites map's 10, because this map genuinely stacks: a yard
        // that has held four postings is four pins on one coordinate, and they have
        // to stay bubbled until the reader is well inside one town.
        clusterMaxZoom: 12,
        clusterRadius: 55,
        clusterProperties: CLUSTER_PROPERTIES,
      });

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
          'circle-color': stateColor(),
          // A closed job draws paler than a standing one, so a stack of history
          // reads as a background the live pin sits on rather than as a crowd
          // competing with it. A booked job is paler still: nothing is there yet.
          'circle-opacity': [
            'case',
            ['==', ['get', 'state'], 'active'],
            1,
            ['==', ['get', 'state'], 'planned'],
            0.65,
            0.8,
          ],
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
      // Topmost first, which is what puts an open posting ahead of the closed ones
      // stacked underneath it at the same yard — the pin a reader aimed at.
      const [feature] = map.queryRenderedFeatures(event.point, {layers: [LAYER.point]});
      const id = feature?.properties?.id as string | undefined;
      if (id === undefined) return;
      onSelectRef.current(id);
    };

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

    const detachDonuts = attachClusterDonuts(map, {
      sourceId: SOURCE,
      clusterLayerId: LAYER.clusterCore,
      segmentsFor: (properties) =>
        (['active', 'planned', 'completed'] as const).map((state) => ({
          color: STATE_COLOR[state],
          count: clusterCount(properties, stateKey(state)),
        })),
    });

    map.on('error', (event) => {
      console.error('[DeploymentsMap]', event.error?.message ?? event);
    });

    return () => {
      loadedRef.current = false;
      detachDonuts();
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
      source.setData(toFeatureCollection(rows, selectedId));
    };

    if (loadedRef.current) {
      push();
      return;
    }
    map.once('gensetiq.ready', push);
  }, [rows, selectedId]);

  // — Frame the feed: the filtered set, or the rows the list is showing. Keyed on
  // ids rather than array identity, for the reason `GensetsMap` gives.
  const focusKey = focusIds === undefined || focusIds.length === 0 ? '' : focusIds.join(',');

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const drawable = placed(rows);
    if (drawable.length === 0) return;

    const framed =
      focusKey === ''
        ? drawable
        : drawable.filter((row) => focusKey.split(',').includes(row.deployment.id));
    if (framed.length === 0) return;

    const fit = () => {
      const bounds = new maplibregl.LngLatBounds();
      for (const row of framed) {
        bounds.extend([row.longitude as number, row.latitude as number]);
      }

      map.fitBounds(bounds, {
        padding: {...FIT_PADDING, right: FIT_PADDING.right + panelInset},
        // A single result would otherwise fit to street level, which loses all sense
        // of where in the country it is.
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
  }, [rows, focusKey]);

  // — Centre on a selection made elsewhere (the table, the Gantt, or a shared URL).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    if (selectedId === undefined) {
      flownToRef.current = undefined;
      return;
    }
    if (flownToRef.current === selectedId) return;

    const row = rows.find((candidate) => candidate.deployment.id === selectedId);
    if (row === undefined || row.latitude === undefined || row.longitude === undefined) return;

    flownToRef.current = selectedId;

    const fly = () => {
      map.easeTo({
        center: [row.longitude as number, row.latitude as number],
        // Close enough to break the posting out of its cluster, so the selected pin
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
  }, [selectedId, rows]);

  return <div ref={containerRef} className="size-full" aria-label="Deployment locations map" />;
};
