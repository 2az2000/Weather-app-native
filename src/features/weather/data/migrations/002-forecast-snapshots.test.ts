import { noopLogger } from '@/core/logger';
import { createFakeMigrationTarget, runMigrations } from '@/core/storage';

import { forecastSnapshotsMigration } from './002-forecast-snapshots';

describe('forecast snapshots migration', () => {
  const executedSql = async (fromVersion = 0): Promise<string> => {
    const target = createFakeMigrationTarget(fromVersion);
    await runMigrations(target, [forecastSnapshotsMigration], noopLogger);
    return target.executed.join('\n');
  };

  it('is version 2, following the locations migration', () => {
    expect(forecastSnapshotsMigration.version).toBe(2);
  });

  it('applies on top of version 1', async () => {
    const target = createFakeMigrationTarget(1);

    const result = await runMigrations(target, [forecastSnapshotsMigration], noopLogger);

    expect(result.isOk()).toBe(true);
    await expect(target.getVersion()).resolves.toBe(2);
  });

  it('does not re-apply on a database already at version 2', async () => {
    const target = createFakeMigrationTarget(2);

    await runMigrations(target, [forecastSnapshotsMigration], noopLogger);

    expect(target.executed).toEqual([]);
  });

  describe('schema', () => {
    it('creates both tables', async () => {
      const sql = await executedSql();

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS forecast_snapshots');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS historical_days');
    });

    it('keys a snapshot by cell AND kind, so one cell can hold several types', async () => {
      expect(await executedSql()).toContain('PRIMARY KEY (geohash, kind)');
    });

    it('indexes fetched_at, which staleness sweeps scan by', async () => {
      expect(await executedSql()).toContain('idx_forecast_snapshots_fetched_at');
    });

    it('gives historical days NO staleness column — the past does not go stale', async () => {
      const sql = await executedSql();
      const historicalTable = sql.slice(sql.indexOf('historical_days'));

      expect(historicalTable).not.toContain('fetched_at');
    });

    it('is idempotent, so a partial upgrade can be re-run safely', async () => {
      const sql = await executedSql();

      for (const statement of sql.split(';').filter((part) => part.includes('CREATE'))) {
        expect(statement).toContain('IF NOT EXISTS');
      }
    });
  });
});
