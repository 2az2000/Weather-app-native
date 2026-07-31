import type { AppError, Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import type { Forecast, HistoricalDay } from '../entities/forecast';
import type { SevereAlert } from '../entities/weather-condition';

/**
 * The contract the data layer must satisfy.
 *
 * Interface in `domain/`, implementation in `data/` — dependency inversion
 * (CLAUDE.md §10). Every use case below is testable against a two-line fake
 * with no HTTP, no SQLite, and no device.
 *
 * One repository per AGGREGATE, not per endpoint: providers return current,
 * hourly and daily together, so splitting them would mean several requests for
 * data that arrives in one response.
 */
export interface WeatherRepository {
  /**
   * The full forecast for a place.
   *
   * Cache-first: fresh cached data is returned without a request, and stale
   * cached data is returned rather than an error when the network fails
   * (CLAUDE.md §24).
   */
  getForecast(coordinates: Coordinates): Promise<Result<Forecast, AppError>>;

  /** Force a refetch, ignoring cached freshness. Used by pull-to-refresh. */
  refreshForecast(coordinates: Coordinates): Promise<Result<Forecast, AppError>>;

  /** Severe weather warnings. Sourced from OpenWeather (ADR-0002). */
  getAlerts(coordinates: Coordinates): Promise<Result<SevereAlert[], AppError>>;

  /**
   * Observations for a past date range.
   *
   * The past does not change, so these are cached indefinitely (CLAUDE.md §25).
   */
  getHistorical(
    coordinates: Coordinates,
    from: Date,
    to: Date,
  ): Promise<Result<HistoricalDay[], AppError>>;
}
