import { err, validationError, type AppError, type Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import type { HistoricalDay } from '../entities/forecast';
import type { WeatherRepository } from '../repositories/weather-repository';

/** Open-Meteo's archive begins here (ADR-0002). */
const ARCHIVE_START = new Date('1940-01-01T00:00:00Z');

/**
 * Observations for a past date range.
 *
 * Validates the range before calling out. A reversed or future range would
 * otherwise reach the provider and come back as an opaque 400 that says nothing
 * about which end was wrong.
 */
export class GetHistoricalWeather {
  constructor(private readonly repository: WeatherRepository) {}

  execute(
    coordinates: Coordinates,
    from: Date,
    to: Date,
    now: Date = new Date(),
  ): Promise<Result<HistoricalDay[], AppError>> {
    const issues: string[] = [];

    if (from.getTime() > to.getTime()) {
      issues.push('the start date must not be after the end date');
    }
    if (to.getTime() > now.getTime()) {
      // "Historical" and "future" are different questions with different
      // endpoints; silently clamping would answer the wrong one.
      issues.push('historical weather cannot be requested for a future date');
    }
    if (from.getTime() < ARCHIVE_START.getTime()) {
      issues.push('the archive begins in 1940');
    }

    if (issues.length > 0) {
      return Promise.resolve(err(validationError(issues)));
    }

    return this.repository.getHistorical(coordinates, from, to);
  }
}
