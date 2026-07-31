import { err, ok, type AppError, type Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import type { DailyPoint } from '../entities/forecast';
import type { WeatherRepository } from '../repositories/weather-repository';

const DEFAULT_DAYS = 7;

/**
 * The next N days.
 *
 * Includes TODAY, because "today's high and low" is what a user expects at the
 * top of a daily list — dropping the current day would make the list start
 * tomorrow and look off by one.
 */
export class GetDailyForecast {
  constructor(private readonly repository: WeatherRepository) {}

  async execute(
    coordinates: Coordinates,
    days: number = DEFAULT_DAYS,
    now: Date = new Date(),
  ): Promise<Result<DailyPoint[], AppError>> {
    const forecast = await this.repository.getForecast(coordinates);
    if (forecast.isErr()) return err(forecast.error);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const upcoming = forecast.value.daily.points
      .filter((point) => point.date.getTime() >= startOfToday.getTime())
      .slice(0, days);

    return ok(upcoming);
  }
}
