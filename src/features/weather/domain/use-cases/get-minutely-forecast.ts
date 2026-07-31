import { err, ok, type AppError, type Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import type { MinutelyPoint } from '../entities/forecast';
import type { WeatherRepository } from '../repositories/weather-repository';

/** Two hours of 15-minute slots — beyond that the resolution is not meaningful. */
const DEFAULT_MINUTES = 120;

export interface MinutelySummary {
  readonly points: readonly MinutelyPoint[];
  /** Whether any precipitation is expected in the window. */
  readonly willPrecipitate: boolean;
  /** When precipitation starts, if it is not already falling. */
  readonly startsAt: Date | undefined;
  /**
   * Whether these values were interpolated from hourly data.
   *
   * True outside North America and Central Europe (ADR-0002). The UI must not
   * imply minute-level precision that the model does not have.
   */
  readonly isInterpolated: boolean;
}

/**
 * Near-term precipitation.
 *
 * Summarises rather than returning raw points, because "will it rain, and
 * when" is the question — and deciding that is domain logic, not a rendering
 * concern (CLAUDE.md §15 rule 5).
 */
export class GetMinutelyForecast {
  constructor(private readonly repository: WeatherRepository) {}

  async execute(
    coordinates: Coordinates,
    minutes: number = DEFAULT_MINUTES,
    now: Date = new Date(),
  ): Promise<Result<MinutelySummary | undefined, AppError>> {
    const forecast = await this.repository.getForecast(coordinates);
    if (forecast.isErr()) return err(forecast.error);

    const minutely = forecast.value.minutely;
    // Not every provider or region offers this; absence is normal.
    if (minutely === undefined) return ok(undefined);

    const horizon = now.getTime() + minutes * 60_000;
    const points = minutely.points.filter(
      (point) => point.time.getTime() >= now.getTime() && point.time.getTime() <= horizon,
    );

    const first = points.find((point) => point.precipitation > 0);

    return ok({
      points,
      willPrecipitate: first !== undefined,
      startsAt: first?.time,
      isInterpolated: points.some((point) => point.isInterpolated),
    });
  }
}
