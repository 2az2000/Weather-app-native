import * as Network from 'expo-network';

import { createNetworkMonitor } from './network-monitor';

/**
 * Covers the expo-network-backed monitor. The module is doubled because a native
 * connectivity signal has no seam to inject through; everything downstream of
 * `NetworkMonitor` is tested against the injectable fake instead.
 */
const mock = Network as unknown as {
  __setState(state: { isConnected: boolean; isInternetReachable: boolean | null }): void;
  __emit(state: { isConnected: boolean; isInternetReachable: boolean | null }): void;
  __reset(): void;
  __listenerCount(): number;
};

describe('createNetworkMonitor', () => {
  afterEach(() => {
    mock.__reset();
  });

  it('starts optimistic so the first render does not take the degraded path', () => {
    expect(createNetworkMonitor().isOnline).toBe(true);
  });

  it('registers a native listener on creation', () => {
    createNetworkMonitor();
    expect(mock.__listenerCount()).toBe(1);
  });

  describe('reacting to native state changes', () => {
    it('goes offline when the network becomes unreachable', () => {
      const monitor = createNetworkMonitor();
      const listener = jest.fn();
      monitor.subscribe(listener);

      mock.__emit({ isConnected: false, isInternetReachable: false });

      expect(monitor.isOnline).toBe(false);
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('treats connected-but-not-reachable as offline, which is the captive-portal case', () => {
      const monitor = createNetworkMonitor();

      mock.__emit({ isConnected: true, isInternetReachable: false });

      expect(monitor.isOnline).toBe(false);
    });

    it('falls back to isConnected when reachability is unknown', () => {
      const monitor = createNetworkMonitor();

      mock.__emit({ isConnected: false, isInternetReachable: null });

      expect(monitor.isOnline).toBe(false);
    });

    it('does not re-notify when the state is unchanged', () => {
      const monitor = createNetworkMonitor();
      const listener = jest.fn();
      monitor.subscribe(listener);

      mock.__emit({ isConnected: true, isInternetReachable: true });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('re-reads the current state and reports it', async () => {
      const monitor = createNetworkMonitor();
      mock.__setState({ isConnected: false, isInternetReachable: false });

      await expect(monitor.refresh()).resolves.toBe(false);
      expect(monitor.isOnline).toBe(false);
    });

    it('notifies subscribers when a refresh changes the state', async () => {
      const monitor = createNetworkMonitor();
      const listener = jest.fn();
      monitor.subscribe(listener);

      mock.__setState({ isConnected: false, isInternetReachable: false });
      await monitor.refresh();

      expect(listener).toHaveBeenCalledWith(false);
    });
  });

  describe('subscription lifecycle', () => {
    it('stops notifying after unsubscribe', () => {
      const monitor = createNetworkMonitor();
      const listener = jest.fn();
      const unsubscribe = monitor.subscribe(listener);

      unsubscribe();
      mock.__emit({ isConnected: false, isInternetReachable: false });

      expect(listener).not.toHaveBeenCalled();
    });

    it('releases the native subscription on dispose, avoiding a leak', () => {
      const monitor = createNetworkMonitor();
      expect(mock.__listenerCount()).toBe(1);

      monitor.dispose();

      expect(mock.__listenerCount()).toBe(0);
    });
  });
});
