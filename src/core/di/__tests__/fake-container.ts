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
import {
  AstronomyCalculator,
  CircuitBreaker,
  GetDailyForecast,
  GetForecast,
  GetHistoricalWeather,
  GetHourlyForecast,
  GetMinutelyForecast,
  GetSevereAlerts,
  OpenMeteoDataSource,
  OpenWeatherDataSource,
  RefreshForecast,
  WeatherRepositoryImpl,
  createUnavailableWeatherStore,
} from '@/features/weather';
import { RequestCoalescer } from '@/shared/utils';

import type { Container } from '../container';

/**
 * A container assembled from fakes, for tests that render a subtree.
 *
 * Lives here rather than being rebuilt in each test file: when the `Container`
 * interface grows, one place needs updating instead of every suite. Adding
 * locations proved the point — a hand-written literal broke the moment three
 * members appeared — and adding weather proved it again, at a cost of one file
 * rather than several.
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

  const weatherRepository =
    overrides.weatherRepository ??
    new WeatherRepositoryImpl(
      new OpenMeteoDataSource(api.openMeteoForecast, api.openMeteoArchive, logger),
      new OpenWeatherDataSource(api.openWeather, logger),
      createUnavailableWeatherStore(),
      new CircuitBreaker(logger),
      new RequestCoalescer(),
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

    weatherRepository,
    astronomy: overrides.astronomy ?? new AstronomyCalculator(),
    weather: overrides.weather ?? {
      getForecast: new GetForecast(weatherRepository),
      refreshForecast: new RefreshForecast(weatherRepository),
      getHourlyForecast: new GetHourlyForecast(weatherRepository),
      getDailyForecast: new GetDailyForecast(weatherRepository),
      getMinutelyForecast: new GetMinutelyForecast(weatherRepository),
      getHistoricalWeather: new GetHistoricalWeather(weatherRepository),
      getSevereAlerts: new GetSevereAlerts(weatherRepository),
    },
  };
}
