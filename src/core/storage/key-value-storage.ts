import { createMMKV } from 'react-native-mmkv';

/**
 * Synchronous key-value storage — the fast tier (ADR-0004).
 *
 * This is the tier that makes the sub-500 ms cold start possible: it is readable
 * on the FIRST FRAME, with no `await` before first paint. Settings, Zustand
 * persistence, and Query cache hydration live here.
 *
 * Do NOT put bulk forecast history here. MMKV is not built for large values and
 * doing so degrades the very startup path it exists to protect — that belongs in
 * SQLite (see {@link ./database}).
 */
export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  contains(key: string): boolean;
  clearAll(): void;
}

/**
 * Production MMKV-backed implementation.
 *
 * react-native-mmkv v4 replaced the `new MMKV()` constructor with the
 * `createMMKV()` factory, and renamed `delete` to `remove`. This adapter is the
 * only place that difference is visible.
 */
export function createKeyValueStorage(id = 'weather'): KeyValueStorage {
  const mmkv = createMMKV({ id });

  return {
    getString: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    delete: (key) => {
      mmkv.remove(key);
    },
    contains: (key) => mmkv.contains(key),
    clearAll: () => mmkv.clearAll(),
  };
}

/**
 * In-memory implementation for tests.
 *
 * Injected as a fake rather than reached for with `jest.mock`, per CLAUDE.md §26
 * — if a unit needs module mocking, its dependencies are wrong.
 */
export function createInMemoryKeyValueStorage(): KeyValueStorage {
  const store = new Map<string, string>();

  return {
    getString: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
    delete: (key) => {
      store.delete(key);
    },
    contains: (key) => store.has(key),
    clearAll: () => {
      store.clear();
    },
  };
}
