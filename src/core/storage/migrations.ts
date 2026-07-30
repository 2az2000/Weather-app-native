import type { Migration } from './migration-runner';

/**
 * The migration registry — the ordered, append-only history of this database.
 *
 * Rules:
 * 1. **Append only.** Never edit or renumber a migration that has shipped; a
 *    device already at that version will not re-run it, so the change would
 *    apply to new installs only and silently fork the schema.
 * 2. **One concern per migration**, so a failure is easy to locate.
 * 3. **Forward only.** There is no `down()`: weather data is derived and
 *    disposable, so recovery is "drop and refetch", which is simpler and more
 *    reliable than maintaining reversibility for every change.
 *
 * Deliberately EMPTY at Phase 1. The tables belong to the features that own
 * them, and their shape depends on entity and canonical-unit decisions made in
 * Phase 4 — writing them now would encode guesses into persisted data
 * (ROADMAP Phase 4). Phase 1 delivers the mechanism; phases 3, 4, and 10 add
 * `001_locations`, `002_forecast_snapshots`, and the widget projection.
 */
export const MIGRATIONS: readonly Migration[] = [];
