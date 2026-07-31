import {
  err,
  fromPromise,
  ok,
  storageError,
  type AppError,
  type Result,
} from '@/core/errors';
import type { Database } from '@/core/storage';
import type { Coordinates } from '@/shared/types';
import { geohash } from '@/shared/utils';

import { celsius, millimeters, type Forecast, type HistoricalDay } from '../../domain';

/**
 * The durable weather cache (ADR-0004).
 *
 * SQLite rather than MMKV: forecasts are bulk, structured, and growing, and the
 * home screen widget reads from here in Phase 10 without launching the app.
 */

/** What a cached entry knows about itself. */
export interface CachedForecast {
  readonly forecast: Forecast;
  readonly fetchedAt: Date;
  /** Age in milliseconds. The CALLER applies its own staleness tier (§25). */
  readonly ageMs: number;
}

interface SnapshotRow {
  readonly payload: string;
  readonly fetched_at: number;
}

interface HistoricalRow {
  readonly date: string;
  readonly temperature_max: number;
  readonly temperature_min: number;
  readonly precipitation: number;
}

/**
 * The persistence surface the repository depends on.
 *
 * An interface so the unavailable-database fallback implements it honestly
 * rather than being cast into place (CLAUDE.md §12 bans `as` used that way).
 */
export interface LocalWeatherStore {
  getForecast(
    coordinates: Coordinates,
  ): Promise<Result<CachedForecast | undefined, AppError>>;
  saveForecast(
    coordinates: Coordinates,
    forecast: Forecast,
  ): Promise<Result<void, AppError>>;
  getHistorical(
    coordinates: Coordinates,
    from: Date,
    to: Date,
  ): Promise<Result<HistoricalDay[], AppError>>;
  saveHistorical(
    coordinates: Coordinates,
    days: readonly HistoricalDay[],
  ): Promise<Result<void, AppError>>;
}

const FORECAST_KIND = 'forecast';

export class SqliteWeatherStore implements LocalWeatherStore {
  constructor(private readonly database: Database) {}

  async getForecast(
    coordinates: Coordinates,
  ): Promise<Result<CachedForecast | undefined, AppError>> {
    const cell = geohash(coordinates);

    const row = await fromPromise(
      this.database.getFirst<SnapshotRow>(
        'SELECT payload, fetched_at FROM forecast_snapshots WHERE geohash = ? AND kind = ?',
        [cell, FORECAST_KIND],
      ),
      () => storageError('read cached forecast'),
    );

    if (row.isErr()) return err(row.error);
    if (row.value === null) return ok(undefined);

    // A payload written by an older app version can fail to revive. That is a
    // cache MISS, not a crash — the app refetches and overwrites it.
    const parsed = parseForecast(row.value.payload);
    if (parsed === undefined) return ok(undefined);

    return ok({
      forecast: parsed,
      fetchedAt: new Date(row.value.fetched_at),
      ageMs: Date.now() - row.value.fetched_at,
    });
  }

  async saveForecast(
    coordinates: Coordinates,
    forecast: Forecast,
  ): Promise<Result<void, AppError>> {
    const cell = geohash(coordinates);

    const result = await fromPromise(
      this.database.run(
        `INSERT INTO forecast_snapshots (geohash, kind, provider, payload, fetched_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(geohash, kind) DO UPDATE SET
           provider   = excluded.provider,
           payload    = excluded.payload,
           fetched_at = excluded.fetched_at`,
        [
          cell,
          FORECAST_KIND,
          forecast.provider,
          JSON.stringify(forecast),
          forecast.fetchedAt.getTime(),
        ],
      ),
      () => storageError('save forecast'),
    );

    return result.isErr() ? err(result.error) : ok(undefined);
  }

  async getHistorical(
    coordinates: Coordinates,
    from: Date,
    to: Date,
  ): Promise<Result<HistoricalDay[], AppError>> {
    const cell = geohash(coordinates);

    const rows = await fromPromise(
      this.database.getAll<HistoricalRow>(
        `SELECT date, temperature_max, temperature_min, precipitation
           FROM historical_days
          WHERE geohash = ? AND date BETWEEN ? AND ?
          ORDER BY date ASC`,
        [cell, toIsoDate(from), toIsoDate(to)],
      ),
      () => storageError('read historical weather'),
    );

    if (rows.isErr()) return err(rows.error);

    return ok(
      rows.value.map((row) => ({
        date: new Date(`${row.date}T00:00:00Z`),
        // Re-branded at the boundary: SQLite returns plain numbers, and the
        // constructors are the only sanctioned way to produce a unit value.
        temperatureMax: celsius(row.temperature_max),
        temperatureMin: celsius(row.temperature_min),
        precipitationSum: millimeters(row.precipitation),
      })),
    );
  }

  async saveHistorical(
    coordinates: Coordinates,
    days: readonly HistoricalDay[],
  ): Promise<Result<void, AppError>> {
    if (days.length === 0) return ok(undefined);

    const cell = geohash(coordinates);

    const result = await fromPromise(
      this.database.withTransaction(async () => {
        for (const day of days) {
          await this.database.run(
            `INSERT INTO historical_days
               (geohash, date, temperature_max, temperature_min, precipitation)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(geohash, date) DO NOTHING`,
            [
              cell,
              toIsoDate(day.date),
              day.temperatureMax,
              day.temperatureMin,
              day.precipitationSum,
            ],
          );
        }
      }),
      () => storageError('save historical weather'),
    );

    return result.isErr() ? err(result.error) : ok(undefined);
  }
}

/**
 * Stand-in for when SQLite is unavailable.
 *
 * Reads report "nothing cached", which is truthful, and writes silently
 * succeed. Unlike a saved location, a dropped cache entry costs a refetch
 * rather than losing something the user created — so failing loudly here would
 * be noise.
 */
export function createUnavailableWeatherStore(): LocalWeatherStore {
  return {
    getForecast: () => Promise.resolve(ok(undefined)),
    saveForecast: () => Promise.resolve(ok(undefined)),
    getHistorical: () => Promise.resolve(ok([])),
    saveHistorical: () => Promise.resolve(ok(undefined)),
  };
}

/** Fields serialised as ISO strings that must become `Date`s again. */
const DATE_KEYS = new Set([
  'observedAt',
  'fetchedAt',
  'time',
  'date',
  'sunrise',
  'sunset',
  'startsAt',
  'endsAt',
]);

/**
 * Revive a stored forecast, restoring the `Date`s that JSON flattened.
 *
 * Returns `undefined` on any failure — a malformed or older-version payload is
 * a cache miss, never a crash.
 */
function parseForecast(payload: string): Forecast | undefined {
  try {
    const raw: unknown = JSON.parse(payload, (key: string, value: unknown) => {
      if (typeof value !== 'string') return value;
      return DATE_KEYS.has(key) ? new Date(value) : value;
    });

    // A minimal shape check: enough to reject a payload from an incompatible
    // version without duplicating the whole schema here.
    const candidate = raw as Partial<Forecast>;
    if (candidate.current === undefined || candidate.hourly === undefined) {
      return undefined;
    }

    return candidate as Forecast;
  } catch {
    return undefined;
  }
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
