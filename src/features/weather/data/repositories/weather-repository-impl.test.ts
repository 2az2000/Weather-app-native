import {
  err,
  networkError,
  ok,
  providerDegradedError,
  rateLimitError,
  timeoutError,
  type AppError,
  type Result,
} from '@/core/errors';
import { noopLogger } from '@/core/logger';
import { RequestCoalescer } from '@/shared/utils';

import type { Forecast } from '../../domain';
import { CircuitBreaker } from '../datasources/circuit-breaker';
import type {
  CachedForecast,
  LocalWeatherStore,
} from '../datasources/local-weather-datasource';
import type { OpenMeteoDataSource } from '../datasources/open-meteo-datasource';
import type { OpenWeatherDataSource } from '../datasources/open-weather-datasource';
import { openMeteoFixture, openWeatherFixture } from '../mappers/__fixtures__';
import { toForecast as openMeteoToForecast } from '../mappers/open-meteo-mapper';
import { toForecast as openWeatherToForecast } from '../mappers/open-weather-mapper';

import { WeatherRepositoryImpl } from './weather-repository-impl';

const COORDINATES = { latitude: 35.6892, longitude: 51.389 };

const PRIMARY_FORECAST = openMeteoToForecast(openMeteoFixture());
const FALLBACK_FORECAST = openWeatherToForecast(openWeatherFixture());

/** A controllable primary. Counts calls so coalescing is observable. */
function fakePrimary(results: readonly Result<Forecast, AppError>[]) {
  let call = 0;
  const source = {
    provider: 'open-meteo',
    getForecast: jest.fn(async () => {
      const result = results[Math.min(call, results.length - 1)];
      call += 1;
      // Yield a macrotask so concurrent callers genuinely overlap; without this
      // the promise settles before the second caller arrives and coalescing
      // would appear to work even if it were broken.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return result ?? ok(PRIMARY_FORECAST);
    }),
    getHistorical: jest.fn(async () => ok([])),
  };
  return source as unknown as OpenMeteoDataSource & { getForecast: jest.Mock };
}

function fakeFallback(result: Result<Forecast, AppError> = ok(FALLBACK_FORECAST)) {
  const source = {
    provider: 'openweather',
    getForecast: jest.fn(async () => result),
    getAlerts: jest.fn(async () => ok([])),
  };
  return source as unknown as OpenWeatherDataSource & { getForecast: jest.Mock };
}

function fakeStore(cached?: CachedForecast): LocalWeatherStore & { saved: Forecast[] } {
  const saved: Forecast[] = [];

  return {
    saved,
    getForecast: async () => ok(cached),
    saveForecast: async (_coordinates, forecast) => {
      saved.push(forecast);
      return ok(undefined);
    },
    getHistorical: async () => ok([]),
    saveHistorical: async () => ok(undefined),
  };
}

function build(
  primary: OpenMeteoDataSource,
  fallback: OpenWeatherDataSource,
  store: LocalWeatherStore,
  breaker = new CircuitBreaker(noopLogger, 60_000),
  now: () => number = () => 1_000_000,
) {
  return new WeatherRepositoryImpl(
    primary,
    fallback,
    store,
    breaker,
    new RequestCoalescer(),
    noopLogger,
    now,
  );
}

