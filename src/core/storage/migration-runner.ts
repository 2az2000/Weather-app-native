import { err, ok, storageError, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';

/**
 * Versioned schema migrations for SQLite.
 *
 * Migrations exist from day one, before there is any schema to migrate
 * (ADR-0004). Retrofitting a migration system onto data that has already shipped
 * to devices means writing a recovery path for every version in the wild — the
 * cost of adding it now is a fraction of that.
 */

/** SQL execution surface a migration is given. */
export type ExecSql = (sql: string) => Promise<void>;

export interface Migration {
  /** Strictly increasing, starting at 1. Never renumber a shipped migration. */
  readonly version: number;
  /** Human-readable summary, used in logs. */
  readonly name: string;
  up(exec: ExecSql): Promise<void>;
}

/**
 * The database as the runner needs to see it.
 *
 * Version tracking is separated from SQL execution so the runner can be unit
 * tested against an in-memory fake, with no native SQLite binding involved
 * (CLAUDE.md §26 — inject a fake, do not mock the module).
 */
export interface MigrationTarget {
  /** Current schema version. `0` means a fresh database. */
  getVersion(): Promise<number>;
  setVersion(version: number): Promise<void>;
  exec: ExecSql;
  /** Run `fn` atomically, rolling back on throw. */
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Reject a malformed migration list before touching the database.
 *
 * A duplicate or non-sequential version is a programming error that would
 * corrupt schema state on some devices and not others — far better to fail
 * immediately and loudly.
 */
function validate(migrations: readonly Migration[]): string | undefined {
  const seen = new Set<number>();

  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      return `migration "${migration.name}" has invalid version ${migration.version}; versions start at 1`;
    }
    if (seen.has(migration.version)) {
      return `duplicate migration version ${migration.version}`;
    }
    seen.add(migration.version);
  }

  return undefined;
}

/**
 * Apply every migration newer than the database's current version, in order.
 *
 * Each migration runs in its own transaction together with its version bump, so
 * an interrupted upgrade leaves the database at the last fully-applied version
 * rather than in a half-migrated state.
 *
 * @returns The resulting schema version.
 */
export async function runMigrations(
  target: MigrationTarget,
  migrations: readonly Migration[],
  logger: Logger,
): Promise<Result<number, AppError>> {
  const invalid = validate(migrations);
  if (invalid !== undefined) {
    logger.error('storage.migration.invalid', { reason: invalid });
    return err(storageError(`invalid migration list: ${invalid}`));
  }

  const ordered = [...migrations].sort((a, b) => a.version - b.version);

  try {
    const currentVersion = await target.getVersion();
    const pending = ordered.filter((m) => m.version > currentVersion);

    if (pending.length === 0) {
      logger.debug('storage.migration.upToDate', { version: currentVersion });
      return ok(currentVersion);
    }

    logger.info('storage.migration.start', {
      from: currentVersion,
      to: pending[pending.length - 1]?.version,
      count: pending.length,
    });

    let version = currentVersion;

    for (const migration of pending) {
      await target.withTransaction(async () => {
        await migration.up(target.exec);
        await target.setVersion(migration.version);
      });

      version = migration.version;
      logger.info('storage.migration.applied', {
        version: migration.version,
        name: migration.name,
      });
    }

    return ok(version);
  } catch (cause) {
    logger.error('storage.migration.failed', { cause });
    return err(storageError('migration failed'));
  }
}

/**
 * In-memory {@link MigrationTarget} for tests.
 *
 * Records executed SQL and simulates transaction rollback of the version
 * counter, which is what the runner's atomicity guarantee depends on.
 */
export function createFakeMigrationTarget(initialVersion = 0): MigrationTarget & {
  readonly executed: readonly string[];
} {
  let version = initialVersion;
  const executed: string[] = [];

  return {
    executed,
    getVersion: async () => version,
    setVersion: async (next) => {
      version = next;
    },
    exec: async (sql) => {
      executed.push(sql);
    },
    withTransaction: async (fn) => {
      const snapshot = version;
      try {
        return await fn();
      } catch (cause) {
        version = snapshot;
        throw cause;
      }
    },
  };
}
