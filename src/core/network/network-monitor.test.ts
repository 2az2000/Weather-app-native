import { createFakeNetworkMonitor } from './network-monitor';

describe('NetworkMonitor', () => {
  it('starts optimistic, so the first render does not take the degraded path', () => {
    expect(createFakeNetworkMonitor().isOnline).toBe(true);
  });

  it('notifies subscribers when connectivity changes', () => {
    const monitor = createFakeNetworkMonitor(true);
    const listener = jest.fn();
    monitor.subscribe(listener);

    monitor.setOnline(false);

    expect(listener).toHaveBeenCalledWith(false);
    expect(monitor.isOnline).toBe(false);
  });

  it('does not notify when the state is unchanged, avoiding redundant re-renders', () => {
    const monitor = createFakeNetworkMonitor(true);
    const listener = jest.fn();
    monitor.subscribe(listener);

    monitor.setOnline(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscriber', () => {
    const monitor = createFakeNetworkMonitor(true);
    const a = jest.fn();
    const b = jest.fn();
    monitor.subscribe(a);
    monitor.subscribe(b);

    monitor.setOnline(false);

    expect(a).toHaveBeenCalledWith(false);
    expect(b).toHaveBeenCalledWith(false);
  });

  it('stops notifying after unsubscribe', () => {
    const monitor = createFakeNetworkMonitor(true);
    const listener = jest.fn();
    const unsubscribe = monitor.subscribe(listener);

    unsubscribe();
    monitor.setOnline(false);

    expect(listener).not.toHaveBeenCalled();
  });

  it('reports the current state from refresh', async () => {
    const monitor = createFakeNetworkMonitor(false);
    await expect(monitor.refresh()).resolves.toBe(false);
  });

  it('drops all listeners on dispose', () => {
    const monitor = createFakeNetworkMonitor(true);
    const listener = jest.fn();
    monitor.subscribe(listener);

    monitor.dispose();
    monitor.setOnline(false);

    expect(listener).not.toHaveBeenCalled();
  });
});
