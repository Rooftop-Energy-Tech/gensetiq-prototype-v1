import maplibregl from 'maplibre-gl';

/**
 * The "where am I" button the register maps carry (2026-10-01). Off until clicked, so the
 * browser asks for the location only when someone wants it. Clicked, it flies to the
 * person, draws a live dot that follows them and keeps the map on them until they pan
 * away; clicked again, it stops.
 */
export const locateControl = (maxZoom = 13): maplibregl.GeolocateControl =>
  new maplibregl.GeolocateControl({
    positionOptions: {enableHighAccuracy: true},
    trackUserLocation: true,
    showAccuracyCircle: true,
    fitBoundsOptions: {maxZoom},
  });
