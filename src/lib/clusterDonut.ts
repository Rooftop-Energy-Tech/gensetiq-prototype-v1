import maplibregl from 'maplibre-gl';

/**
 * The status ring that sits inside a cluster bubble's count.
 *
 * Zoomed out, a cluster collapses N pins into one number and throws away the one
 * thing the pins were carrying — their colour. This puts it back: a ring around
 * the count, split by the mix of whatever is underneath it, so "14" in Sandakan
 * reads as "14, three of them faulted" without expanding the cluster.
 *
 * It's a DOM overlay rather than another circle layer because MapLibre's `circle`
 * type draws whole discs — there is no arc primitive, and a stack of one layer per
 * status could only ever produce concentric rings, not a split one. So the bubble
 * stays on the canvas (haloes, core, count) and only the ring is drawn above it in
 * SVG, over the transparent middle of the marker so the count still shows through.
 *
 * Domain-free on purpose: it knows about colours and counts, and each map supplies
 * those from its own vocabulary — run state on the fleet map, condition or fleet
 * status on the sites map. Three maps drawing their bubbles from three copies of
 * this is exactly the drift the two map components already work to avoid.
 */

/** Radius of the ring's centreline, in px. Inside the 18px core, outside the text. */
const RADIUS = 13.5;
const STROKE = 4;
/** Half the box is `RADIUS + STROKE / 2` of drawing plus a pixel of slack. */
const SIZE = (RADIUS + STROKE / 2 + 1) * 2;

const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Arc length dropped between adjacent segments, in px of circumference. Enough to
 * read as a division at a glance; small enough that a single unit in a cluster of
 * twenty is still a visible sliver rather than being eaten by its own two gaps.
 */
const GAP = 2;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * One slice. Order is the caller's — it decides where the ring starts and which way
 * it reads, and keeping that fixed is what lets the same fleet always draw the same
 * ring.
 */
export type DonutSegment = {color: string; count: number};

/**
 * Reads one of the per-status counts a cluster feature carries, as accumulated by
 * the source's `clusterProperties`. They arrive as numbers from most MapLibre
 * paths and as JSON strings from others, so both are handled.
 */
export const clusterCount = (properties: Record<string, unknown>, key: string): number => {
  const raw = properties[key];
  const count = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0;
  return Number.isFinite(count) && count > 0 ? count : 0;
};

/** A stable key for a ring, so an unchanged bubble isn't re-drawn on every frame. */
const segmentsKey = (segments: Array<DonutSegment>): string =>
  segments.map((segment) => `${segment.color}:${segment.count}`).join('|');

/**
 * The ring itself.
 *
 * Each segment is a full circle with a dash pattern that reveals only its own arc,
 * which keeps the whole thing a handful of DOM nodes deep and free of any path
 * arithmetic. The run starts at twelve o'clock.
 */
export const createDonut = (segments: Array<DonutSegment>): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(SIZE));
  svg.setAttribute('height', String(SIZE));
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.style.display = 'block';

  const present = segments.filter((segment) => segment.count > 0);
  const total = present.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) return svg;

  // One status means an unbroken ring: a lone gap in a solid ring reads as a
  // missing slice rather than as a seam.
  const gap = present.length > 1 ? GAP : 0;

  let offset = 0;
  for (const segment of present) {
    const share = segment.count / total;
    const length = Math.max(share * CIRCUMFERENCE - gap, 0.5);

    const arc = document.createElementNS(SVG_NS, 'circle');
    arc.setAttribute('cx', String(SIZE / 2));
    arc.setAttribute('cy', String(SIZE / 2));
    arc.setAttribute('r', String(RADIUS));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', segment.color);
    arc.setAttribute('stroke-width', String(STROKE));
    arc.setAttribute('stroke-linecap', 'butt');
    arc.setAttribute('stroke-dasharray', `${length} ${CIRCUMFERENCE - length}`);
    arc.setAttribute('stroke-dashoffset', String(-offset));
    // Dashes start at three o'clock; rotate the segment back a quarter turn so the
    // run begins at the top.
    arc.setAttribute('transform', `rotate(-90 ${SIZE / 2} ${SIZE / 2})`);
    svg.append(arc);

    offset += share * CIRCUMFERENCE;
  }

  return svg;
};

