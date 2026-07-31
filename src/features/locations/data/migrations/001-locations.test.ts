import { createFakeMigrationTarget, runMigrations } from '@/core/storage';
import { noopLogger } from '@/core/logger';

import { locationsMigration } from './001-locations';

describe('locations migration', () => {
  it('is version 1, the first schema this project ships', () => {
    expect(locationsMigration.version).toBe(1);
  });

  it('applies to a fresh database', async () => {
    const target = createFakeMigrationTarget(0);

    const result = await runMigrations(target, [locationsMigration], noopLogger);

    expect(result.isOk()).toBe(true);
    await expect(target.getVersion()).resolves.toBe(1);
  });

  describe('schema', () => {
    const executedSql = async (): Promise<string> => {
      const target = createFakeMigrationTarget(0);
      await runMigrations(target, [locationsMigration], noopLogger);
      return target.executed.join('\n');
    };

    it('creates both tables', async () => {
      const sql = await executedSql();

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS locations');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS recent_searches');
    });

    it('indexes sort order, since the list is always read in user order', async () => {
      expect(await executedSql()).toContain('idx_locations_sort_order');
    });

    it('enforces at most one current-location row IN THE SCHEMA', async () => {
      // A second GPS row would produce a duplicate in every list and be very
      // hard to trace back to its cause, so the database refuses it rather
      // than relying on application code.
      const sql = await executedSql();

      expect(sql).toContain('idx_locations_single_current');
      expect(sql).toContain('WHERE is_current_location = 1');
    });

    it('is idempotent, so a partial upgrade can be re-run safely', async () => {
      const sql = await executedSql();

      for (const statement of sql.split(';').filter((s) => s.trim().length > 0)) {
        if (statement.includes('CREATE')) {
          expect(statement).toContain('IF NOT EXISTS');
        }
      }
    });
  });
});
