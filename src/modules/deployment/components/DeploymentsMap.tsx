import maplibregl from 'maplibre-gl';
import type {GeoJSONSource, MapMouseEvent} from 'maplibre-gl';
import {useEffect, useRef} from 'react';

import {attachClusterDonuts, clusterCount} from '@/lib/clusterDonut';
import {
  MALAYSIA_STATE_CLUSTER_PROPERTIES,
  PENINSULA,
  PENINSULA_PADDING,
  malaysiaStateAt,
} from '@/lib/geo/malaysiaStates';
import {attachStateHover} from '@/lib/geo/stateHover';
import type {StateHoverHandle} from '@/lib/geo/stateHover';
import {locateControl} from '@/lib/locateControl';
import {pingImage} from '@/lib/mapPing';
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
  /** A deployed job's ping — `pingImage`, as the gensets map's running pins. */
  pointPing: 'deployments-point-ping',
  point: 'deployments-point',
} as const;

const INTERACTIVE_LAYERS = [LAYER.clusterHalo, LAYER.clusterCore, LAYER.point];

const FIT_PADDING = {top: 56, right: 56, bottom: 56, left: 56};

/** The three states, and the one place their colours are written down. */
const STATE_COLOR = {
  active: lightToken['severity-ok'],
  // Deployed's green — the pin is hollow, which is what marks it as not started.
  planned: lightToken['severity-ok'],
  // Offline's slate, as the badge and the chips draw it. Opaque, which matters: an
  // alpha grey over a basemap takes the roads' colour through it.
  completed: lightToken['status-offline'],
} as const;

/**
 * A booked job's slice of a cluster ring. A ring has no outline to go hollow with,
 * so it takes a pale tint of Deployed's green instead of the green itself, which
 * would run the two states together into one arc — the `severity-ok-tint` token.
 */
const PLANNED_RING = lightToken['severity-ok-tint'];

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
  /**
   * A click on a state — on the basemap inside it, not on a pin or a bubble. The
   * register filters its list to that state; the map frames it either way.
   */
  onStateSelect?: (stateId: string) => void;
  /**
   * Keep the current frame rather than fitting to the feed — `GensetsMap`'s prop, for
   * its reason: the filter a state click sets would otherwise re-fit the map to the
   * state's pins a moment later and undo the state's own frame.
   */
  holdFrame?: boolean;
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
      // Which state this pin stands in, so the hover can tell its own from everyone
      // else's — and so the per-state cluster sums have something to count. Filed on
      // the feature rather than on the record, because it is a fact about a
      // coordinate: move the thing and it follows.
      stateId: malaysiaStateAt(row.longitude as number, row.latitude as number) ?? '',
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
  onStateSelect,
  holdFrame,
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
  const onStateSelectRef = useRef(onStateSelect);
  onStateSelectRef.current = onStateSelect;
  const holdFrameRef = useRef(holdFrame);
  holdFrameRef.current = holdFrame;

  // The postings currently drawn, read from inside the state hover's count — so the
  // count follows the register's filters rather than reporting every job ever made.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Read by the state click's fit, which runs after the same click may have closed
  // the panel — so a ref the fit reads late, not a width captured at attach.
  const panelInsetRef = useRef(panelInset);
  panelInsetRef.current = panelInset;

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

    if (import.meta.env.DEV) {
      (window as unknown as {__deploymentMap?: maplibregl.Map}).__deploymentMap = map;
    }

    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'bottom-right');

    map.addControl(locateControl(), 'bottom-right');

    // `style.load`, not `load` — see `SitesMap`: MapLibre defers `load` until the map
    // has painted a frame, which a backgrounded tab never does.
    // Assigned at the end of `style.load`, once there are fleet layers for it to
    // dim. The donut rings close over it and are attached first, so they read it
    // lazily rather than being handed it.
    let stateHover: StateHoverHandle | undefined;

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
        clusterProperties: {...CLUSTER_PROPERTIES, ...MALAYSIA_STATE_CLUSTER_PROPERTIES},
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

      map.addImage('deployed-ping', pingImage(map, STATE_COLOR.active), {
        pixelRatio: window.devicePixelRatio || 1,
      });
      map.addLayer({
        id: LAYER.pointPing,
        type: 'symbol',
        source: SOURCE,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'state'], 'active']],
        layout: {
          'icon-image': 'deployed-ping',
          // The image is drawn for a 9px pin; these grow with the machines on them.
          'icon-size': ['/', POINT_RADIUS, 9],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      map.addLayer({
        id: LAYER.point,
        type: 'circle',
        source: SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': POINT_RADIUS,
          // A booked job is hollow — a green ring, nothing filled in, because
          // nothing is standing there yet.
          'circle-color': ['case', ['==', ['get', 'state'], 'planned'], lightToken.canvas, stateColor()],
          // A closed job draws paler than a standing one, so a stack of history
          // reads as a background the live pin sits on rather than as a crowd
          // competing with it.
          'circle-opacity': ['case', ['==', ['get', 'state'], 'completed'], 0.8, 1],
          'circle-stroke-width': [
            'case',
            ['get', 'selected'],
            3,
            ['==', ['get', 'state'], 'planned'],
            2.5,
            2,
          ],
          'circle-stroke-color': [
            'case',
            ['get', 'selected'],
            lightToken.brand,
            ['==', ['get', 'state'], 'planned'],
            STATE_COLOR.planned,
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
          placed(rowsRef.current).filter(
            (row) =>
              malaysiaStateAt(row.longitude as number, row.latitude as number) === stateId,
          ).length,
        countLabel: (count) => `${count} ${count === 1 ? 'deployment' : 'deployments'}`,
        // The same frame the fleet gets, so a clicked state sits where a fitted fleet
        // would — clear of the panel, if the panel is still there.
        fitPadding: () => ({...FIT_PADDING, right: FIT_PADDING.right + panelInsetRef.current}),
        onStateClick: (stateId) => onStateSelectRef.current?.(stateId),
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
          color: state === 'planned' ? PLANNED_RING : STATE_COLOR[state],
          count: clusterCount(properties, stateKey(state)),
        })),
      opacityFor: (properties) => stateHover?.clusterOpacity(properties) ?? 1,
    });

    map.on('error', (event) => {
      console.error('[DeploymentsMap]', event.error?.message ?? event);
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
    if (holdFrameRef.current === true) return;

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
