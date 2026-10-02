import {useEffect, useRef, useState} from 'react';

import type {SearchGroup, SearchOption} from '@/components/global/SearchSelect';
import {malaysiaStateAt, malaysiaStateName} from '@/lib/geo/malaysiaStates';
import {reversePlace, searchPlaces} from '@/lib/geo/photon';
import type {GeocodedPlace} from '@/lib/geo/photon';
import {siteSeeds} from '@/modules/site/data/siteSeed';
import type {DeploymentPin} from '../../types/deployment.type';

/**
 * The address search and pin lookup that Settings and the new-deployment form share
 * (2026-09-30). The address field autocompletes street addresses anywhere in
 * Malaysia as they are typed; the register's sites are not offered, because a
 * deployment goes where the customer is, not where a site happens to be (2026-10-01).
 */

const MIN_LETTERS = 3;

/** One coordinate: `3.1579`, `3.1579°N`, `N 3.1579`, or `3°09'28.4"N`. */
const COORDINATE =
  String.raw`([NSEW])?\s*(-?\d{1,3}(?:\.\d+)?)(?:\s*°\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′]\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″])?)?)?\s*([NSEW])?`;
const COORDINATES = new RegExp(`^\\s*${COORDINATE}\\s*[,;\\s]\\s*${COORDINATE}\\s*$`, 'i');

const degrees = (
  hemisphere: string | undefined,
  whole: string,
  minutes: string | undefined,
  seconds: string | undefined,
  after: string | undefined,
): number => {
  const value = Math.abs(Number(whole)) + Number(minutes ?? 0) / 60 + Number(seconds ?? 0) / 3600;
  const side = (hemisphere ?? after ?? '').toUpperCase();
  return whole.startsWith('-') || side === 'S' || side === 'W' ? -value : value;
};

/**
 * Latitude and longitude typed or pasted into the address box (2026-10-01), for a
 * deployment with no street address: a plantation, a quarry, a stretch of highway.
 * Takes what Google Maps and a phone's GPS hand out: `3.1579, 101.7116`,
 * `3.1579° N, 101.7116° E` and `3°09'28.4"N 101°42'41.8"E`. Latitude comes first.
 */
export const parseCoordinates = (
  text: string,
): {latitude: number; longitude: number} | undefined => {
  // Two bare integers are more likely a house number than a position.
  if (!/[.°]/.test(text)) return undefined;
  const match = COORDINATES.exec(text);
  if (match === null) return undefined;
  const [, h1, d1, m1, s1, a1, h2, d2, m2, s2, a2] = match as unknown as Array<string | undefined>;
  const latitude = degrees(h1, d1 as string, m1, s1, a1);
  const longitude = degrees(h2, d2 as string, m2, s2, a2);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return {latitude, longitude};
};

/** How a position with no street address is written wherever an address would be. */
export const coordinatesText = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

export const includes = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.trim().toLowerCase());

/**
 * Street-address suggestions for what has been typed so far, from three letters in;
 * or, when it reads as coordinates, the one position they name.
 */
