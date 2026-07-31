import type { AppError, Result } from '@/core/errors';

import type { Coordinates } from '../entities/coordinates';
import type { LocationSearchResult, Place, SavedLocation } from '../entities/place';

/**
 * The contract the data layer must satisfy.
 *
 * Interface here in `domain/`, implementation in `data/` — dependency inversion
 * (CLAUDE.md §10). This is what lets every use case below be tested against a
 * two-line fake with no HTTP, no SQLite, and no device.
 *
 * Every method returns `Result` rather than throwing: failures cross this
 * boundary as values the compiler forces callers to handle (CLAUDE.md §22).
 */
export interface LocationRepository {
  /**
   * Resolve the device's position and its place name.
   *
   * Fails with `permissionDenied` when location access was refused — a normal
   * user decision, not an exceptional condition.
   */
  getCurrentLocation(): Promise<Result<Place, AppError>>;

  /** Search cities by name. */
  searchCities(
    query: string,
    locale: string,
  ): Promise<Result<LocationSearchResult[], AppError>>;

  /** Resolve coordinates to a place name. */
  reverseGeocode(coordinates: Coordinates): Promise<Result<Place, AppError>>;

  /** Locations the user has kept, in their chosen order. */
  getSavedLocations(): Promise<Result<SavedLocation[], AppError>>;

  /** Persist a place. Appended to the end of the list. */
  saveLocation(place: Place): Promise<Result<SavedLocation, AppError>>;

  removeLocation(id: string): Promise<Result<void, AppError>>;

  /** Persist a new order. `orderedIds` must contain every saved id exactly once. */
  reorderLocations(orderedIds: readonly string[]): Promise<Result<void, AppError>>;

  /** Recent search queries, most recent first. */
  getRecentSearches(): Promise<Result<string[], AppError>>;

  recordSearch(query: string): Promise<Result<void, AppError>>;

  clearRecentSearches(): Promise<Result<void, AppError>>;
}
