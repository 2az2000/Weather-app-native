import * as SQLite from 'expo-sqlite';

import { noopLogger } from '@/core/logger';

import { openDatabase } from './database';

/**
 * expo-sqlite is a native binding with no injectable seam at the open() call, so
 * the module is doubled here. What is being tested is this file's own logic: the
 * pragmas it applies, that migrations run, that failures become `AppError`
 * values instead of throws, and that the transaction adapter returns a result.
 *
 * The migration ORDERING and ATOMICITY logic — where the real risk lives — is
 * tested separately against an in-memory fake in migration-runner.test.ts.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.MockedFunction<
  typeof SQLite.openDatabaseAsync
>;

interface FakeDb {
  execAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  runAsync: jest.Mock;
  withTransactionAsync: jest.Mock;
  closeAsync: jest.Mock;
}

function fakeDb(overrides: Partial<FakeDb> = {}): FakeDb {
  return {
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => ({ user_version: 0 })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => undefined),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
    closeAsync: jest.fn(async () => undefined),
    ...overrides,
  };
}

function useDb(db: FakeDb): void {
  openDatabaseAsync.mockResolvedValue(db as unknown as SQLite.SQLiteDatabase);
}

describe('openDatabase', () => {
  it('opens the database under the configured name', async () => {
    useDb(fakeDb());

    await openDatabase(noopLogger, 'test.db');

    expect(openDatabaseAsync).toHaveBeenCalledWith('test.db');
  });

  describe('pragmas', () => {
    it('enables WAL so a widget can read while the app writes', async () => {
      const db = fakeDb();
      useDb(db);

      await openDatabase(noopLogger, 'test.db');

      expect(db.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
    });

    it('enables foreign keys, which SQLite leaves off per connection by default', async () => {
      const db = fakeDb();
      useDb(db);

      await openDatabase(noopLogger, 'test.db');

      expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    });
  });

  describe('failure handling', () => {
    it('returns a storage AppError rather than throwing when opening fails', async () => {
      openDatabaseAsync.mockRejectedValue(new Error('disk is full'));

      const result = await openDatabase(noopLogger, 'test.db');

      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error).toMatchObject({
        kind: 'storage',
        retryable: false,
      });
    });

    it('logs the open failure so a corrupt cache is diagnosable', async () => {
      openDatabaseAsync.mockRejectedValue(new Error('disk is full'));
      const error = jest.fn();

      await openDatabase({ ...noopLogger, error }, 'test.db');

      expect(error).toHaveBeenCalledWith(
        'storage.database.openFailed',
        expect.anything(),
      );
    });

    it('closes the handle when migration fails, rather than leaking it', async () => {
      const db = fakeDb({
        // A migration read that throws forces the runner into its error path.
        getFirstAsync: jest.fn(async () => {
          throw new Error('corrupt header');
        }),
      });
      useDb(db);

      const result = await openDatabase(noopLogger, 'test.db');

      expect(result.isErr()).toBe(true);
      expect(db.closeAsync).toHaveBeenCalled();
    });
  });

  describe('the returned handle', () => {
    it('delegates reads and writes to the underlying database', async () => {
      const db = fakeDb();
      useDb(db);

      const result = await openDatabase(noopLogger, 'test.db');
      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      const handle = result.value;
      await handle.exec('SELECT 1');
      await handle.getFirst('SELECT * FROM t WHERE id = ?', [1]);
      await handle.getAll('SELECT * FROM t');
      await handle.run('INSERT INTO t VALUES (?)', ['a']);
      await handle.close();

      expect(db.execAsync).toHaveBeenCalledWith('SELECT 1');
      expect(db.getFirstAsync).toHaveBeenCalledWith('SELECT * FROM t WHERE id = ?', [1]);
      expect(db.getAllAsync).toHaveBeenCalledWith('SELECT * FROM t', []);
      expect(db.runAsync).toHaveBeenCalledWith('INSERT INTO t VALUES (?)', ['a']);
      expect(db.closeAsync).toHaveBeenCalled();
    });

    it('returns the transaction callback’s value, which expo-sqlite discards', async () => {
      useDb(fakeDb());

      const result = await openDatabase(noopLogger, 'test.db');
      if (!result.isOk()) throw new Error('expected an open database');

      await expect(result.value.withTransaction(async () => 'committed')).resolves.toBe(
        'committed',
      );
    });

    it('preserves an undefined return without confusing it for "did not run"', async () => {
      useDb(fakeDb());

      const result = await openDatabase(noopLogger, 'test.db');
      if (!result.isOk()) throw new Error('expected an open database');

      await expect(
        result.value.withTransaction(async () => undefined),
      ).resolves.toBeUndefined();
    });

    it('throws if the transaction body never ran, rather than returning a bogus value', async () => {
      useDb(
        fakeDb({
          // Simulates a driver that swallows the callback entirely.
          withTransactionAsync: jest.fn(async () => undefined),
        }),
      );

      const result = await openDatabase(noopLogger, 'test.db');
      if (!result.isOk()) throw new Error('expected an open database');

      await expect(result.value.withTransaction(async () => 'x')).rejects.toThrow(
        /did not run/,
      );
    });
  });
});