export const useAddressGroups = (
  query: string,
): {groups: Array<SearchGroup>; places: Array<GeocodedPlace>} => {
  const [places, setPlaces] = useState<Array<GeocodedPlace>>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [nearby, setNearby] = useState<string | undefined>();
  const coordinates = parseCoordinates(query);
  const wantsPlaces = coordinates === undefined && query.trim().length >= MIN_LETTERS;
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  // The town the coordinates fall in, as the suggestion's second line. The address
  // stays the coordinates: whatever street is nearest is not where the set stands.
  useEffect(() => {
    setNearby(undefined);
    if (latitude === undefined || longitude === undefined) return;
    const controller = new AbortController();
    reversePlace(latitude, longitude, controller.signal)
      .then((found) => setNearby(found.locationLabel === 'Dropped pin' ? undefined : found.locationLabel))
      .catch(() => {});
    return () => controller.abort();
  }, [latitude, longitude]);

  useEffect(() => {
    setPlaces([]);
    if (!wantsPlaces) return;
    setStatus('Searching…');
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(query.trim(), controller.signal)
        .then((found) => {
          setPlaces(found);
          setStatus(found.length === 0 ? 'No matching addresses' : undefined);
        })
        .catch((error: unknown) => {
          if ((error as {name?: string}).name !== 'AbortError') {
            setStatus('Address search is unavailable');
          }
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, wantsPlaces]);

  if (coordinates !== undefined) {
    // The state the point stands in, or none: Singapore and the sea are typos here.
    const stateId = malaysiaStateAt(coordinates.longitude, coordinates.latitude);
    const stateName = stateId === undefined ? undefined : malaysiaStateName(stateId);
    const usable = stateName !== undefined;
    const position: GeocodedPlace = {
      address: coordinatesText(coordinates.latitude, coordinates.longitude),
      locationLabel: nearby ?? stateName ?? 'Coordinates',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
    return {
      groups: [
        {
          label: 'Coordinates',
          options: usable
            ? [
                {
                  id: 'place:0',
                  label: position.address,
                  detail: nearby === undefined ? `In ${stateName}` : `Near ${nearby}`,
                },
              ]
            : [],
          status: 'Those coordinates are not in Malaysia. Latitude comes first.',
        },
      ],
      places: usable ? [position] : [],
    };
  }

  const groups: Array<SearchGroup> = [
    {
      label: 'Addresses',
      options: wantsPlaces
        ? places.map((place, index) => ({
            id: `place:${index}`,
            label: place.address,
            detail: place.locationLabel,
          }))
        : [],
      status: wantsPlaces ? status : 'Type an address, or coordinates such as 3.1579, 101.7116',
    },
  ];
  return {groups, places};
};

/** What picking a suggestion means: its street address, as the deployment's pin. */
export const resolveAddressOption = (
  option: SearchOption,
  places: Array<GeocodedPlace>,
): {pin: DeploymentPin} | undefined => {
  const place = places[Number(option.id.slice(6))];
  return place === undefined ? undefined : {pin: place};
};

/** The street address at a dropped pin, or its coordinates where the lookup fails. */
export const lookUpPin = (latitude: number, longitude: number): Promise<DeploymentPin> =>
  reversePlace(latitude, longitude).catch(() => ({
    address: coordinatesText(latitude, longitude),
    locationLabel: 'Dropped pin',
    latitude,
    longitude,
  }));

/**
 * What moving a pin map does with where it stopped (2026-10-01): the spot is the pin at
 * once, under its coordinates, and the street address replaces them when the lookup
 * lands. Only the latest lookup may land.
 *
 * Both halves are what stop the map snapping back. A lookup takes seconds, and one
 * still out when somebody pressed locate used to land mid-flight and pull the map
 * back to the spot it was for; and until it landed the form still held the spot
 * before, so anything that redrew the map from it undid the move.
 */
export const usePinLookup = (
  onPin: (pin: DeploymentPin) => void,
): {move: (latitude: number, longitude: number) => void; lookingUp: boolean} => {
  const ticket = useRef(0);
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const [lookingUp, setLookingUp] = useState(false);
  const move = (latitude: number, longitude: number) => {
    const mine = ++ticket.current;
    onPinRef.current({
      address: coordinatesText(latitude, longitude),
      locationLabel: 'Dropped pin',
      latitude,
      longitude,
    });
    setLookingUp(true);
    void lookUpPin(latitude, longitude).then((found) => {
      if (mine !== ticket.current) return;
      onPinRef.current(found);
      setLookingUp(false);
    });
  };
  return {move, lookingUp};
};

/**
 * The register's site closest to a point. A deployment at a street address still
 * books through a site, which is what gives it a region for the filters.
 */
export const nearestSiteId = (latitude: number, longitude: number): string | undefined =>
  siteSeeds()
    .map((site) => ({
      id: site.id,
      d: (site.latitude - latitude) ** 2 + (site.longitude - longitude) ** 2,
    }))
    .sort((a, b) => a.d - b.d)[0]?.id;
