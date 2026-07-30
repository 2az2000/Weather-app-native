import { noopLogger } from '@/core/logger';

import {
  createFakeMigrationTarget,
  runMigrations,
  type ExecSql,
  type Migration,
} from './migration-runner';

/**
 * ROADMAP Phase 1 DoD: "SQLite migrations run forward from empty AND from a
 * previous version."
 *
 * Tested against an in-memory fake rather than a real SQLite binding — the
 * runner's ORDERING and ATOMICITY logic is what can be wrong, and injecting a
 * fake tests exactly that without a native dependency (CLAUDE.md §26).
 */

function migration(version: number, name: string, sql = `-- ${name}`): Migration {
  return {
    version,
    name,
    up: async (exec: ExecSql) => {
      await exec(sql);
    },
  };
}

describe('runMigrations', () => {
  describe('from an empty database', () => {
    it('applies every migration in order and reports the final version', async () => {
      const target = createFakeMigrationTarget(0);
      const migrations = [
        migration(1, 'locations', 'CREATE TABLE locations'),
        migration(2, 'forecasts', 'CREATE TABLE forecasts'),
        migration(3, 'widget', 'CREATE TABLE widget'),
      ];

      const result = await runMigrations(target, migrations, noopLogger);

      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr(-1)).toBe(3);
      expect(target.executed).toEqual([
        'CREATE TABLE locations',
        'CREATE TABLE forecasts',
        'CREATE TABLE widget',
      ]);
      await expect(target.getVersion()).resolves.toBe(3);
    });

    it('applies migrations in version order even when the list is unsorted', async () => {
      const target = createFakeMigrationTarget(0);

      await runMigrations(
        target,
        [
          migration(3, 'third', 'THIRD'),
          migration(1, 'first', 'FIRST'),
          migration(2, 'second', 'SECOND'),
        ],
        noopLogger,
      );

      expect(target.executed).toEqual(['FIRST', 'SECOND', 'THIRD']);
    });
  });

  describe('from a previous version', () => {
    it('applies only migrations newer than the current version', async () => {
      const target = createFakeMigrationTarget(2);

      const result = await runMigrations(
        target,
        [
          migration(1, 'locations', 'ALREADY_APPLIED_1'),
          migration(2, 'forecasts', 'ALREADY_APPLIED_2'),
          migration(3, 'widget', 'NEW_3'),
        ],
        noopLogger,
      );

      expect(target.executed).toEqual(['NEW_3']);
      expect(result.unwrapOr(-1)).toBe(3);
    });

    it('is a no-op when the database is already current', async () => {
      const target = createFakeMigrationTarget(2);

      const result = await runMigrations(
        target,
        [migration(1, 'a'), migration(2, 'b')],
        noopLogger,
      );

      expect(target.executed).toEqual([]);
      expect(result.unwrapOr(-1)).toBe(2);
    });

    it('is a no-op for an empty registry, which is Phase 1’s actual state', async () => {
      const target = createFakeMigrationTarget(0);

      const result = await runMigrations(target, [], noopLogger);

      expect(result.unwrapOr(-1)).toBe(0);
      expect(target.executed).toEqual([]);
    });
  });

  describe('atomicity', () => {
    it('leaves the version at the last fully applied migration when one fails', async () => {
      const target = createFakeMigrationTarget(0);
      const failing: Migration = {
        version: 2,
        name: 'broken',
        up: async () => {
          throw new Error('constraint violation');
        },
      };

      const result = await runMigrations(
        target,
        [migration(1, 'good', 'GOOD'), failing, migration(3, 'never', 'NEVER')],
        noopLogger,
      );

      expect(result.isErr()).toBe(true);
      // Migration 1 committed; 2 rolled back; 3 never ran.
      await expect(target.getVersion()).resolves.toBe(1);
      expect(target.executed).toEqual(['GOOD']);
    });

    it('returns a storage AppError rather than throwing', async () => {
      const target = createFakeMigrationTarget(0);
      const failing: Migration = {
        version: 1,
        name: 'broken',
        up: async () => {
          throw new Error('disk full');
        },
      };

      const result = await runMigrations(target, [failing], noopLogger);

      expect(result.isErr() && result.error).toMatchObject({
        kind: 'storage',
        retryable: false,
      });
    });
  });

  describe('registry validation', () => {
    it('rejects duplicate versions before touching the database', async () => {
      const target = createFakeMigrationTarget(0);

      const result = await runMigrations(
        target,
        [migration(1, 'a'), migration(1, 'b')],
        noopLogger,
      );

      expect(result.isErr()).toBe(true);
      expect(target.executed).toEqual([]);
    });

    it.each([0, -1, 1.5])('rejects the invalid version %s', async (version) => {
      const target = createFakeMigrationTarget(0);

      const result = await runMigrations(target, [migration(version, 'bad')], noopLogger);

      expect(result.isErr()).toBe(true);
      expect(target.executed).toEqual([]);
    });
  });
});
