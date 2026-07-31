import type { Coordinates } from '@/shared/types';

/**
 * `Coordinates` itself lives in `shared/types` — both this feature and weather
 * need it, and a shared concept moves DOWN rather than sideways
 * (CLAUDE.md §7 rule 3).
 *
 * The BEHAVIOUR over it stays here, because deciding whether a coordinate is
 * valid or whether two points are the same place is a domain judgement.
 */
export type { Coordinates };

/** Latitude and longitude bounds. Outside these a value is not a coordinate. */
const LATITUDE_RANGE = { min: -90, max: 90 } as const;
const LONGITUDE_RANGE = { min: -180, max: 180 } as const;

/**
 * Whether a pair of numbers is a valid coordinate.
 *
 * Providers do occasionally return nonsense, and a NaN latitude propagates
 * silently into a cache key and a URL before failing somewhere unrelated.
 */
export function isValidCoordinates(value: Coordinates): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= LATITUDE_RANGE.min &&
    value.latitude <= LATITUDE_RANGE.max &&
    value.longitude >= LONGITUDE_RANGE.min &&
    value.longitude <= LONGITUDE_RANGE.max
  );
}

/**
 * Great-circle distance in kilometres.
 *
 * Haversine formula. Used to detect whether the device has moved far enough to
 * be worth re-resolving its place name.
 *
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const EARTH_RADIUS_KM = 6371;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
