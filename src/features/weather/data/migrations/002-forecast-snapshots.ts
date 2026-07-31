import type { Migration } from '@/core/storage';

/**
 * Forecast snapshots and historical observations.
 *
 * Append-only: never edit or renumber this once it has shipped.
 *
 * ## Why the payload is a JSON blob rather than normalised columns
 *
 * A forecast is read WHOLE and written WHOLE — no query ever asks for "hour 7
 * of yesterday's response". Normalising into hourly and daily tables would add
 * hundreds of row writes per refresh, plus joins, for a shape the app never
 * queries that way.
 *
 * The queryable parts are the ones actually queried: the cell, the kind, and
 * the timestamp staleness is decided from. Those are real columns, and indexed.
 */
export const forecastSnapshotsMigration: Migration = {
  version: 2,
  name: 'forecast_snapshots',

  up: async (exec) => {
    await exec(`
      CREATE TABLE IF NOT EXISTS forecast_snapshots (
        geohash    TEXT    NOT NULL,
        kind       TEXT    NOT NULL,
        provider   TEXT    NOT NULL,
        payload    TEXT    NOT NULL,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (geohash, kind)
      );
    `);

    // Staleness sweeps scan by age across all cells.
    await exec(`
      CREATE INDEX IF NOT EXISTS idx_forecast_snapshots_fetched_at
        ON forecast_snapshots (fetched_at);
    `);

    // Historical observations are immutable, so they get their own table with
    // no staleness column — the past does not go stale (CLAUDE.md §25).
    await exec(`
      CREATE TABLE IF NOT EXISTS historical_days (
        geohash         TEXT    NOT NULL,
        date            TEXT    NOT NULL,
        temperature_max REAL    NOT NULL,
        temperature_min REAL    NOT NULL,
        precipitation   REAL    NOT NULL,
        PRIMARY KEY (geohash, date)
      );
    `);

    await exec(`
      CREATE INDEX IF NOT EXISTS idx_historical_days_lookup
        ON historical_days (geohash, date);
    `);
  },
};
