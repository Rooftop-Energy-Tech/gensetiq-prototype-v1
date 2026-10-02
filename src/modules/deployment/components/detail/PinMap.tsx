import maplibregl from 'maplibre-gl';
import {useEffect, useRef, useState} from 'react';

import {locateControl} from '@/lib/locateControl';
import {cn} from '@/lib/utils';

/** The registers' basemap, so a pin here reads like a pin on the Deployments map. */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

/** Street level: close enough to put a set in the right corner of a yard. */
const ZOOM = 16;

/** Below this a move is float noise from a zoom, not the person moving the spot. */
const SAME_SPOT = 1e-7;

const sameSpot = (a: maplibregl.LngLat, latitude: number, longitude: number): boolean =>
  Math.abs(a.lat - latitude) < SAME_SPOT && Math.abs(a.lng - longitude) < SAME_SPOT;

/**
 * The deployment's position on a street map (2026-10-01). The pin stays fixed at the
 * centre and the map moves under it, like a ride-hailing pickup pin: moving the map is
 * the only way to move the position, and the spot under the pin's tip goes back
 * through `onMove` once the map comes to rest. Zoom works and keeps the centre. The
 * map follows the position when it changes from outside (an address picked from the
 * search), and a locked map neither pans nor zooms.
 */
export const PinMap = ({
  latitude,
  longitude,
  zoom = ZOOM,
  movable,
  onMove,
  className,
}: {
  latitude: number;
  longitude: number;
  /** Where the map opens; a position picked later zooms in to street level. */
  zoom?: number;
  movable: boolean;
  onMove: (latitude: number, longitude: number) => void;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const navRef = useRef<maplibregl.NavigationControl | null>(null);
  const locateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const positionRef = useRef({latitude, longitude});
  // True while the map eases to a position set from outside, so its moveend is not
  // mistaken for the person moving the pin.
  const followingRef = useRef(false);
  const [lifted, setLifted] = useState(false);
  // The spot under the pin's tip, live while the map moves, for the read-out.
  const [centre, setCentre] = useState({latitude, longitude});

  useEffect(() => {
    if (containerRef.current === null) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom,
      attributionControl: {compact: true},
      dragRotate: false,
      pitchWithRotate: false,
      boxZoom: false,
      // A double-click zooms on the clicked spot, which would move the pin.
      doubleClickZoom: false,
    });
    map.touchZoomRotate.disableRotation();
    navRef.current = new maplibregl.NavigationControl({showCompass: false});
    // Locating moves the map, so it puts the pin where the person is standing.
    locateRef.current = locateControl(ZOOM);

    map.on('move', () => {
      const at = map.getCenter();
      setCentre({latitude: at.lat, longitude: at.lng});
    });
    map.on('movestart', (event) => {
      if (event.originalEvent !== undefined) {
        followingRef.current = false;
        setLifted(true);
      }
    });
    map.on('moveend', () => {
      setLifted(false);
      if (followingRef.current) {
        followingRef.current = false;
        return;
      }
      const center = map.getCenter();
      const {latitude: lat, longitude: lng} = positionRef.current;
      if (sameSpot(center, lat, lng)) return;
      positionRef.current = {latitude: center.lat, longitude: center.lng};
      onMoveRef.current(center.lat, center.lng);
    });

    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as {__pinMap?: maplibregl.Map}).__pinMap = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Built once; position and lock are followed by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;
    positionRef.current = {latitude, longitude};
    if (sameSpot(map.getCenter(), latitude, longitude)) return;
    // Mid-move (a drag, or the locate button's flight) the move wins: it reports its
    // own spot when it stops, and easing away now would snap the map back.
    if (map.isMoving() && !followingRef.current) return;
    followingRef.current = true;
    map.easeTo({
      center: [longitude, latitude],
      zoom: Math.max(map.getZoom(), ZOOM),
      duration: 600,
    });
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const nav = navRef.current;
    const locate = locateRef.current;
    if (map === null || nav === null || locate === null) return;
    const handlers = [map.dragPan, map.scrollZoom, map.touchZoomRotate, map.keyboard];
    if (movable) {
      // enable() is a no-op on a handler that is already on, so the zooms are switched
      // off first or they keep zooming on the cursor and drag the spot with them.
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.scrollZoom.enable({around: 'center'});
      map.touchZoomRotate.enable({around: 'center'});
      map.dragPan.enable();
      map.keyboard.enable();
      if (!map.hasControl(nav)) map.addControl(nav, 'top-right');
      if (!map.hasControl(locate)) map.addControl(locate, 'top-right');
    } else {
      handlers.forEach((handler) => handler.disable());
      if (map.hasControl(nav)) map.removeControl(nav);
      if (map.hasControl(locate)) map.removeControl(locate);
    }
  }, [movable]);

  return (
    <div className={cn('relative overflow-hidden rounded-md border border-default', className)}>
      <div ref={containerRef} className="h-full w-full" />
      <div
        aria-label="Deployment location"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full"
      >
        <span
          className={cn(
            'absolute bottom-0 left-1/2 h-1.5 w-3 -translate-x-1/2 translate-y-1/2 rounded-[50%] bg-black/35 transition-[opacity,transform] duration-150',
            lifted ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
        <svg
          width="30"
          height="40"
          viewBox="0 0 30 40"
          aria-hidden="true"
          className={cn(
            'relative block transition-transform duration-150 ease-out',
            lifted && '-translate-y-2',
          )}
        >
          <path
            d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z"
            style={{fill: 'var(--color-brand)', stroke: 'var(--color-brand-text)', strokeWidth: 2}}
          />
          <circle cx="15" cy="15" r="5" style={{fill: 'var(--color-brand-text)'}} />
        </svg>
      </div>
      {/* The pin's coordinates (2026-10-01), for a site with no street address and for
          reading out over the phone. Selectable, so they can be copied. */}
      <p
        aria-label="Pin coordinates"
        className="absolute bottom-2 left-2 rounded-md bg-canvas/85 px-2 py-1 font-mono text-xs text-primary tabular-nums shadow-sm backdrop-blur-sm select-text"
      >
        <span className="text-secondary">Lat</span> {centre.latitude.toFixed(5)}
        <span className="text-secondary"> · Long</span> {centre.longitude.toFixed(5)}
      </p>
    </div>
  );
};
