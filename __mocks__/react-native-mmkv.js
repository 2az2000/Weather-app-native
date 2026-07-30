/**
 * Test double for react-native-mmkv.
 *
 * MMKV v4 is backed by Nitro Modules — a native binary that cannot load in a
 * Node test process. This double exists so that IMPORTING the module does not
 * crash a suite; it is not how storage behaviour is tested.
 *
 * Storage behaviour is tested by INJECTING `createInMemoryKeyValueStorage()`
 * through the `KeyValueStorage` interface (CLAUDE.md §26 — inject a fake rather
 * than mock a module). This file only neutralises the native import, which has
 * no seam to inject through.
 *
 * Jest picks this up automatically for the `react-native-mmkv` package because
 * it sits in a root-level `__mocks__/` directory.
 */
function createMMKV() {
  const store = new Map();

  return {
    set: (key, value) => {
      store.set(key, value);
    },
    getString: (key) => store.get(key),
    getNumber: (key) => store.get(key),
    getBoolean: (key) => store.get(key),
    getBuffer: (key) => store.get(key),
    contains: (key) => store.has(key),
    remove: (key) => store.delete(key),
    getAllKeys: () => [...store.keys()],
    clearAll: () => {
      store.clear();
    },
  };
}

module.exports = {
  createMMKV,
  existsMMKV: () => false,
  deleteMMKV: () => undefined,
};
