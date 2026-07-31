import type { Migration } from '@/core/storage';

/**
 * Saved locations and recent searches.
 *
 * The first real migration in the project. Phase 1 shipped the runner with an
 * empty registry deliberately, because table shapes depend on entity decisions
 * that had not been made yet — this is that decision, now made.
 *
 * Append-only from here: never edit or renumber this once it has shipped. A
 * device already at version 1 will not re-run it, so an edit would apply to new
 * installs only and silently fork the schema.
 */
export const locationsMigration: Migration = {
  version: 1,
  name: 'locations',

  up: async (exec) => {
    await exec(`
      CREATE TABLE IF NOT EXISTS locations (
        id                  TEXT    PRIMARY KEY NOT NULL,
        name                TEXT    NOT NULL,
        admin1              TEXT,
        country             TEXT    NOT NULL,
        country_code        TEXT    NOT NULL,
        timezone            TEXT    NOT NULL,
        latitude            REAL    NOT NULL,
        longitude           REAL    NOT NULL,
        elevation           REAL,
        sort_order          INTEGER NOT NULL,
        is_current_location INTEGER NOT NULL DEFAULT 0,
        saved_at            INTEGER NOT NULL
      );
    `);

    // The list is always read in user order, so the index earns its keep.
    await exec(`
      CREATE INDEX IF NOT EXISTS idx_locations_sort_order
        ON locations (sort_order);
    `);

    // At most ONE GPS-backed entry can exist. Enforced by the schema rather
    // than by application code, because a second one would produce a duplicate
    // in every list and be very hard to trace back to its cause.
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_single_current
        ON locations (is_current_location)
        WHERE is_current_location = 1;
    `);

    await exec(`
      CREATE TABLE IF NOT EXISTS recent_searches (
        query       TEXT    PRIMARY KEY NOT NULL,
        searched_at INTEGER NOT NULL
      );
    `);

    await exec(`
      CREATE INDEX IF NOT EXISTS idx_recent_searches_searched_at
        ON recent_searches (searched_at DESC);
    `);
  },
};
