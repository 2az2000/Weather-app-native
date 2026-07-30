import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { toAppError } from './error-mapper';

/**
 * ROADMAP Phase 1 DoD: "Every `AppError` variant is produced by a tested
 * interceptor path."
 *
 * These tests are the proof. If a mapping regresses, the layers above start
 * seeing `unknown` for a condition they were meant to handle specifically — a
 * failure that is invisible until a user hits it.
 */

function axiosErrorWithStatus(
  status: number,
  headers: Record<string, string> = {},
): AxiosError {
  const error = new AxiosError('request failed');
  error.response = {
    status,
    statusText: '',
    data: undefined,
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return error;
}

describe('toAppError', () => {
  describe('network', () => {
    it('maps a request with no response to a retryable network error', () => {
      // An AxiosError with no `response` is what a DNS failure, a refused
      // connection, or airplane mode produces.
      const error = new AxiosError('Network Error');

      expect(toAppError(error, 'open-meteo')).toEqual({
        kind: 'network',
        retryable: true,
      });
    });
  });

  describe('timeout', () => {
    it('maps ECONNABORTED and preserves the configured timeout', () => {
      const error = new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED');
      error.config = { timeout: 10_000, headers: new AxiosHeaders() };

      expect(toAppError(error, 'open-meteo')).toEqual({
        kind: 'timeout',
        timeoutMs: 10_000,
        retryable: true,
      });
    });

    it('maps ETIMEDOUT', () => {
      const error = new AxiosError('timeout', 'ETIMEDOUT');
      expect(toAppError(error, 'open-meteo')).toMatchObject({ kind: 'timeout' });
    });
  });

  describe('rateLimit', () => {
    it('maps 429 and reads Retry-After given in seconds', () => {
      const mapped = toAppError(
        axiosErrorWithStatus(429, { 'retry-after': '30' }),
        'openweather',
      );
      expect(mapped).toEqual({
        kind: 'rateLimit',
        retryAfterMs: 30_000,
        retryable: true,
      });
    });

    it('reads Retry-After given as an HTTP date', () => {
      const twoMinutes = new Date(Date.now() + 120_000).toUTCString();
      const mapped = toAppError(
        axiosErrorWithStatus(429, { 'retry-after': twoMinutes }),
        'openweather',
      );

      expect(mapped.kind).toBe('rateLimit');
      if (mapped.kind === 'rateLimit') {
        // Allow slack for clock drift between constructing and parsing.
        expect(mapped.retryAfterMs).toBeGreaterThan(100_000);
        expect(mapped.retryAfterMs).toBeLessThanOrEqual(120_000);
      }
    });

    it('falls back to a default when Retry-After is absent or unparseable', () => {
      expect(toAppError(axiosErrorWithStatus(429), 'openweather')).toMatchObject({
        kind: 'rateLimit',
        retryAfterMs: 60_000,
      });

      expect(
        toAppError(axiosErrorWithStatus(429, { 'retry-after': 'soon' }), 'openweather'),
      ).toMatchObject({ kind: 'rateLimit', retryAfterMs: 60_000 });
    });
  });

  describe('providerDegraded', () => {
    it.each([500, 502, 503, 504, 408])('maps %s to a degraded provider', (status) => {
      expect(toAppError(axiosErrorWithStatus(status), 'open-meteo')).toEqual({
        kind: 'providerDegraded',
        provider: 'open-meteo',
        status,
        retryable: true,
      });
    });

    it('names the provider so the circuit breaker knows what to cool down', () => {
      const mapped = toAppError(axiosErrorWithStatus(503), 'openweather');
      expect(mapped).toMatchObject({ provider: 'openweather' });
    });
  });

  describe('notFound', () => {
    it('maps 404 and records the resource', () => {
      expect(toAppError(axiosErrorWithStatus(404), 'open-meteo', '/forecast')).toEqual({
        kind: 'notFound',
        resource: '/forecast',
        retryable: false,
      });
    });
  });

  describe('unknown', () => {
    it('maps a non-Axios throw', () => {
      expect(toAppError(new Error('boom'), 'open-meteo')).toMatchObject({
        kind: 'unknown',
      });
    });

    it('maps a 4xx that is our own bug, and does NOT blame the provider', () => {
      const mapped = toAppError(axiosErrorWithStatus(401), 'openweather');

      expect(mapped.kind).toBe('unknown');
      expect(mapped.retryable).toBe(false);
    });

    it('does not retry a 400, since retrying a bad request cannot help', () => {
      expect(toAppError(axiosErrorWithStatus(400), 'open-meteo').retryable).toBe(false);
    });
  });
});