describe('WeatherRepositoryImpl', () => {
  describe('cache-first', () => {
    it('returns fresh cached data WITHOUT touching the network', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const store = fakeStore({
        forecast: PRIMARY_FORECAST,
        fetchedAt: new Date(),
        ageMs: 60_000, // 1 minute — well inside the 10-minute tier
      });

      const result = await build(primary, fakeFallback(), store).getForecast(COORDINATES);

      expect(result.isOk()).toBe(true);
      expect(primary.getForecast).not.toHaveBeenCalled();
    });

    it('fetches when the cache is stale', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const store = fakeStore({
        forecast: PRIMARY_FORECAST,
        fetchedAt: new Date(),
        ageMs: 30 * 60_000, // 30 minutes — past the tier
      });

      await build(primary, fakeFallback(), store).getForecast(COORDINATES);

      expect(primary.getForecast).toHaveBeenCalledTimes(1);
    });

    it('persists a successful fetch', async () => {
      const store = fakeStore();

      await build(fakePrimary([ok(PRIMARY_FORECAST)]), fakeFallback(), store).getForecast(
        COORDINATES,
      );

      expect(store.saved).toHaveLength(1);
    });
  });

  describe('offline behaviour', () => {
    /**
     * ROADMAP Phase 4 DoD: "Repository returns **stale cached data when
     * offline** rather than an error."
     */
    it('returns STALE cached data rather than an error when the network fails', async () => {
      const primary = fakePrimary([err(networkError())]);
      const store = fakeStore({
        forecast: PRIMARY_FORECAST,
        fetchedAt: new Date(),
        ageMs: 6 * 60 * 60_000, // six hours old
      });

      const result = await build(
        primary,
        fakeFallback(err(networkError())),
        store,
      ).getForecast(COORDINATES);

      // An error screen when a usable forecast sits on disk is strictly worse.
      // The UI labels the age (CLAUDE.md §24 rule 1).
      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr(null as never).current.temperature).toBe(
        PRIMARY_FORECAST.current.temperature,
      );
    });

    it('surfaces the error when there is nothing cached at all', async () => {
      const result = await build(
        fakePrimary([err(networkError())]),
        fakeFallback(err(networkError())),
        fakeStore(),
      ).getForecast(COORDINATES);

      expect(result.isErr() && result.error.kind).toBe('network');
    });

    it('falls back to cache when a forced refresh fails', async () => {
      const store = fakeStore({
        forecast: PRIMARY_FORECAST,
        fetchedAt: new Date(),
        ageMs: 60_000,
      });

      const result = await build(
        fakePrimary([err(networkError())]),
        fakeFallback(err(networkError())),
        store,
      ).refreshForecast(COORDINATES);

      // A failed pull-to-refresh should leave the user looking at what they
      // had, not at an empty screen.
      expect(result.isOk()).toBe(true);
    });

    it('refresh ignores cache freshness and always fetches', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const store = fakeStore({
        forecast: PRIMARY_FORECAST,
        fetchedAt: new Date(),
        ageMs: 1000, // very fresh
      });

      await build(primary, fakeFallback(), store).refreshForecast(COORDINATES);

      expect(primary.getForecast).toHaveBeenCalledTimes(1);
    });
  });

  describe('circuit breaker and failover', () => {
    /**
     * ROADMAP Phase 4 DoD: "Circuit breaker tested: forced Open-Meteo failure
     * routes to OpenWeather and recovers after cooldown."
     */
    it('routes to the fallback when the primary is degraded', async () => {
      const primary = fakePrimary([err(providerDegradedError('open-meteo', 503))]);
      const fallback = fakeFallback();

      const result = await build(primary, fallback, fakeStore()).getForecast(COORDINATES);

      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr(null as never).provider).toBe('openweather');
      expect(fallback.getForecast).toHaveBeenCalledTimes(1);
    });

    it('routes to the fallback on a rate limit', async () => {
      const fallback = fakeFallback();

      await build(
        fakePrimary([err(rateLimitError(30_000))]),
        fallback,
        fakeStore(),
      ).getForecast(COORDINATES);

      expect(fallback.getForecast).toHaveBeenCalledTimes(1);
    });

    it('SKIPS the degraded primary entirely on the next call', async () => {
      const primary = fakePrimary([err(providerDegradedError('open-meteo', 503))]);
      const fallback = fakeFallback();
      const breaker = new CircuitBreaker(noopLogger, 60_000);
      const repository = build(primary, fallback, fakeStore(), breaker);

      await repository.getForecast(COORDINATES);
      await repository.getForecast(COORDINATES);

      // Still one call: the second request did not even try the primary.
      expect(primary.getForecast).toHaveBeenCalledTimes(1);
      expect(fallback.getForecast).toHaveBeenCalledTimes(2);
    });

    it('RECOVERS and tries the primary again after the cooldown', async () => {
      const primary = fakePrimary([
        err(providerDegradedError('open-meteo', 503)),
        ok(PRIMARY_FORECAST),
      ]);
      const breaker = new CircuitBreaker(noopLogger, 60_000);

      let clock = 1_000_000;
      const repository = build(
        primary,
        fakeFallback(),
        fakeStore(),
        breaker,
        () => clock,
      );

      await repository.getForecast(COORDINATES);
      expect(primary.getForecast).toHaveBeenCalledTimes(1);

      // Advance past the cooldown.
      clock += 61_000;
      const result = await repository.getForecast(COORDINATES);

      expect(primary.getForecast).toHaveBeenCalledTimes(2);
      expect(result.unwrapOr(null as never).provider).toBe('open-meteo');
    });

    describe('device-side failures', () => {
      it.each([
        ['network', networkError()],
        ['timeout', timeoutError(10_000)],
      ])('does NOT fail over on a %s error', async (_label, error) => {
        const fallback = fakeFallback();

        await build(fakePrimary([err(error)]), fallback, fakeStore()).getForecast(
          COORDINATES,
        );

        // The phone is offline; the fallback would fail identically and only
        // make the user wait through a second timeout.
        expect(fallback.getForecast).not.toHaveBeenCalled();
      });

      it('does not open the circuit for a device-side failure', async () => {
        const breaker = new CircuitBreaker(noopLogger, 60_000);
        const primary = fakePrimary([err(networkError()), ok(PRIMARY_FORECAST)]);
        const repository = build(primary, fakeFallback(), fakeStore(), breaker);

        await repository.getForecast(COORDINATES);
        await repository.getForecast(COORDINATES);

        // Blaming the provider for the device being offline would suppress a
        // healthy primary for the whole cooldown.
        expect(primary.getForecast).toHaveBeenCalledTimes(2);
      });
    });

    it('reports an error when every provider is in cooldown', async () => {
      const breaker = new CircuitBreaker(noopLogger, 60_000);
      breaker.recordFailure(
        'open-meteo',
        providerDegradedError('open-meteo', 503),
        1_000_000,
      );
      breaker.recordFailure(
        'openweather',
        providerDegradedError('openweather', 503),
        1_000_000,
      );

      const result = await build(
        fakePrimary([ok(PRIMARY_FORECAST)]),
        fakeFallback(),
        fakeStore(),
        breaker,
      ).getForecast(COORDINATES);

      expect(result.isErr()).toBe(true);
    });
  });

  describe('request coalescing', () => {
    /**
     * ROADMAP Phase 4 DoD: "Request coalescing tested — 10 concurrent identical
     * calls issue **one** HTTP request."
     */
    it('issues ONE request for ten concurrent identical calls', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const repository = build(primary, fakeFallback(), fakeStore());

      const results = await Promise.all(
        Array.from({ length: 10 }, () => repository.getForecast(COORDINATES)),
      );

      expect(primary.getForecast).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(10);
      for (const result of results) {
        expect(result.isOk()).toBe(true);
      }
    });

    it('coalesces on the geohash CELL, so nearby fixes share one request', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const repository = build(primary, fakeFallback(), fakeStore());

      await Promise.all([
        repository.getForecast({ latitude: 35.689198, longitude: 51.38897 }),
        repository.getForecast({ latitude: 35.689204, longitude: 51.389012 }),
        repository.getForecast({ latitude: 35.68923, longitude: 51.38904 }),
      ]);

      expect(primary.getForecast).toHaveBeenCalledTimes(1);
    });

    it('issues separate requests for genuinely different places', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const repository = build(primary, fakeFallback(), fakeStore());

      await Promise.all([
        repository.getForecast({ latitude: 35.6892, longitude: 51.389 }),
        repository.getForecast({ latitude: 29.5918, longitude: 52.5837 }),
      ]);

      expect(primary.getForecast).toHaveBeenCalledTimes(2);
    });

    it('does not replay a failure to later callers', async () => {
      const primary = fakePrimary([err(networkError()), ok(PRIMARY_FORECAST)]);
      const repository = build(primary, fakeFallback(err(networkError())), fakeStore());

      const first = await repository.getForecast(COORDINATES);
      const second = await repository.getForecast(COORDINATES);

      // A settled entry is removed, so one transient error does not become
      // permanent for everyone who asks afterwards.
      expect(first.isErr()).toBe(true);
      expect(second.isOk()).toBe(true);
    });
  });

  describe('severe alerts', () => {
    it('delegates to the fallback provider, the only source of warnings', async () => {
      const fallback = fakeFallback();

      await build(fakePrimary([ok(PRIMARY_FORECAST)]), fallback, fakeStore()).getAlerts(
        COORDINATES,
      );

      // Open-Meteo publishes no warnings (ADR-0002), so there is no failover
      // here — there is nowhere to fail over TO.
      expect(fallback.getAlerts).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent alert requests', async () => {
      const fallback = fakeFallback();
      const repository = build(
        fakePrimary([ok(PRIMARY_FORECAST)]),
        fallback,
        fakeStore(),
      );

      await Promise.all([
        repository.getAlerts(COORDINATES),
        repository.getAlerts(COORDINATES),
        repository.getAlerts(COORDINATES),
      ]);

      expect(fallback.getAlerts).toHaveBeenCalledTimes(1);
    });
  });

  describe('historical weather', () => {
    const FROM = new Date('2026-07-01T00:00:00Z');
    const TO = new Date('2026-07-03T00:00:00Z');

    const day = (date: string) => ({
      date: new Date(`${date}T00:00:00Z`),
      temperatureMax: 34 as never,
      temperatureMin: 22 as never,
      precipitationSum: 0 as never,
    });

    function storeWith(history: ReturnType<typeof day>[]): LocalWeatherStore {
      return {
        getForecast: async () => ok(undefined),
        saveForecast: async () => ok(undefined),
        getHistorical: async () => ok(history),
        saveHistorical: async () => ok(undefined),
      };
    }

    it('serves a fully-covered range from cache WITHOUT a request', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const store = storeWith([day('2026-07-01'), day('2026-07-02'), day('2026-07-03')]);

      const result = await build(primary, fakeFallback(), store).getHistorical(
        COORDINATES,
        FROM,
        TO,
      );

      // The past does not change, so a complete cached range is final
      // (CLAUDE.md §25).
      expect(result.unwrapOr([])).toHaveLength(3);
      expect(primary.getHistorical).not.toHaveBeenCalled();
    });

    it('fetches when the cached range has a GAP', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      const store = storeWith([day('2026-07-01')]);

      await build(primary, fakeFallback(), store).getHistorical(COORDINATES, FROM, TO);

      expect(primary.getHistorical).toHaveBeenCalledTimes(1);
    });

    it('fetches when nothing is cached', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);

      await build(primary, fakeFallback(), fakeStore()).getHistorical(
        COORDINATES,
        FROM,
        TO,
      );

      expect(primary.getHistorical).toHaveBeenCalledTimes(1);
    });

    it('falls back to PARTIAL cached history when the archive is unreachable', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      (primary.getHistorical as jest.Mock).mockResolvedValue(err(networkError()));
      const store = storeWith([day('2026-07-01')]);

      const result = await build(primary, fakeFallback(), store).getHistorical(
        COORDINATES,
        FROM,
        TO,
      );

      // Partial history beats nothing.
      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr([])).toHaveLength(1);
    });

    it('surfaces the error when there is no cached history at all', async () => {
      const primary = fakePrimary([ok(PRIMARY_FORECAST)]);
      (primary.getHistorical as jest.Mock).mockResolvedValue(err(networkError()));

      const result = await build(primary, fakeFallback(), fakeStore()).getHistorical(
        COORDINATES,
        FROM,
        TO,
      );

      expect(result.isErr()).toBe(true);
    });
  });
});
