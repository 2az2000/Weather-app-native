/**
 * Weather — the product's core domain.
 *
 * Everything visible in the app is a rendering of what this feature produces.
 * Entity and canonical-unit decisions here propagate into the cache, the
 * charts, and the widgets (ROADMAP Phase 4).
 *
 * Public surface: entities and units other features render, the repository
 * interface and use cases the composition root wires, the astronomy service,
 * and this feature's migration.
 */

// ── Entities and units ───────────────────────────────────────────────────────
export type {
  Celsius,
  MetersPerSecond,
  Hectopascals,
  Meters,
  Degrees,
  Percent,
  Millimeters,
  CompassPoint,
} from './domain';
export {
  celsius,
  metersPerSecond,
  hectopascals,
  meters,
  degrees,
  percent,
  millimeters,
  toFahrenheit,
  toKilometersPerHour,
  toMilesPerHour,
  toKnots,
  toInchesOfMercury,
  toMillimetersOfMercury,
  toKilometers,
  toMiles,
  toCompassPoint,
  COMPASS_POINTS,
} from './domain';

export type {
  WeatherCondition,
  AlertSeverity,
  SevereAlert,
  CurrentConditions,
  HourlyPoint,
  HourlyForecast,
  MinutelyPoint,
  MinutelyForecast,
  DailyPoint,
  DailyForecast,
  Forecast,
  HistoricalDay,
} from './domain';
export {
  WEATHER_CONDITIONS,
  ALERT_SEVERITIES,
  isAlertActive,
  isPrecipitating,
  isSevereCondition,
} from './domain';

// ── Domain services and use cases ────────────────────────────────────────────
export { AstronomyCalculator, MOON_PHASES } from './domain';
export type { MoonPhase, SunTimes, SunPosition, MoonInfo, TimeOfDay } from './domain';

export type { WeatherRepository } from './domain';
export {
  GetForecast,
  RefreshForecast,
  GetHourlyForecast,
  GetDailyForecast,
  GetMinutelyForecast,
  GetHistoricalWeather,
  GetSevereAlerts,
} from './domain';
export type { MinutelySummary } from './domain';

// ── Data layer, for the composition root ─────────────────────────────────────
export { WeatherRepositoryImpl } from './data/repositories/weather-repository-impl';
export { OpenMeteoDataSource } from './data/datasources/open-meteo-datasource';
export { OpenWeatherDataSource } from './data/datasources/open-weather-datasource';
export { CircuitBreaker } from './data/datasources/circuit-breaker';
export {
  SqliteWeatherStore,
  createUnavailableWeatherStore,
} from './data/datasources/local-weather-datasource';
export type {
  LocalWeatherStore,
  CachedForecast,
} from './data/datasources/local-weather-datasource';

/**
 * This feature's schema migration.
 *
 * Exported so the composition root can assemble the database's single ordered
 * migration list without `core/` importing a feature (ADR-0007).
 */
export { forecastSnapshotsMigration } from './data/migrations/002-forecast-snapshots';
