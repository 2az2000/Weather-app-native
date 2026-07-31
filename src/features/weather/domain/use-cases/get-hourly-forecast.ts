import { err, ok, type AppError, type Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import type { HourlyPoint } from '../entities/forecast';
import type { WeatherRepository } from '../repositories/weather-repository';

/** Providers return more hours than any screen shows. */
const DEFAULT_HOURS = 24;

/**
 * The next N hours.
 *
 * Owns a rule the UI should not: **hours already past are dropped**. A provider
 * response covers whole days, so at 3 pm it still contains midnight through
 * 2 pm. Rendering those would show yesterday's afternoon as "upcoming".
 */
export class GetHourlyForecast {
  constructor(private readonly repository: WeatherRepository) {}

  async execute(
    coordinates: Coordinates,
    hours: number = DEFAULT_HOURS,
    now: Date = new Date(),
  ): Promise<Result<HourlyPoint[], AppError>> {
    const forecast = await this.repository.getForecast(coordinates);
    if (forecast.isErr()) return err(forecast.error);

    // The current hour counts as upcoming — it has not finished yet.
    const cutoff = new Date(now);
    cutoff.setMinutes(0, 0, 0);

    const upcoming = forecast.value.hourly.points
      .filter((point) => point.time.getTime() >= cutoff.getTime())
      .slice(0, hours);

    return ok(upcoming);
  }
}
