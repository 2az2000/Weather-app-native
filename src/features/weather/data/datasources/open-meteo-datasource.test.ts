import type { HttpClient } from '@/core/api';
import { err, ok } from '@/core/errors';
import { noopLogger } from '@/core/logger';

import { openMeteoFixture } from '../mappers/__fixtures__';

import { OpenMeteoDataSource } from './open-meteo-datasource';

/**
 * The data source is a thin wrapper, but two things it does are worth testing:
 * the REQUEST it builds, and that a malformed response becomes a typed error
 * rather than a crash.
 */
type GetCall = { url: string; params: Record<string, unknown> };

/**
 * `HttpClient.get` is generic in its response type, so a fake that always
 * returns the same value cannot satisfy the signature structurally. The cast is
 * confined to these two builders — the data source under test sees a properly
 * typed client.
 */
function fakeClient(response: unknown, calls: GetCall[] = []): HttpClient {
  const get = (url: string, config?: { params?: unknown }) => {
    calls.push({ url, params: (config?.params ?? {}) as Record<string, unknown> });
    return Promise.resolve(ok(response));
  };

  return { provider: 'open-meteo', get } as unknown as HttpClient;
}

function failingClient(): HttpClient {
  const get = () => Promise.resolve(err({ kind: 'network', retryable: true }));

  return { provider: 'open-meteo', get } as unknown as HttpClient;
}

describe('OpenMeteoDataSource', () => {
  describe('getForecast', () => {
    it('returns a mapped forecast', async () => {
      const source = new OpenMeteoDataSource(
        fakeClient(openMeteoFixture()),
        fakeClient({}),
        noopLogger,
      );

      const result = await source.getForecast({ latitude: 35.6892, longitude: 51.389 });

      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr(null as never).provider).toBe('open-meteo');
    });

    it('QUANTIZES coordinates before building the url', async () => {
      const calls: GetCall[] = [];
      const source = new OpenMeteoDataSource(
        fakeClient(openMeteoFixture(), calls),
        fakeClient({}),
        noopLogger,
      );

      await source.getForecast({ latitude: 35.689198, longitude: 51.38897 });
      await source.getForecast({ latitude: 35.689204, longitude: 51.389012 });

      // Two drifting GPS fixes must produce an IDENTICAL url, so the
      // provider's own caching works too — not just ours (CLAUDE.md §25).
      expect(calls[0]?.params['latitude']).toBe(calls[1]?.params['latitude']);
      expect(calls[0]?.params['longitude']).toBe(calls[1]?.params['longitude']);
    });

    it('requests canonical units, never user-preferred ones', async () => {
      const calls: GetCall[] = [];
      const source = new OpenMeteoDataSource(
        fakeClient(openMeteoFixture(), calls),
        fakeClient({}),
        noopLogger,
      );

      await source.getForecast({ latitude: 35.6892, longitude: 51.389 });

      // Storing user units would corrupt the cache the moment the preference
      // changed (CLAUDE.md §11).
      expect(calls[0]?.params).toMatchObject({
        temperature_unit: 'celsius',
        wind_speed_unit: 'ms',
        precipitation_unit: 'mm',
      });
    });

    it('asks for times local to the location', async () => {
      const calls: GetCall[] = [];
      const source = new OpenMeteoDataSource(
        fakeClient(openMeteoFixture(), calls),
        fakeClient({}),
        noopLogger,
      );

      await source.getForecast({ latitude: 35.6892, longitude: 51.389 });

      expect(calls[0]?.params['timezone']).toBe('auto');
    });

    it('requests every metric the app displays', async () => {
      const calls: GetCall[] = [];
      const source = new OpenMeteoDataSource(
        fakeClient(openMeteoFixture(), calls),
        fakeClient({}),
        noopLogger,
      );

      await source.getForecast({ latitude: 35.6892, longitude: 51.389 });

      // Omitting a field silently drops it from the response, so this list is
      // load-bearing (ROADMAP Phase 4 DoD: every metric retrievable).
      const current = String(calls[0]?.params['current']);
      for (const field of [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'dew_point_2m',
        'pressure_msl',
        'visibility',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'uv_index',
      ]) {
        expect(current).toContain(field);
      }

      expect(String(calls[0]?.params['daily'])).toContain('sunrise');
      expect(String(calls[0]?.params['daily'])).toContain('sunset');
      expect(calls[0]?.params['minutely_15']).toBe('precipitation');
    });

    it('returns a validation error for a malformed response', async () => {
      const source = new OpenMeteoDataSource(
        fakeClient({ nonsense: true }),
        fakeClient({}),
        noopLogger,
      );

      const result = await source.getForecast({ latitude: 35.6892, longitude: 51.389 });

      // Caught at the boundary, where the message is still meaningful, rather
      // than crashing a screen far from the cause (CLAUDE.md §9).
      expect(result.isErr() && result.error.kind).toBe('validation');
    });

    it('propagates a transport failure unchanged', async () => {
      const source = new OpenMeteoDataSource(failingClient(), fakeClient({}), noopLogger);

      const result = await source.getForecast({ latitude: 35.6892, longitude: 51.389 });

      expect(result.isErr() && result.error.kind).toBe('network');
    });
  });

  describe('getHistorical', () => {
    const archiveResponse = {
      latitude: 35.6892,
      longitude: 51.389,
      daily: {
        time: ['2026-07-01', '2026-07-02'],
        temperature_2m_max: [34.1, 35.0],
        temperature_2m_min: [22.3, 23.1],
        precipitation_sum: [0, 1.2],
      },
    };

    it('maps archive days', async () => {
      const source = new OpenMeteoDataSource(
        fakeClient({}),
        fakeClient(archiveResponse),
        noopLogger,
      );

      const result = await source.getHistorical(
        { latitude: 35.6892, longitude: 51.389 },
        new Date('2026-07-01'),
        new Date('2026-07-02'),
      );

      expect(result.unwrapOr([])).toHaveLength(2);
      expect(result.unwrapOr([])[1]?.precipitationSum).toBe(1.2);
    });

    it('formats dates as YYYY-MM-DD, which the archive expects', async () => {
      const calls: GetCall[] = [];
      const source = new OpenMeteoDataSource(
        fakeClient({}),
        fakeClient(archiveResponse, calls),
        noopLogger,
      );

      await source.getHistorical(
        { latitude: 35.6892, longitude: 51.389 },
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-10T00:00:00Z'),
      );

      expect(calls[0]?.params['start_date']).toBe('2026-07-01');
      expect(calls[0]?.params['end_date']).toBe('2026-07-10');
    });

    it('drops a day missing its high or low rather than defaulting it', async () => {
      const sparse = {
        ...archiveResponse,
        daily: { ...archiveResponse.daily, temperature_2m_max: [34.1, null] },
      };
      const source = new OpenMeteoDataSource(
        fakeClient({}),
        fakeClient(sparse),
        noopLogger,
      );

      const result = await source.getHistorical(
        { latitude: 35.6892, longitude: 51.389 },
        new Date('2026-07-01'),
        new Date('2026-07-02'),
      );

      expect(result.unwrapOr([])).toHaveLength(1);
    });

    it('returns a validation error for a malformed archive response', async () => {
      const source = new OpenMeteoDataSource(
        fakeClient({}),
        fakeClient({ bad: true }),
        noopLogger,
      );

      const result = await source.getHistorical(
        { latitude: 35.6892, longitude: 51.389 },
        new Date('2026-07-01'),
        new Date('2026-07-02'),
      );

      expect(result.isErr() && result.error.kind).toBe('validation');
    });
  });
});
