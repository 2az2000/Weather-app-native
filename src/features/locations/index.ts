/**
 * Locations — GPS, city search, reverse geocoding, favorites, recent searches.
 *
 * Everything else in the app is parameterized by a location, which is why this
 * feature is built before weather (ROADMAP Phase 3).
 *
 * Public surface: entities other features need to talk about a place, the
 * repository interface and use cases for the composition root to wire, the
 * hooks screens consume, and this feature's SQLite migration.
 */
export type {
  Coordinates,
  Place,
  LocationSearchResult,
  SavedLocation,
  LocationRepository,
} from './domain';
export { describePlace, isValidCoordinates, distanceKm } from './domain';
export {
  GetCurrentLocation,
  SearchCities,
  ReverseGeocode,
  SaveLocation,
  ReorderLocations,
  MAX_SAVED_LOCATIONS,
} from './domain';

export { LocationRepositoryImpl } from './data/repositories/location-repository-impl';
export { createUnavailableLocationStore } from './data/repositories/location-repository-impl';
export { SqliteLocationStore } from './data/datasources/local-location-datasource';
export type { LocalLocationStore } from './data/datasources/local-location-datasource';
export { RemoteGeocodingDataSource } from './data/datasources/remote-geocoding-datasource';
export { DeviceLocationDataSource } from './data/datasources/device-location-datasource';
export type { PermissionState } from './data/datasources/device-location-datasource';

/**
 * This feature's schema migration.
 *
 * Exported so the composition root can assemble the database's single ordered
 * migration list without `core/` importing a feature (ADR-0007).
 */
export { locationsMigration } from './data/migrations/001-locations';

export { locationKeys } from './presentation/hooks/query-keys';
export {
  useCurrentLocation,
  useSavedLocations,
  useCitySearch,
  useRecentSearches,
  useSaveLocation,
  useRemoveLocation,
  useReorderLocations,
  useLocationPermission,
} from './presentation/hooks/use-locations';
export { LocationListScreen } from './presentation/screens/location-list-screen';
export { LocationSearchScreen } from './presentation/screens/location-search-screen';

export { useSelectedLocationStore } from './presentation/stores/selected-location-store';
