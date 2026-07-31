import { createApiClients } from '@/core/api';
import { noopLogger } from '@/core/logger';
import { createFakeNetworkMonitor } from '@/core/network';
import { createInMemoryKeyValueStorage } from '@/core/storage';
import {
  DeviceLocationDataSource,
  GetCurrentLocation,
  LocationRepositoryImpl,
  RemoteGeocodingDataSource,
  ReorderLocations,
  ReverseGeocode,
  SaveLocation,
  SearchCities,
  createUnavailableLocationStore,
} from '@/features/locations';

import type { Container } from '../container';

/**
 * A container assembled from fakes, for tests that render a subtree.
 *
 * Lives here rather than being rebuilt in each test file: when the `Container`
 * interface grows, one place needs updating instead of every suite. That was the
 * immediate lesson from adding locations — the hand-written literal in one test
 * broke the moment three members were added.
 *
 * Any member can be overridden per test.
 */
export function createFakeContainer(overrides: Partial<Container> = {}): Container {
  const logger = overrides.logger ?? noopLogger;
  const env = overrides.env ?? { openWeatherApiKey: 'test', mapboxAccessToken: 'test' };
  const api = overrides.api ?? createApiClients(env, logger);

  const deviceLocation = overrides.deviceLocation ?? new DeviceLocationDataSource(logger);

  const locationRepository =
    overrides.locationRepository ??
    new LocationRepositoryImpl(
      deviceLocation,
      new RemoteGeocodingDataSource(api.openMeteoGeocoding, logger),
      createUnavailableLocationStore(),
      logger,
    );

  return {
    env,
    logger,
    storage: overrides.storage ?? createInMemoryKeyValueStorage(),
    network: overrides.network ?? createFakeNetworkMonitor(),
    api,
    database: overrides.database,
    locationRepository,
    deviceLocation,
    locations: overrides.locations ?? {
      getCurrentLocation: new GetCurrentLocation(locationRepository),
      searchCities: new SearchCities(locationRepository),
      reverseGeocode: new ReverseGeocode(locationRepository),
      saveLocation: new SaveLocation(locationRepository),
      reorderLocations: new ReorderLocations(locationRepository),
    },
  };
}
