/**
 * Test double for expo-network.
 *
 * Connectivity is a native signal with no seam to inject through, so the module
 * itself is doubled. Tests drive it with `__setState()` / `__emit()`.
 *
 * Behaviour that HAS a seam — everything consuming `NetworkMonitor` — is tested
 * against `createFakeNetworkMonitor()` instead (CLAUDE.md §26).
 */
let state = { isConnected: true, isInternetReachable: true };
const listeners = new Set();

module.exports = {
  getNetworkStateAsync: async () => state,

  addNetworkStateListener: (listener) => {
    listeners.add(listener);
    return {
      remove: () => {
        listeners.delete(listener);
      },
    };
  },

  /** Test helper: set what `getNetworkStateAsync` will report. */
  __setState: (next) => {
    state = next;
  },

  /** Test helper: push a state change to every registered listener. */
  __emit: (next) => {
    state = next;
    for (const listener of listeners) listener(next);
  },

  /** Test helper: reset between tests. */
  __reset: () => {
    state = { isConnected: true, isInternetReachable: true };
    listeners.clear();
  },

  __listenerCount: () => listeners.size,
};
