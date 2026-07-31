import { err, ok, storageError, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';

import type {
  Coordinates,
  LocationRepository,
  LocationSearchResult,
  Place,
  SavedLocation,
} from '../../domain';
import type { DeviceLocationDataSource } from '../datasources/device-location-datasource';
import type { LocalLocationStore } from '../datasources/local-location-datasource';
import type { RemoteGeocodingDataSource } from '../datasources/remote-geocoding-datasource';

/**
 * Orchestrates the three sources behind one domain interface.
 *
 * Use cases never learn whether an answer came from GPS, the network, or disk —
 * that is the whole point of the boundary (CLAUDE.md §10).
 */
export class LocationRepositoryImpl implements LocationRepository {
  constructor(
    private readonly device: DeviceLocationDataSource,
    private readonly remote: RemoteGeocodingDataSource,
    private readonly local: LocalLocationStore,
    private readonly logger: Logger,
  ) {}

  /**
   * Position plus place name.
   *
   * If reverse geocoding fails the coordinates are still returned, with a blank
   * name. Losing the place label is a cosmetic degradation; losing the position
   * would break every weather query on the screen — so the more useful half is
   * kept (CLAUDE.md §24: degrade, do not fail).
   */
  async getCurrentLocation(): Promise<Result<Place, AppError>> {
    const coordinates = await this.device.getCurrentCoordinates();
    if (coordinates.isErr()) return err(coordinates.error);

    const place = await this.device.reverseGeocode(coordinates.value);

    if (place.isErr()) {
      this.logger.warn('locations.reverseGeocode.degraded', { kind: place.error.kind });

      return ok({
        coordinates: coordinates.value,
        name: '',
        admin1: undefined,
        countryCode: '',
        country: '',
        timezone: 'auto',
        elevation: undefined,
      });
    }

    return place;
  }

  searchCities(
    query: string,
    locale: string,
  ): Promise<Result<LocationSearchResult[], AppError>> {
    return this.remote.search(query, locale);
  }

  reverseGeocode(coordinates: Coordinates): Promise<Result<Place, AppError>> {
    return this.device.reverseGeocode(coordinates);
  }

  getSavedLocations(): Promise<Result<SavedLocation[], AppError>> {
    return this.local.getSaved();
  }

  saveLocation(place: Place): Promise<Result<SavedLocation, AppError>> {
    return this.local.save(place);
  }

  removeLocation(id: string): Promise<Result<void, AppError>> {
    return this.local.remove(id);
  }

  reorderLocations(orderedIds: readonly string[]): Promise<Result<void, AppError>> {
    return this.local.reorder(orderedIds);
  }

  getRecentSearches(): Promise<Result<string[], AppError>> {
    return this.local.getRecentSearches();
  }

  recordSearch(query: string): Promise<Result<void, AppError>> {
    return this.local.recordSearch(query);
  }

  clearRecentSearches(): Promise<Result<void, AppError>> {
    return this.local.clearRecentSearches();
  }
}

/**
 * Stand-in used when SQLite is unavailable.
 *
 * A corrupt database must not prevent the app from starting (CLAUDE.md §24), so
 * search and GPS keep working. Operations that genuinely need persistence fail
 * EXPLICITLY rather than pretending to succeed — silently accepting a save the
 * user would never get back is worse than telling them it did not work.
 *
 * Reads of optional data degrade to empty instead, since "no recent searches"
 * is a truthful answer.
 */
export function createUnavailableLocationStore(): LocalLocationStore {
  const unavailable = <T>(operation: string): Promise<Result<T, AppError>> =>
    Promise.resolve(err(storageError(operation)));

  return {
    getSaved: () => unavailable('read saved locations'),
    save: () => unavailable('save location'),
    remove: () => unavailable('remove location'),
    reorder: () => unavailable('reorder locations'),
    getRecentSearches: () => Promise.resolve(ok([])),
    recordSearch: () => Promise.resolve(ok(undefined)),
    clearRecentSearches: () => Promise.resolve(ok(undefined)),
  };
}
