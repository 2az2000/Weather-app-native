import { validateResponse, type HttpClient } from '@/core/api';
import { err, ok, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';
import type { Coordinates } from '@/shared/types';
import { quantize } from '@/shared/utils';

import type { Forecast, HistoricalDay } from '../../domain';
import {
  openMeteoArchiveResponseSchema,
  openMeteoForecastResponseSchema,
} from '../dto/open-meteo-forecast-dto';
import { toForecast, toHistoricalDays } from '../mappers/open-meteo-mapper';

/**
 * Open-Meteo — the primary provider (ADR-0002).
 *
 * No API key. 10,000 requests/day, which is why caching here is a UX feature
 * rather than a survival mechanism.
 */

/** Requested explicitly: omitting one silently drops it from the response. */
const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'dew_point_2m',
  'visibility',
  'uv_index',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'weather_code',
  'pressure_msl',
  'cloud_cover',
  'visibility',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'dew_point_2m',
  'uv_index',
  'is_day',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'sunrise',
  'sunset',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'uv_index_max',
].join(',');

/** The provider's own maximum. */
const FORECAST_DAYS = 16;

export class OpenMeteoDataSource {
  readonly provider = 'open-meteo';

  constructor(
    private readonly forecastClient: HttpClient,
    private readonly archiveClient: HttpClient,
    private readonly logger: Logger,
  ) {}

  async getForecast(coordinates: Coordinates): Promise<Result<Forecast, AppError>> {
    // Quantized before the request, so every GPS fix in a cell produces an
    // IDENTICAL url — which lets the provider's own caching work too, not just
    // ours (CLAUDE.md §25).
    const cell = quantize(coordinates);

    const response = await this.forecastClient.get<unknown>('/forecast', {
      params: {
        latitude: cell.latitude,
        longitude: cell.longitude,
        current: CURRENT_FIELDS,
        hourly: HOURLY_FIELDS,
        daily: DAILY_FIELDS,
        minutely_15: 'precipitation',
        // Canonical units — conversion for display happens in presentation
        // (CLAUDE.md §11).
        temperature_unit: 'celsius',
        wind_speed_unit: 'ms',
        precipitation_unit: 'mm',
        // Times come back local to the location, which is what a forecast means.
        timezone: 'auto',
        forecast_days: FORECAST_DAYS,
      },
    });

    if (response.isErr()) return err(response.error);

    const parsed = validateResponse(
      openMeteoForecastResponseSchema,
      response.value,
      { provider: this.provider, endpoint: '/forecast' },
      this.logger,
    );

    return parsed.isErr() ? err(parsed.error) : ok(toForecast(parsed.value));
  }

  /**
   * Observations for a past date range.
   *
   * A different host from the forecast API, hence a separate client.
   */
  async getHistorical(
    coordinates: Coordinates,
    from: Date,
    to: Date,
  ): Promise<Result<HistoricalDay[], AppError>> {
    const cell = quantize(coordinates);

    const response = await this.archiveClient.get<unknown>('/archive', {
      params: {
        latitude: cell.latitude,
        longitude: cell.longitude,
        start_date: toIsoDate(from),
        end_date: toIsoDate(to),
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
        temperature_unit: 'celsius',
        precipitation_unit: 'mm',
      },
    });

    if (response.isErr()) return err(response.error);

    const parsed = validateResponse(
      openMeteoArchiveResponseSchema,
      response.value,
      { provider: this.provider, endpoint: '/archive' },
      this.logger,
    );

    return parsed.isErr() ? err(parsed.error) : ok(toHistoricalDays(parsed.value));
  }
}

/** `YYYY-MM-DD`, which is what the archive API expects. */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
