import {
  err,
  fromPromise,
  ok,
  storageError,
  type AppError,
  type Result,
} from '@/core/errors';
import type { Database } from '@/core/storage';

import type { Place, SavedLocation } from '../../domain';

/**
 * Durable storage for saved locations and recent searches.
 *
 * SQLite, not MMKV: this is queryable, ordered, growing data, and the widget
 * will read from it in Phase 10 (ADR-0004).
 */

/** Row shape as stored. Kept private — it is a persistence detail, not an entity. */
interface SavedLocationRow {
  readonly id: string;
  readonly name: string;
  readonly admin1: string | null;
  readonly country: string;
  readonly country_code: string;
  readonly timezone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly elevation: number | null;
  readonly sort_order: number;
  readonly is_current_location: number;
  readonly saved_at: number;
}

/** Recent searches beyond this are dropped; older ones have no value. */
const MAX_RECENT_SEARCHES = 10;

function toEntity(row: SavedLocationRow): SavedLocation {
  return {
    id: row.id,
    coordinates: { latitude: row.latitude, longitude: row.longitude },
    name: row.name,
    // SQLite has no undefined — NULL is the absence marker, and it is converted
    // back at this boundary so entities never carry null (CLAUDE.md §11).
    admin1: row.admin1 ?? undefined,
    country: row.country,
    countryCode: row.country_code,
    timezone: row.timezone,
    elevation: row.elevation ?? undefined,
    sortOrder: row.sort_order,
    // SQLite has no boolean either.
    isCurrentLocation: row.is_current_location === 1,
    savedAt: new Date(row.saved_at),
  };
}

/**
 * The persistence surface the repository depends on.
 *
 * An interface rather than a concrete class, so the unavailable-database
 * fallback can implement it honestly instead of being cast into place — CLAUDE.md
 * §12 bans `as` used to satisfy the compiler.
 */
export interface LocalLocationStore {
  getSaved(): Promise<Result<SavedLocation[], AppError>>;
  save(
    place: Place,
    isCurrentLocation?: boolean,
  ): Promise<Result<SavedLocation, AppError>>;
  remove(id: string): Promise<Result<void, AppError>>;
  reorder(orderedIds: readonly string[]): Promise<Result<void, AppError>>;
  getRecentSearches(): Promise<Result<string[], AppError>>;
  recordSearch(query: string): Promise<Result<void, AppError>>;
  clearRecentSearches(): Promise<Result<void, AppError>>;
}

export class SqliteLocationStore implements LocalLocationStore {
  constructor(private readonly database: Database) {}

  async getSaved(): Promise<Result<SavedLocation[], AppError>> {
    const rows = await fromPromise(
      this.database.getAll<SavedLocationRow>(
        'SELECT * FROM locations ORDER BY sort_order ASC',
      ),
      () => storageError('read saved locations'),
    );

    return rows.isErr() ? err(rows.error) : ok(rows.value.map(toEntity));
  }

  async save(
    place: Place,
    isCurrentLocation = false,
  ): Promise<Result<SavedLocation, AppError>> {
    const id = crypto.randomUUID();
    const savedAt = Date.now();

    const written = await fromPromise(
      this.database.withTransaction(async () => {
        // Appended to the end of the user's list.
        const max = await this.database.getFirst<{ next: number }>(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM locations',
        );
        const sortOrder = max?.next ?? 0;

        await this.database.run(
          `INSERT INTO locations
             (id, name, admin1, country, country_code, timezone,
              latitude, longitude, elevation, sort_order, is_current_location, saved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            place.name,
            place.admin1 ?? null,
            place.country,
            place.countryCode,
            place.timezone,
            place.coordinates.latitude,
            place.coordinates.longitude,
            place.elevation ?? null,
            sortOrder,
            isCurrentLocation ? 1 : 0,
            savedAt,
          ],
        );

        return sortOrder;
      }),
      () => storageError('save location'),
    );

    if (written.isErr()) return err(written.error);

    return ok({
      ...place,
      id,
      sortOrder: written.value,
      isCurrentLocation,
      savedAt: new Date(savedAt),
    });
  }

  async remove(id: string): Promise<Result<void, AppError>> {
    const removed = await fromPromise(
      this.database.run('DELETE FROM locations WHERE id = ?', [id]),
      () => storageError('remove location'),
    );

    return removed.isErr() ? err(removed.error) : ok(undefined);
  }

  /**
   * Persist a new order.
   *
   * One transaction, so an interrupted reorder cannot leave the list with
   * duplicate or missing positions.
   */
  async reorder(orderedIds: readonly string[]): Promise<Result<void, AppError>> {
    const result = await fromPromise(
      this.database.withTransaction(async () => {
        for (const [index, id] of orderedIds.entries()) {
          await this.database.run('UPDATE locations SET sort_order = ? WHERE id = ?', [
            index,
            id,
          ]);
        }
      }),
      () => storageError('reorder locations'),
    );

    return result.isErr() ? err(result.error) : ok(undefined);
  }

  async getRecentSearches(): Promise<Result<string[], AppError>> {
    const rows = await fromPromise(
      this.database.getAll<{ query: string }>(
        'SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT ?',
        [MAX_RECENT_SEARCHES],
      ),
      () => storageError('read recent searches'),
    );

    return rows.isErr() ? err(rows.error) : ok(rows.value.map((row) => row.query));
  }

  /**
   * Record a search.
   *
   * Upsert on the query text, so searching the same city twice moves it to the
   * top rather than creating a duplicate entry.
   */
  async recordSearch(query: string): Promise<Result<void, AppError>> {
    const result = await fromPromise(
      this.database.withTransaction(async () => {
        await this.database.run(
          `INSERT INTO recent_searches (query, searched_at) VALUES (?, ?)
             ON CONFLICT(query) DO UPDATE SET searched_at = excluded.searched_at`,
          [query, Date.now()],
        );

        // Trim, so the table cannot grow without bound.
        await this.database.run(
          `DELETE FROM recent_searches
            WHERE query NOT IN (
              SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT ?
            )`,
          [MAX_RECENT_SEARCHES],
        );
      }),
      () => storageError('record search'),
    );

    return result.isErr() ? err(result.error) : ok(undefined);
  }

  async clearRecentSearches(): Promise<Result<void, AppError>> {
    const result = await fromPromise(
      this.database.exec('DELETE FROM recent_searches'),
      () => storageError('clear recent searches'),
    );

    return result.isErr() ? err(result.error) : ok(undefined);
  }
}
