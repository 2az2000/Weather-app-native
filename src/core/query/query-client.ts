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
