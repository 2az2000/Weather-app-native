/**
 * Application-wide constants.
 *
 * Cache staleness tiers are the authoritative encoding of the table in
 * CLAUDE.md §25. Different data decays at different rates — a single global
 * `staleTime` either wastes quota or shows stale data — so every query reads
 * its tier from here rather than choosing a number at the call site.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long fetched data is considered fresh. Mirrors CLAUDE.md §25. */
export const STALE_TIME = {
  /** Changes fastest and is the most time-sensitive. */
  minutely: 5 * MINUTE,
  current: 10 * MINUTE,
  hourly: 1 * HOUR,
  airQuality: 1 * HOUR,
  daily: 6 * HOUR,
  /** Safety-critical — freshness matters more here than anywhere else. */
  alerts: 5 * MINUTE,
  /** The past does not change. */
  historical: Number.POSITIVE_INFINITY,
  /** City coordinates are effectively static. */
  geocoding: 30 * DAY,
} as const;

/** How long unused data is retained in the cache before garbage collection. */
export const GC_TIME = {
  minutely: 1 * HOUR,
  current: 6 * HOUR,
  hourly: 24 * HOUR,
  airQuality: 24 * HOUR,
  daily: 48 * HOUR,
  alerts: 1 * HOUR,
  historical: Number.POSITIVE_INFINITY,
  geocoding: 90 * DAY,
} as const;

/** Per-request timeouts. No request is issued without one (CLAUDE.md §9). */
export const REQUEST_TIMEOUT_MS = {
  default: 10 * SECOND,
  /** Tiles are larger and a slow tile is better than a missing one. */
  tiles: 20 * SECOND,
} as const;

/** Retry policy. Only `retryable` errors are retried at all (CLAUDE.md §22). */
export const RETRY = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8 * SECOND,
} as const;

/**
 * Cooldown applied to a provider after it returns 429 or 5xx.
 *
 * Open-Meteo offers no uptime SLA on the free tier (ADR-0002), so the circuit
 * breaker fails over to the fallback provider rather than retrying into a
 * failing upstream.
 */
export const PROVIDER_COOLDOWN_MS = 5 * MINUTE;

/**
 * Persisted cache schema version.
 *
 * Bumping this DISCARDS incompatible persisted data on upgrade rather than
 * crashing on a shape mismatch (CLAUDE.md §25). Bump it whenever an entity
 * shape that reaches the cache changes.
 */
export const CACHE_VERSION = 1;

/** SQLite schema version. Owned by the migration runner in `core/storage`. */
export const DATABASE_NAME = 'weather.db';

/**
 * Precision, in decimal places, that coordinates are rounded to before being
 * written to a log. ~11 km at the equator — enough to be useless for locating a
 * person, enough to debug a caching problem (CLAUDE.md §23).
 */
export const LOG_COORDINATE_PRECISION = 1;
