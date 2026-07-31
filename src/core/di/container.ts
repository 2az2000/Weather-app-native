import { createApiClients, type ApiClients } from '@/core/api';
import { loadEnv, type Env } from '@/core/config';
import { createConsoleSink, createLogger, type Logger } from '@/core/logger';
import { createNetworkMonitor, type NetworkMonitor } from '@/core/network';
import {
  createKeyValueStorage,
  openDatabase,
  type Database,
  type KeyValueStorage,
  type Migration,
} from '@/core/storage';
import { RequestCoalescer } from '@/shared/utils';
import {
  DeviceLocationDataSource,
  GetCurrentLocation,
  LocationRepositoryImpl,
  RemoteGeocodingDataSource,
  ReorderLocations,
  ReverseGeocode,
  SaveLocation,
  SearchCities,
  SqliteLocationStore,
  createUnavailableLocationStore,
  locationsMigration,
  type LocationRepository,
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
  SqliteWeatherStore,
  WeatherRepositoryImpl,
  createUnavailableWeatherStore,
  forecastSnapshotsMigration,
  type WeatherRepository,
} from '@/features/weather';

/**
 * The composition root.
 *
 * Every dependency is constructed HERE and injected downward. Nothing is
 * constructed inside a use case, hook, or component (CLAUDE.md §10) — that is
 * what allows a use case to be tested with a two-line fake instead of a mocking
 * framework.
 *
 * This is the ONE module permitted to import feature barrels, because binding a
 * domain interface to a data implementation requires seeing both. The boundaries
 * config carves it out explicitly (ADR-0007); access is still limited to public
 * barrels, so feature internals stay private.
 */

/**
 * The database's single ordered migration list.
 *
 * SQLite has one schema, so its version history is one list — but the table
 * definitions belong to the features that own them. Each feature exports its
 * migration and the ordering is assembled here, which keeps `core/storage`
 * from importing `features/`.
 *
 * **Append only.** Never reorder or renumber a shipped migration.
 */
const MIGRATIONS: readonly Migration[] = [locationsMigration, forecastSnapshotsMigration];

/** Use cases exposed to the presentation layer. */
export interface LocationUseCases {
  readonly getCurrentLocation: GetCurrentLocation;
  readonly searchCities: SearchCities;
  readonly reverseGeocode: ReverseGeocode;
  readonly saveLocation: SaveLocation;
  readonly reorderLocations: ReorderLocations;
}

/** Weather use cases exposed to the presentation layer. */
export interface WeatherUseCases {
  readonly getForecast: GetForecast;
  readonly refreshForecast: RefreshForecast;
  readonly getHourlyForecast: GetHourlyForecast;
  readonly getDailyForecast: GetDailyForecast;
  readonly getMinutelyForecast: GetMinutelyForecast;
  readonly getHistoricalWeather: GetHistoricalWeather;
  readonly getSevereAlerts: GetSevereAlerts;
}

export interface Container {
  readonly env: Env;
  readonly logger: Logger;
  readonly storage: KeyValueStorage;
  readonly network: NetworkMonitor;
  readonly api: ApiClients;
  /**
   * `undefined` when the database failed to open or migrate.
   *
   * A corrupt cache must never prevent the app from starting — the app degrades
   * to MMKV-only operation rather than showing a fatal error (CLAUDE.md §24).
   */
  readonly database: Database | undefined;

  readonly locationRepository: LocationRepository;
  readonly locations: LocationUseCases;
  readonly deviceLocation: DeviceLocationDataSource;

  readonly weatherRepository: WeatherRepository;
  readonly weather: WeatherUseCases;
  /**
   * Sun and moon, computed on-device.
   *
   * Stateless and I/O-free (ADR-0008), so one instance is shared.
   */
  readonly astronomy: AstronomyCalculator;
}

/**
 * Build the container.
 *
 * `loadEnv()` runs first and THROWS on a missing required variable, so a
 * misconfigured build fails at startup with a message naming the variable rather
 * than as a confusing 401 several screens in (ROADMAP Phase 1 DoD).
 */
export async function createContainer(): Promise<Container> {
  const env = loadEnv();

  const logger = createLogger([createConsoleSink(__DEV__ ? 'debug' : 'warn')]);

  const storage = createKeyValueStorage();
  const network = createNetworkMonitor();
  const api = createApiClients(env, logger);

  const opened = await openDatabase(logger, MIGRATIONS);
  if (opened.isErr()) {
    logger.warn('di.database.unavailable', { kind: opened.error.kind });
  }
  const database = opened.isOk() ? opened.value : undefined;

  // ── Locations ──────────────────────────────────────────────────────────────
  const deviceLocation = new DeviceLocationDataSource(logger);

  const locationRepository = new LocationRepositoryImpl(
    deviceLocation,
    new RemoteGeocodingDataSource(api.openMeteoGeocoding, logger),
    // Search and GPS keep working without a database; only persistence degrades.
    database === undefined
      ? createUnavailableLocationStore()
      : new SqliteLocationStore(database),
    logger,
  );

  // ── Weather ────────────────────────────────────────────────────────────────
  // One coalescer and one breaker for the whole app: both are only useful if
  // every caller shares the same instance.
  const coalescer = new RequestCoalescer();
  const breaker = new CircuitBreaker(logger);

  const weatherRepository = new WeatherRepositoryImpl(
    new OpenMeteoDataSource(api.openMeteoForecast, api.openMeteoArchive, logger),
    new OpenWeatherDataSource(api.openWeather, logger),
    database === undefined
      ? createUnavailableWeatherStore()
      : new SqliteWeatherStore(database),
    breaker,
    coalescer,
    logger,
  );

  return {
    env,
    logger,
    storage,
    network,
    api,
    database,

    weatherRepository,
    astronomy: new AstronomyCalculator(),
    weather: {
      getForecast: new GetForecast(weatherRepository),
      refreshForecast: new RefreshForecast(weatherRepository),
      getHourlyForecast: new GetHourlyForecast(weatherRepository),
      getDailyForecast: new GetDailyForecast(weatherRepository),
      getMinutelyForecast: new GetMinutelyForecast(weatherRepository),
      getHistoricalWeather: new GetHistoricalWeather(weatherRepository),
      getSevereAlerts: new GetSevereAlerts(weatherRepository),
    },

    locationRepository,
    deviceLocation,
    locations: {
      getCurrentLocation: new GetCurrentLocation(locationRepository),
      searchCities: new SearchCities(locationRepository),
      reverseGeocode: new ReverseGeocode(locationRepository),
      saveLocation: new SaveLocation(locationRepository),
      reorderLocations: new ReorderLocations(locationRepository),
    },
  };
}
