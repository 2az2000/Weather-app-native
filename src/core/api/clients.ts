import { REQUEST_TIMEOUT_MS, type Env } from '@/core/config';
import type { Logger } from '@/core/logger';

import { createHttpClient, type HttpClient } from './http-client';

/**
 * One client per provider — the proxy seam (ADR-0003).
 *
 * Introducing a backend-for-frontend later means changing `baseURL` here and the
 * DTO shapes in the data layer. No domain or presentation code changes. Keeping
 * that true requires that provider-specific concepts never leak upward.
 *
 * Note how few of these need credentials: Open-Meteo serves forecast,
 * historical, air quality, and geocoding with no key at all (ADR-0002).
 */
export interface ApiClients {
  /** Forecast: current, 15-minute, hourly, daily to 16 days. No key. */
  readonly openMeteoForecast: HttpClient;
  /** Historical archive back to 1940. No key. */
  readonly openMeteoArchive: HttpClient;
  /** Air quality: PM2.5, PM10, CO, NO₂, SO₂, O₃, EU + US AQI. No key. */
  readonly openMeteoAirQuality: HttpClient;
  /** City search. No key. */
  readonly openMeteoGeocoding: HttpClient;
  /** Severe weather alerts and resilience fallback. Requires a key. */
  readonly openWeather: HttpClient;
  /** Rain radar tile metadata. No key. */
  readonly rainViewer: HttpClient;
}

export function createApiClients(env: Env, logger: Logger): ApiClients {
  return {
    openMeteoForecast: createHttpClient(
      { provider: 'open-meteo', baseURL: 'https://api.open-meteo.com/v1' },
      logger,
    ),

    openMeteoArchive: createHttpClient(
      {
        provider: 'open-meteo-archive',
        baseURL: 'https://archive-api.open-meteo.com/v1',
      },
      logger,
    ),

    openMeteoAirQuality: createHttpClient(
      {
        provider: 'open-meteo-air-quality',
        baseURL: 'https://air-quality-api.open-meteo.com/v1',
      },
      logger,
    ),

    openMeteoGeocoding: createHttpClient(
      {
        provider: 'open-meteo-geocoding',
        baseURL: 'https://geocoding-api.open-meteo.com/v1',
      },
      logger,
    ),

    openWeather: createHttpClient(
      {
        provider: 'openweather',
        baseURL: 'https://api.openweathermap.org/data/3.0',
        // OpenWeather keys by query parameter, so it is attached once here
        // rather than at each call site.
        params: { appid: env.openWeatherApiKey },
      },
      logger,
    ),

    rainViewer: createHttpClient(
      {
        provider: 'rainviewer',
        baseURL: 'https://api.rainviewer.com/public',
        timeoutMs: REQUEST_TIMEOUT_MS.tiles,
      },
      logger,
    ),
  };
}
