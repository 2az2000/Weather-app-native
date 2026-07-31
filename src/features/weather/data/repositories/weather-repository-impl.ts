import { STALE_TIME } from '@/core/config';
import { err, ok, unknownError, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';
import type { Coordinates } from '@/shared/types';
import { geohash, type RequestCoalescer } from '@/shared/utils';

import type {
  Forecast,
  HistoricalDay,
  SevereAlert,
  WeatherRepository,
} from '../../domain';
import type { CircuitBreaker } from '../datasources/circuit-breaker';
import type { LocalWeatherStore } from '../datasources/local-weather-datasource';
import type { OpenMeteoDataSource } from '../datasources/open-meteo-datasource';
import type { OpenWeatherDataSource } from '../datasources/open-weather-datasource';

/**
 * The only boundary between weather business logic and the outside world.
 *
 * Owns three responsibilities the layers above must not know about
 * (CLAUDE.md §10):
 *
 * 1. **Cache-first orchestration** — fresh cache short-circuits the network.
 * 2. **Provider failover** — the circuit breaker routes around a sick upstream.
 * 3. **Stale-over-error** — offline with old data beats an error screen (§24).
 */
export class WeatherRepositoryImpl implements WeatherRepository {
  constructor(
    private readonly primary: OpenMeteoDataSource,
    private readonly fallback: OpenWeatherDataSource,
    private readonly local: LocalWeatherStore,
    private readonly breaker: CircuitBreaker,
    private readonly coalescer: RequestCoalescer,
    private readonly logger: Logger,
    /** Injected so tests need no fake timers. */
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Cache-first.
   *
   * The ordering matters and is the heart of the offline story:
   *
   * 1. Fresh cache → return it, no request at all.
   * 2. Otherwise fetch. On success, persist and return.
   * 3. **On failure with ANY cached data → return the stale copy.** The UI
   *    labels its age; an error screen when a usable forecast exists on disk is
   *    strictly worse (CLAUDE.md §24 rule 1).
   */
  async getForecast(coordinates: Coordinates): Promise<Result<Forecast, AppError>> {
    const cached = await this.local.getForecast(coordinates);
    const entry = cached.isOk() ? cached.value : undefined;

    if (entry !== undefined && entry.ageMs < STALE_TIME.current) {
      this.logger.debug('weather.cache.fresh', { ageMs: entry.ageMs });
      return ok(entry.forecast);
    }

    const fetched = await this.fetchForecast(coordinates);

    if (fetched.isOk()) {
      await this.local.saveForecast(coordinates, fetched.value);
      return fetched;
    }

    if (entry !== undefined) {
      this.logger.info('weather.cache.staleFallback', {
        ageMs: entry.ageMs,
        kind: fetched.error.kind,
      });
      return ok(entry.forecast);
    }

    return fetched;
  }

  /**
   * Force a refetch, ignoring cached freshness.
   *
   * Still falls back to cache on failure: a failed pull-to-refresh should leave
   * the user looking at what they had, not at an empty screen.
   */
  async refreshForecast(coordinates: Coordinates): Promise<Result<Forecast, AppError>> {
    const fetched = await this.fetchForecast(coordinates);

    if (fetched.isOk()) {
      await this.local.saveForecast(coordinates, fetched.value);
      return fetched;
    }

    const cached = await this.local.getForecast(coordinates);
    if (cached.isOk() && cached.value !== undefined) {
      return ok(cached.value.forecast);
    }

    return fetched;
  }

  /**
   * Fetch with failover and coalescing.
   *
   * Coalesced on the geohash CELL, so three components mounting at once issue
   * one request rather than three (CLAUDE.md §21).
   */
  private fetchForecast(coordinates: Coordinates): Promise<Result<Forecast, AppError>> {
    const key = `forecast:${geohash(coordinates)}`;

    return this.coalescer.run(key, async () => {
      const now = this.now();

      // ── Primary ────────────────────────────────────────────────────────────
      if (this.breaker.isAvailable(this.primary.provider, now)) {
        const result = await this.primary.getForecast(coordinates);

        if (result.isOk()) {
          this.breaker.recordSuccess(this.primary.provider);
          return result;
        }

        this.breaker.recordFailure(this.primary.provider, result.error, now);

        // A device-side failure will fail identically on the fallback, and
        // trying anyway just doubles the wait before the same error.
        if (isDeviceSideFailure(result.error)) return result;

        this.logger.warn('weather.provider.fallback', {
          from: this.primary.provider,
          to: this.fallback.provider,
          kind: result.error.kind,
        });
      } else {
        this.logger.debug('weather.provider.skipped', {
          provider: this.primary.provider,
          cooldownMs: this.breaker.cooldownRemaining(this.primary.provider, now),
        });
      }

      // ── Fallback ───────────────────────────────────────────────────────────
      if (!this.breaker.isAvailable(this.fallback.provider, now)) {
        return err(unknownError('every weather provider is in cooldown'));
      }

      const result = await this.fallback.getForecast(coordinates);

      if (result.isOk()) {
        this.breaker.recordSuccess(this.fallback.provider);
      } else {
        this.breaker.recordFailure(this.fallback.provider, result.error, now);
      }

      return result;
    });
  }

  /**
   * Severe alerts.
   *
   * OpenWeather only — Open-Meteo publishes no warnings (ADR-0002). There is no
   * failover here, because there is nowhere to fail over TO.
   */
  getAlerts(coordinates: Coordinates): Promise<Result<SevereAlert[], AppError>> {
    return this.coalescer.run(`alerts:${geohash(coordinates)}`, () =>
      this.fallback.getAlerts(coordinates),
    );
  }

  /**
   * Historical observations.
   *
   * Cached indefinitely and never revalidated: the past does not change
   * (CLAUDE.md §25). A cache hit covering the whole range skips the network
   * entirely.
   */
  async getHistorical(
    coordinates: Coordinates,
    from: Date,
    to: Date,
  ): Promise<Result<HistoricalDay[], AppError>> {
    const cached = await this.local.getHistorical(coordinates, from, to);

    if (cached.isOk() && coversRange(cached.value, from, to)) {
      return cached;
    }

    const key = `historical:${geohash(coordinates)}:${toIsoDate(from)}:${toIsoDate(to)}`;

    const fetched = await this.coalescer.run(key, () =>
      this.primary.getHistorical(coordinates, from, to),
    );

    if (fetched.isOk()) {
      await this.local.saveHistorical(coordinates, fetched.value);
      return fetched;
    }

    // Partial cached history beats nothing when the archive is unreachable.
    if (cached.isOk() && cached.value.length > 0) return cached;

    return fetched;
  }
}

/**
 * Whether a failure originates on the DEVICE rather than at the provider.
 *
 * Failing over would hit the same wall — the phone is offline either way — and
 * would make the user wait through a second timeout for the same answer.
 */
function isDeviceSideFailure(error: AppError): boolean {
  return error.kind === 'network' || error.kind === 'timeout';
}

/** Whether cached days span the whole requested range, with no gaps. */
function coversRange(days: readonly HistoricalDay[], from: Date, to: Date): boolean {
  if (days.length === 0) return false;

  const MS_PER_DAY = 86_400_000;
  const expected = Math.floor((startOfDay(to) - startOfDay(from)) / MS_PER_DAY) + 1;

  return days.length >= expected;
}

function startOfDay(date: Date): number {
  return Date.parse(`${date.toISOString().slice(0, 10)}T00:00:00Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
