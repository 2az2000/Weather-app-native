import type { Coordinates } from './coordinates';

/**
 * A named place.
 *
 * Provider-agnostic: Open-Meteo geocoding, the OS geocoder, and Mapbox all map
 * into THIS shape, so the presentation layer cannot tell which one answered
 * (CLAUDE.md §11).
 */
export interface Place {
  readonly coordinates: Coordinates;
  /** City or locality, in the requested language where the provider supports it. */
  readonly name: string;
  /** Province or state. `undefined` where the provider has none. */
  readonly admin1: string | undefined;
  /** ISO 3166-1 alpha-2, uppercase. */
  readonly countryCode: string;
  readonly country: string;
  /** IANA timezone. Weather times are meaningless without it. */
  readonly timezone: string;
  /** Metres above sea level, where known. */
  readonly elevation: number | undefined;
}

/**
 * A search hit.
 *
 * Distinct from {@link Place} because search results carry ranking information
 * that a saved location has no use for, and carrying it everywhere would make
 * the saved-location shape lie about what it knows.
 */
export interface LocationSearchResult extends Place {
  /** Stable id from the geocoding provider, used as a list key. */
  readonly id: string;
  /** Population, where known. Used to rank same-named cities. */
  readonly population: number | undefined;
}

/**
 * A location the user has chosen to keep.
 *
 * `isCurrentLocation` marks the GPS-backed entry, which behaves differently:
 * there is at most one, it cannot be deleted, and its coordinates change as the
 * device moves.
 */
export interface SavedLocation extends Place {
  readonly id: string;
  /** Position in the user's list. Contiguous from 0. */
  readonly sortOrder: number;
  readonly isCurrentLocation: boolean;
  readonly savedAt: Date;
}

/** Display label — "Tehran, Iran" or "Shiraz, Fars". */
export function describePlace(place: Place): string {
  const qualifier = place.admin1 ?? place.country;
  return qualifier === place.name ? place.name : `${place.name}, ${qualifier}`;
}
