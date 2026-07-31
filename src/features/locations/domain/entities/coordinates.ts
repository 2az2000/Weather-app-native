/**
 * A point on Earth.
 *
 * Every weather query in the app is parameterized by this, which is why the
 * locations feature is built before the weather feature (ROADMAP Phase 3).
 */
export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

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
