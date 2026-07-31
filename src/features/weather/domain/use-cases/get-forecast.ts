import type { AppError, Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import type { Forecast } from '../entities/forecast';
import type { WeatherRepository } from '../repositories/weather-repository';

/**
 * The forecast for a place.
 *
 * The repository owns cache-first orchestration, so this use case cannot tell
 * whether the answer came from disk or the network — and must not need to
 * (CLAUDE.md §10 rule 3).
 */
export class GetForecast {
  constructor(private readonly repository: WeatherRepository) {}

  execute(coordinates: Coordinates): Promise<Result<Forecast, AppError>> {
    return this.repository.getForecast(coordinates);
  }
}

/** Force a refetch. Pull-to-refresh is an explicit request for fresh data. */
export class RefreshForecast {
  constructor(private readonly repository: WeatherRepository) {}

  execute(coordinates: Coordinates): Promise<Result<Forecast, AppError>> {
    return this.repository.refreshForecast(coordinates);
  }
}
