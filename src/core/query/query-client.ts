import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import { CACHE_VERSION, GC_TIME, RETRY, STALE_TIME } from '@/core/config';
import type { AppError } from '@/core/errors';
import type { KeyValueStorage } from '@/core/storage';

/**
 * TanStack Query owns all SERVER state (ADR-0005). Nothing remote is ever copied
 * into Zustand, because a second copy silently goes stale.
 *
 * The persister writes to MMKV — SYNCHRONOUS storage — which is what allows the
 * cache to hydrate on the first frame and content to appear before any network
 * call resolves (ADR-0004, CLAUDE.md §21).
 */

const PERSIST_KEY = 'weather.query-cache';

/**
 * Matches an ISO-8601 instant with a mandatory time component — the exact
 * shape `Date#toJSON` (and therefore `JSON.stringify`) always produces, e.g.
 * `2026-07-31T08:30:00.000Z`. Deliberately NOT matching a bare date
 * (`2026-07-31`) or anything without a `T` and a `Z`/offset: those are
 * ordinary strings this app also persists (locale tags, provider names,
 * condition codes) and must not be rewritten into `Date` instances.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Revive ISO instant strings back into `Date` objects on the way out of MMKV.
 *
 * `JSON.stringify` turns every `Date` in the cache — `Forecast.fetchedAt`,
 * `HourlyPoint.time`, `DailyPoint.sunrise`/`sunset`, `SavedLocation.savedAt`,
 * and more — into a plain string, and plain `JSON.parse` has no way to turn it
 * back. Found on a real device: a cache written on one launch and restored on
 * the next left every one of those fields a STRING, so the first component
 * to call a `Date` method on one — `DataAgeBanner`'s `date.getTime()` — threw
 * `TypeError: undefined is not a function`. No amount of hardening
 * `formatRelativeTime` itself could have caught this: the value reaching it
 * was never a `Date` in the first place.
 */
function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_INSTANT.test(value) ? new Date(value) : value;
}

/**
 * Retry policy, driven by `AppError.retryable`.
 *
 * Reading the flag rather than inspecting the error shape means adding a new
 * error kind cannot silently change retry behaviour (CLAUDE.md §22).
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= RETRY.maxAttempts) return false;

  // Queries resolve to `Result`, so a thrown value here is unexpected — retry
  // conservatively rather than hammering an unknown failure.
  const retryable = (error as Partial<AppError> | null)?.retryable;
  return retryable === true;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Deliberately conservative defaults. Every query is expected to set its
        // own tier from STALE_TIME per CLAUDE.md §25 — these values exist so a
        // forgotten `staleTime` is merely suboptimal, not a quota problem.
        staleTime: STALE_TIME.current,
        gcTime: GC_TIME.current,
        retry: shouldRetry,
        // The app is offline-first: a refetch on every focus would waste quota
        // and battery while the cache is still fresh.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Persist the query cache to MMKV.
 *
 * @param storage - Synchronous KV storage. MMKV in production, in-memory in
 *   tests.
 * @param throttleTime - Minimum gap between writes. The default coalesces the
 *   burst of cache updates a screen produces into one write; tests pass `0` to
 *   observe the write immediately.
 */
export function createQueryPersister(
  storage: KeyValueStorage,
  throttleTime = 1000,
): Persister {
  return createSyncStoragePersister({
    key: PERSIST_KEY,
    throttleTime,
    storage: {
      getItem: (key) => storage.getString(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    // The default deserializer is a plain `JSON.parse` with no reviver, which
    // is what let every persisted `Date` come back as a string. `serialize`
    // is left at its default (plain `JSON.stringify`) — only the READ side
    // needed to change.
    deserialize: (cachedString) => JSON.parse(cachedString, reviveDates),
  });
}

/**
 * Cache buster for the persisted cache.
 *
 * When {@link CACHE_VERSION} is bumped, persisted data written by an older app
 * version is DISCARDED rather than rehydrated into a mismatched shape — which
 * would otherwise crash a screen on upgrade (CLAUDE.md §25).
 */
export const PERSIST_BUSTER = `v${CACHE_VERSION}`;

/** How long persisted cache entries remain eligible for hydration. */
export const PERSIST_MAX_AGE_MS = GC_TIME.daily;
