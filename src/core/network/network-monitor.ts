import * as Network from 'expo-network';

/**
 * Connectivity awareness.
 *
 * Connectivity adjusts BEHAVIOUR; it never gates RENDERING (CLAUDE.md §24).
 * Being offline is a normal, designed state that shows cached data with its age,
 * not an error screen. Nothing in the UI should ever wait on this to paint.
 */

export type ConnectivityListener = (isOnline: boolean) => void;

export interface NetworkMonitor {
  /** Last known state. Optimistically `true` before the first probe resolves. */
  readonly isOnline: boolean;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: ConnectivityListener): () => void;
  /** Force a re-read of the current state. */
  refresh(): Promise<boolean>;
  /** Release the underlying native subscription. */
  dispose(): void;
}

/**
 * Create the production monitor backed by `expo-network`.
 *
 * Starts OPTIMISTIC (`isOnline = true`): assuming offline until proven otherwise
 * would make the first render of every screen take the degraded path, which is
 * both wrong most of the time and visibly worse.
 */
export function createNetworkMonitor(): NetworkMonitor {
  let isOnline = true;
  const listeners = new Set<ConnectivityListener>();

  function update(next: boolean): void {
    if (next === isOnline) return;
    isOnline = next;
    for (const listener of listeners) listener(next);
  }

  const subscription = Network.addNetworkStateListener((state) => {
    update(state.isInternetReachable ?? state.isConnected ?? false);
  });

  return {
    get isOnline() {
      return isOnline;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async refresh() {
      const state = await Network.getNetworkStateAsync();
      update(state.isInternetReachable ?? state.isConnected ?? false);
      return isOnline;
    },

    dispose() {
      subscription.remove();
      listeners.clear();
    },
  };
}

/** Controllable fake for tests. */
export function createFakeNetworkMonitor(initiallyOnline = true): NetworkMonitor & {
  setOnline(next: boolean): void;
} {
  let isOnline = initiallyOnline;
  const listeners = new Set<ConnectivityListener>();

  return {
    get isOnline() {
      return isOnline;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: async () => isOnline,
    dispose() {
      listeners.clear();
    },
    setOnline(next) {
      if (next === isOnline) return;
      isOnline = next;
      for (const listener of listeners) listener(next);
    },
  };
}
