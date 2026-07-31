import * as SQLite from 'expo-sqlite';

import { DATABASE_NAME } from '@/core/config';
import {
  err,
  fromPromise,
  ok,
  storageError,
  type AppError,
  type Result,
} from '@/core/errors';
import type { Logger } from '@/core/logger';

import { runMigrations, type Migration, type MigrationTarget } from './migration-runner';

/**
 * SQLite — the durable, queryable tier (ADR-0004).
 *
 * Holds forecast snapshots, historical series, chart data, and the record the
 * home screen widgets read. Unlike MMKV it is asynchronous, so it must never be
 * on the path to the first frame; it refines content that MMKV already painted.
 *
 * Do NOT put settings here — they are needed synchronously on the first frame.
 */
export interface Database {
  /** Run a statement with no result. */
  exec(sql: string): Promise<void>;
  /** Fetch at most one row. */
  getFirst<T>(sql: string, params?: readonly SQLite.SQLiteBindValue[]): Promise<T | null>;
  /** Fetch all matching rows. */
  getAll<T>(sql: string, params?: readonly SQLite.SQLiteBindValue[]): Promise<T[]>;
  /** Run a parameterised write. */
  run(sql: string, params?: readonly SQLite.SQLiteBindValue[]): Promise<void>;
  /** Run `fn` atomically. */
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function toMigrationTarget(db: SQLite.SQLiteDatabase): MigrationTarget {
  return {
    // `user_version` is SQLite's built-in schema version counter, so no
    // bookkeeping table of our own is needed.
    getVersion: async () => {
      const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      return row?.user_version ?? 0;
    },
    setVersion: async (version) => {
      // PRAGMA does not accept bound parameters. `version` is a validated
      // integer from the migration registry, never user input.
      await db.execAsync(`PRAGMA user_version = ${version}`);
    },
    exec: (sql) => db.execAsync(sql),
    withTransaction: (fn) => runInTransaction(db, fn),
  };
}

/**
 * Adapt expo-sqlite's `withTransactionAsync`, which discards its callback's
 * return value, into a transaction that yields a result.
 *
 * The captured value is boxed in a tuple so "ran and returned undefined" stays
 * distinguishable from "never ran" without a non-null assertion.
 */
async function runInTransaction<T>(
  db: SQLite.SQLiteDatabase,
  fn: () => Promise<T>,
): Promise<T> {
  let captured: readonly [T] | undefined;

  await db.withTransactionAsync(async () => {
    captured = [await fn()];
  });

  if (captured === undefined) {
    throw new Error('Transaction callback did not run');
  }

  return captured[0];
}

/**
 * Open the database, apply pragmas, and run pending migrations.
 *
 * Migrations are PASSED IN rather than imported. SQLite has a single schema, so
 * its version history is one ordered list — but the table definitions belong to
 * the features that own them. Importing them here would make `core/` depend on
 * `features/`, inverting the dependency graph (ADR-0007). The composition root
 * assembles the list instead; that is what a composition root is for.
 *
 * @returns The database handle, or a `storage` {@link AppError} if opening or
 *   migrating failed. Callers decide whether to degrade to MMKV-only operation —
 *   a corrupt cache must not prevent the app from starting.
 */
export async function openDatabase(
  logger: Logger,
  migrations: readonly Migration[],
  name: string = DATABASE_NAME,
): Promise<Result<Database, AppError>> {
  const opened = await fromPromise(SQLite.openDatabaseAsync(name), (cause) => {
    logger.error('storage.database.openFailed', { cause });
    return storageError('open database');
  });

  // Re-wrapped rather than returned directly: `Err<T, E>` is not assignable
  // across different `T`, because `T` appears in `map`'s parameter position.
  if (opened.isErr()) return err(opened.error);

  const db = opened.value;

  // WAL allows a reader (a widget, a background task) concurrently with a
  // writer, which matters because the widget reads while the app may be
  // refreshing. Foreign keys are off by default in SQLite and must be enabled
  // per connection.
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const migrated = await runMigrations(toMigrationTarget(db), migrations, logger);
  if (migrated.isErr()) {
    await db.closeAsync();
    return err(migrated.error);
  }

  return ok(wrap(db));
}

function wrap(db: SQLite.SQLiteDatabase): Database {
  return {
    exec: (sql) => db.execAsync(sql),
    getFirst: <T>(sql: string, params: readonly SQLite.SQLiteBindValue[] = []) =>
      db.getFirstAsync<T>(sql, [...params]),
    getAll: <T>(sql: string, params: readonly SQLite.SQLiteBindValue[] = []) =>
      db.getAllAsync<T>(sql, [...params]),
    run: async (sql, params = []) => {
      await db.runAsync(sql, [...params]);
    },
    withTransaction: (fn) => runInTransaction(db, fn),
    close: () => db.closeAsync(),
  };
}
