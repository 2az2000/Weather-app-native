import { validateResponse, type HttpClient } from '@/core/api';
import { err, ok, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';
import type { Coordinates } from '@/shared/types';
import { quantize } from '@/shared/utils';

import type { Forecast, SevereAlert } from '../../domain';
import { openWeatherResponseSchema } from '../dto/open-weather-dto';
import { toForecast, toSevereAlerts } from '../mappers/open-weather-mapper';

/**
 * OpenWeather One Call 3.0 — the fallback provider and the ONLY source of
 * severe weather alerts (ADR-0002).
 *
 * Requires an API key, attached once by the client in `core/api` rather than at
 * each call site.
 */
export class OpenWeatherDataSource {
  readonly provider = 'openweather';

  constructor(
    private readonly client: HttpClient,
    private readonly logger: Logger,
  ) {}

  async getForecast(coordinates: Coordinates): Promise<Result<Forecast, AppError>> {
    const parsed = await this.fetch(coordinates);
    return parsed.isErr() ? err(parsed.error) : ok(toForecast(parsed.value));
  }

  /**
   * Severe weather alerts.
   *
   * Comes from the same endpoint as the forecast, so this shares the request
   * shape — the coalescer means asking for both does not cost two calls.
   */
  async getAlerts(coordinates: Coordinates): Promise<Result<SevereAlert[], AppError>> {
    const parsed = await this.fetch(coordinates);
    return parsed.isErr() ? err(parsed.error) : ok(toSevereAlerts(parsed.value));
  }

  private async fetch(coordinates: Coordinates) {
    const cell = quantize(coordinates);

    const response = await this.client.get<unknown>('/onecall', {
      params: {
        lat: cell.latitude,
        lon: cell.longitude,
        // Canonical units. OpenWeather's "metric" is °C and m/s, which matches.
        units: 'metric',
        exclude: '',
      },
    });

    if (response.isErr()) return err(response.error);

    return validateResponse(
      openWeatherResponseSchema,
      response.value,
      { provider: this.provider, endpoint: '/onecall' },
      this.logger,
    );
  }
}