type AttachOptions = {
  /** The clustered source, for the hidden-tab fallback below. */
  sourceId: string;
  /** The circle layer that draws the bubble's opaque core — one ring per feature of it. */
  clusterLayerId: string;
  /** The mix under one bubble, read from its accumulated `clusterProperties`. */
  segmentsFor: (properties: Record<string, unknown>) => Array<DonutSegment>;
};

/**
 * Keeps one donut marker per cluster bubble on `map`, and returns the teardown.
 *
 * Clusters are re-formed by supercluster on every zoom, so the marker set is
 * reconciled rather than rebuilt: an unchanged bubble keeps its element (and its
 * `cluster_id`), one whose mix changed has its ring redrawn, and one that has
 * merged or expanded away is removed.
 */
export const attachClusterDonuts = (
  map: maplibregl.Map,
  {sourceId, clusterLayerId, segmentsFor}: AttachOptions,
): (() => void) => {
  const donuts = new Map<number, {marker: maplibregl.Marker; key: string}>();

  const sync = () => {
    if (map.getLayer(clusterLayerId) === undefined) return;

    const seen = new Set<number>();
    // Rendered features, not source features: `querySourceFeatures` reads the
    // source's tile cache, which still holds cluster tiles from zoom levels the
    // map has already left, and those would hang rings over empty basemap. What's
    // on the cluster layer right now is exactly the set of bubbles needing one.
    for (const feature of map.queryRenderedFeatures({layers: [clusterLayerId]})) {
      const clusterId = feature.properties?.cluster_id as number | undefined;
      // A cluster near a tile boundary comes back once per tile it touches.
      if (clusterId === undefined || seen.has(clusterId)) continue;
      seen.add(clusterId);

      const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      const segments = segmentsFor(feature.properties ?? {});
      const key = segmentsKey(segments);
      const existing = donuts.get(clusterId);

      if (existing === undefined) {
        const element = document.createElement('div');
        // The load-bearing line: the cluster's click and hover handlers are bound
        // to the canvas layers underneath, and an overlay that ate those events
        // would make bubbles stop expanding on click.
        element.style.pointerEvents = 'none';
        element.style.lineHeight = '0';
        element.append(createDonut(segments));

        const marker = new maplibregl.Marker({element}).setLngLat(coordinates).addTo(map);
        donuts.set(clusterId, {marker, key});
        continue;
      }

      existing.marker.setLngLat(coordinates);
      if (existing.key !== key) {
        existing.marker.getElement().replaceChildren(createDonut(segments));
        existing.key = key;
      }
    }

    for (const [clusterId, entry] of donuts) {
      if (seen.has(clusterId)) continue;
      entry.marker.remove();
      donuts.delete(clusterId);
    }
  };

  const handleSourceData = (event: maplibregl.MapSourceDataEvent) => {
    if (event.sourceId !== sourceId || !event.isSourceLoaded) return;
    sync();
  };

  // `render` rather than `move`: it fires on exactly the frames where what's drawn
  // changed — pans, zooms, a `setData`, a tile arriving — and nothing while the map
  // sits still, which is what keeps the rings pinned to their bubbles through a
  // fly-to instead of catching up at the end of it.
  map.on('render', sync);
  // And once more when everything has settled. A `render` handler queries the frame
  // it is called on, so the very last repaint of a zoom — the one where a bubble
  // finally resolves into its pins — can be read a frame early and leave a ring
  // behind with nothing under it. `idle` is the one moment the query is guaranteed
  // to agree with the screen.
  map.on('idle', sync);
  // A backgrounded tab is handed no animation frames, so neither of the two above
  // fires there — the same reason both maps add their layers on `style.load` rather
  // than `load`. `sourcedata` is not frame-driven, so a fleet pushed into a hidden
  // tab still gets its rings; returning to the tab repaints and `render` takes over.
  map.on('sourcedata', handleSourceData);

  return () => {
    map.off('render', sync);
    map.off('idle', sync);
    map.off('sourcedata', handleSourceData);
    for (const entry of donuts.values()) entry.marker.remove();
    donuts.clear();
  };
};

/**
 * Redraws every ring on the next frame.
 *
 * For the sites map, whose bubbles can be recoloured without the data under them
 * changing: switching the scale from condition to fleet status changes what the
 * segments mean, and nothing about the map has moved to make `render` fire.
 */
export const refreshClusterDonuts = (map: maplibregl.Map): void => {
  map.triggerRepaint();
};
