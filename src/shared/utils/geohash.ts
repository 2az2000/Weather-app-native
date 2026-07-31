/**
 * Geohash — coordinate quantization for cache keys.
 *
 * **This is the single most important utility in the caching strategy.**
 *
 * A GPS fix drifts by a few metres between reads, so `35.689198` and
 * `35.689204` are the same place to a user and to a weather model — but as a
 * cache key they are two different strings. Using raw floats produces a cache
 * MISS on every single refresh: the app refetches constantly, the offline cache
 * never accumulates, and nothing about it looks broken (CLAUDE.md §25, §32).
 *
 * Quantizing to a geohash cell collapses that drift, so every fix within the
 * same cell shares one cache entry.
 *
 * Implemented here rather than taken as a dependency: the algorithm is a stable,
 * published standard and this is ~60 lines. CLAUDE.md §36 asks whether 30 lines
 * could replace a library before adding one.
 *
 * @see https://en.wikipedia.org/wiki/Geohash
 */

import type { Coordinates } from '@/shared/types';

/** Base-32 alphabet defined by the geohash standard. Not arbitrary — do not reorder. */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Cell size by precision, at the equator.
 *
 * | precision | width × height |
 * |---|---|
 * | 4 | ~39 km × 19.5 km |
 * | **5** | **~4.9 km × 4.9 km** |
 * | 6 | ~1.2 km × 0.6 km |
 * | 7 | ~153 m × 153 m |
 */
export const GEOHASH_PRECISION = {
  /**
   * Default for weather cache keys.
   *
   * ~5 km matches the resolution of the weather models themselves — a forecast
   * does not differ meaningfully across one cell, so treating the cell as one
   * location loses no accuracy while eliminating GPS-drift cache misses.
   */
  weather: 5,
  /** Coarser still, for logs. Deliberately too imprecise to locate a person. */
  logging: 3,
} as const;

/**
 * Encode coordinates as a geohash.
 *
 * @param coordinates - Latitude in [-90, 90], longitude in [-180, 180].
 * @param precision - Number of base-32 characters. Defaults to weather grid resolution.
 * @returns A lowercase geohash string of exactly `precision` characters.
 *
 * @example
 * geohash({ latitude: 35.6892, longitude: 51.389 });        // 'tdrqk'
 * geohash({ latitude: 35.6892, longitude: 51.389 }, 3);     // 'tdr'
 */
export function geohash(
  coordinates: Coordinates,
  precision: number = GEOHASH_PRECISION.weather,
): string {
  const latitude = clamp(coordinates.latitude, -90, 90);
  const longitude = clamp(normaliseLongitude(coordinates.longitude), -180, 180);

  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];

  let hash = '';
  let bits = 0;
  let bitCount = 0;
  // Geohash interleaves longitude and latitude bits, starting with longitude.
  let isLongitudeTurn = true;

  while (hash.length < precision) {
    const range = isLongitudeTurn ? lonRange : latRange;
    const value = isLongitudeTurn ? longitude : latitude;
    const midpoint = (range[0] + range[1]) / 2;

    if (value >= midpoint) {
      bits = (bits << 1) + 1;
      range[0] = midpoint;
    } else {
      bits = bits << 1;
      range[1] = midpoint;
    }

    if (isLongitudeTurn) lonRange = range;
    else latRange = range;

    isLongitudeTurn = !isLongitudeTurn;
    bitCount += 1;

    // Five bits make one base-32 character.
    if (bitCount === 5) {
      hash += BASE32[bits] ?? '0';
      bits = 0;
      bitCount = 0;
    }
  }

  return hash;
}

/**
 * Coordinates rounded to the centre of their geohash cell.
 *
 * Used when a request must carry coordinates rather than a key: sending the
 * cell centre instead of the raw fix means the upstream response is identical
 * for every fix in the cell, so provider-side caching works too.
 */
export function quantize(
  coordinates: Coordinates,
  precision: number = GEOHASH_PRECISION.weather,
): Coordinates {
  return decode(geohash(coordinates, precision));
}

/**
 * Decode a geohash back to the centre of its cell.
 *
 * Lossy by design — the point is that everything in a cell decodes to the same
 * coordinates.
 */
export function decode(hash: string): Coordinates {
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];
  let isLongitudeTurn = true;

  for (const character of hash.toLowerCase()) {
    const index = BASE32.indexOf(character);
    if (index === -1) continue;

    for (let bit = 4; bit >= 0; bit -= 1) {
      const isUpperHalf = ((index >> bit) & 1) === 1;
      const range = isLongitudeTurn ? lonRange : latRange;
      const midpoint = (range[0] + range[1]) / 2;

      if (isUpperHalf) range[0] = midpoint;
      else range[1] = midpoint;

      if (isLongitudeTurn) lonRange = range;
      else latRange = range;

      isLongitudeTurn = !isLongitudeTurn;
    }
  }

  return {
    latitude: (latRange[0] + latRange[1]) / 2,
    longitude: (lonRange[0] + lonRange[1]) / 2,
  };
}

/** Whether two positions fall in the same cache cell. */
export function isSameCell(
  a: Coordinates,
  b: Coordinates,
  precision: number = GEOHASH_PRECISION.weather,
): boolean {
  return geohash(a, precision) === geohash(b, precision);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Wrap longitude into [-180, 180], so 181° and -179° hash identically.
 *
 * Values ALREADY in range are returned untouched. Wrapping unconditionally
 * would map exactly +180 onto -180, which is the same meridian geographically
 * but the opposite end of the geohash range — `zzzzz` would become `bpbpb`.
 * Consistent, but not what the standard specifies.
 */
function normaliseLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) return longitude;
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
