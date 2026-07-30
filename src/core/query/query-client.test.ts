import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';

import { STALE_TIME } from '@/core/config';
import { createInMemoryKeyValueStorage } from '@/core/storage';

import {
  createQueryClient,
  createQueryPersister,
  PERSIST_BUSTER,
  PERSIST_MAX_AGE_MS,
} from './query-client';

describe('createQueryClient', () => {
  it('sets a deliberate default staleTime rather than leaving it at zero', () => {
    const defaults = createQueryClient().getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(STALE_TIME.current);
  });

  it('does not refetch on focus, which would waste quota while the cache is fresh', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(
      false,
    );
  });

  it('refetches on reconnect, so regaining connectivity refreshes stale content', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnReconnect).toBe(
      true,
    );
  });

  describe('retry policy', () => {
    /**
     * TanStack types the predicate's second argument as `Error`, but at runtime
     * it receives whatever the query rejected with — for this app, an
     * `AppError`. The cast reflects that reality; it is not silencing a genuine
     * type problem.
     */
    const retry = (failureCount: number, error: unknown): boolean => {
      const configured = createQueryClient().getDefaultOptions().queries?.retry;
      if (typeof configured !== 'function')
        throw new Error('retry should be a predicate');
      return configured(failureCount, error as Error) === true;
    };

    it('retries an error flagged retryable', () => {
      expect(retry(0, { kind: 'network', retryable: true })).toBe(true);
    });

    it('does not retry an error flagged non-retryable', () => {
      expect(retry(0, { kind: 'validation', retryable: false })).toBe(false);
    });

    it('stops after the configured attempt budget even for retryable errors', () => {
      expect(retry(3, { kind: 'network', retryable: true })).toBe(false);
    });

    it('does not retry an unrecognised thrown value', () => {
      expect(retry(0, new Error('unexpected'))).toBe(false);
      expect(retry(0, null)).toBe(false);
    });
  });
});

/**
 * ROADMAP Phase 1 DoD: "Query cache survives an app restart via MMKV."
 *
 * Uses the one-shot `save`/`restore` primitives rather than
 * `persistQueryClient`, which additionally installs subscriptions and throttle
 * timers — those keep the event loop alive and make the test both slow and
 * non-deterministic. Save-then-restore-into-a-new-client is exactly what a cold
 * start does.
 */
describe('query cache persistence', () => {
  const queryKey = ['weather', 'current', 'tehran'];

  /**
   * The sync persister throttles writes, so `persistClient` schedules the write
   * rather than performing it. Yield a macrotask so it lands before asserting.
   */
  const flushWrites = (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, 5);
    });

  it('restores cached data into a fresh client from the same storage', async () => {
    const storage = createInMemoryKeyValueStorage();
    const persister = createQueryPersister(storage, 0);
    const cached = { temperature: 21 };

    const before = createQueryClient();
    before.setQueryData(queryKey, cached);
    await persistQueryClientSave({
      queryClient: before,
      persister,
      buster: PERSIST_BUSTER,
    });
    await flushWrites();

    // Simulate a cold start: brand-new client, same storage.
    const after = createQueryClient();
    await persistQueryClientRestore({
      queryClient: after,
      persister,
      maxAge: PERSIST_MAX_AGE_MS,
      buster: PERSIST_BUSTER,
    });

    expect(after.getQueryData(queryKey)).toEqual(cached);
  });

  it('discards persisted data when the cache version changes', async () => {
    const storage = createInMemoryKeyValueStorage();
    const persister = createQueryPersister(storage, 0);

    const before = createQueryClient();
    before.setQueryData(queryKey, { temperature: 21 });
    await persistQueryClientSave({
      queryClient: before,
      persister,
      buster: PERSIST_BUSTER,
    });
    await flushWrites();

    // A bumped CACHE_VERSION must DISCARD incompatible data rather than
    // rehydrate it into a mismatched shape and crash a screen (CLAUDE.md §25).
    const after = createQueryClient();
    await persistQueryClientRestore({
      queryClient: after,
      persister,
      maxAge: PERSIST_MAX_AGE_MS,
      buster: 'v999',
    });

    expect(after.getQueryData(queryKey)).toBeUndefined();
  });

  it('discards persisted data older than maxAge', async () => {
    const storage = createInMemoryKeyValueStorage();
    const persister = createQueryPersister(storage, 0);

    const before = createQueryClient();
    before.setQueryData(queryKey, { temperature: 21 });
    await persistQueryClientSave({
      queryClient: before,
      persister,
      buster: PERSIST_BUSTER,
    });
    await flushWrites();

    const after = createQueryClient();
    await persistQueryClientRestore({
      queryClient: after,
      persister,
      maxAge: -1,
      buster: PERSIST_BUSTER,
    });

    expect(after.getQueryData(queryKey)).toBeUndefined();
  });

  it('writes through the injected storage rather than a global', async () => {
    const storage = createInMemoryKeyValueStorage();
    const client = createQueryClient();
    client.setQueryData(['a'], 1);

    await persistQueryClientSave({
      queryClient: client,
      persister: createQueryPersister(storage, 0),
      buster: PERSIST_BUSTER,
    });
    await flushWrites();

    expect(storage.contains('weather.query-cache')).toBe(true);
  });

  it('restores nothing when storage is empty, as on a first install', async () => {
    const storage = createInMemoryKeyValueStorage();
    const client = createQueryClient();

    await persistQueryClientRestore({
      queryClient: client,
      persister: createQueryPersister(storage, 0),
      maxAge: PERSIST_MAX_AGE_MS,
      buster: PERSIST_BUSTER,
    });

    expect(client.getQueryData(queryKey)).toBeUndefined();
  });
});
