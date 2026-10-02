/**
 * Street addresses from OpenStreetMap, through Komoot's public Photon service
 * (2026-09-30): the Settings address search and the dragged pin's lookup.
 *
 * Photon rather than OSM's own Nominatim because Nominatim's usage policy forbids
 * search-as-you-type from a browser, and Photon is built for it. Free and keyless,
 * which is right for a prototype and wrong for production: swap `BASE` for a hosted
 * or self-run geocoder before this carries real traffic.
 */
const BASE = 'https://photon.komoot.io';

/** Peninsular Malaysia to eastern Sabah, so a search for `Jalan Ampang` stays home. */
const MALAYSIA_BBOX = '99.6,0.8,119.3,7.4';

export type GeocodedPlace = {
  /** `Lot 71, Jalan Pelabuhan, 42000 Klang, Selangor` — as the site seeds write one. */
  address: string;
  /** `Klang, Selangor`. */
  locationLabel: string;
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  geometry: {coordinates: [number, number]};
  properties: Partial<
    Record<
      | 'name'
      | 'housenumber'
      | 'street'
      | 'locality'
      | 'district'
      | 'city'
      | 'county'
      | 'state'
      | 'postcode',
      string
    >
  >;
};

const place = ({geometry, properties: p}: PhotonFeature): GeocodedPlace => {
  const town = p.city ?? p.district ?? p.county ?? p.locality;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const head = p.name !== undefined && p.name !== p.street ? p.name : undefined;
  const address = [head, street || undefined, [p.postcode, town].filter(Boolean).join(' ') || undefined, p.state]
    .filter((part): part is string => part !== undefined && part !== '')
    // A name that is the town itself would print twice.
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(', ');
  const [longitude, latitude] = geometry.coordinates;
  return {
    address: address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    locationLabel: [town, p.state].filter(Boolean).join(', ') || 'Dropped pin',
    latitude,
    longitude,
  };
};

const features = async (url: string, signal?: AbortSignal): Promise<Array<PhotonFeature>> => {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Photon ${response.status}`);
  const body = (await response.json()) as {features?: Array<PhotonFeature>};
  return body.features ?? [];
};

/** Up to five places matching what was typed, inside Malaysia. */
export const searchPlaces = async (
  query: string,
  signal?: AbortSignal,
): Promise<Array<GeocodedPlace>> => {
  const url = `${BASE}/api/?q=${encodeURIComponent(query)}&limit=5&bbox=${MALAYSIA_BBOX}`;
  return (await features(url, signal)).map(place);
};

/**
 * The address at a point, keeping the point: the pin stays where it was dropped,
 * not where the nearest mapped building is.
 */
export const reversePlace = async (
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<GeocodedPlace> => {
  const [first] = await features(`${BASE}/reverse?lat=${latitude}&lon=${longitude}`, signal);
  const found = first === undefined ? undefined : place(first);
  return {
    address: found?.address ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    locationLabel: found?.locationLabel ?? 'Dropped pin',
    latitude,
    longitude,
  };
};
