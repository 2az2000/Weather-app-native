import Constants from 'expo-constants';
import * as SQLite from 'expo-sqlite';

import { createContainer } from './container';

/**
 * Covers the composition root.
 *
 * Two native modules are doubled because they have no injectable seam at
 * construction time: `expo-constants` (build-time values) and `expo-sqlite`
 * (native binding). Everything the container BUILDS is independently tested
 * against fakes elsewhere.
 */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.MockedFunction<
  typeof SQLite.openDatabaseAsync
>;

const constants = Constants as unknown as {
  expoConfig: { extra: Record<string, unknown> } | null;
};

function workingDb() {
  return {
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => ({ user_version: 0 })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => undefined),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
    closeAsync: jest.fn(async () => undefined),
  } as unknown as SQLite.SQLiteDatabase;
}

describe('createContainer', () => {
  beforeEach(() => {
    constants.expoConfig = { extra: {} };
    openDatabaseAsync.mockResolvedValue(workingDb());
  });

  it('wires every core service', async () => {
    const container = await createContainer();

    expect(container.env).toBeDefined();
    expect(container.logger).toBeDefined();
    expect(container.storage).toBeDefined();
    expect(container.network).toBeDefined();
    expect(container.api).toBeDefined();
    expect(container.database).toBeDefined();
  });

  it('builds every provider client', async () => {
    const container = await createContainer();

    expect(container.api.openMeteoForecast.provider).toBe('open-meteo');
    expect(container.api.openWeather.provider).toBe('openweather');
  });

  it('surfaces configured secrets through env', async () => {
    constants.expoConfig = { extra: { openWeatherApiKey: 'ow-key' } };

    const container = await createContainer();

    expect(container.env.openWeatherApiKey).toBe('ow-key');
  });

  describe('when the database is unavailable', () => {
    it('still returns a usable container, degrading to MMKV-only', async () => {
      // A corrupt cache must never prevent the app from starting
      // (CLAUDE.md §24).
      openDatabaseAsync.mockRejectedValue(new Error('database is corrupt'));

      const container = await createContainer();

      expect(container.database).toBeUndefined();
      expect(container.storage).toBeDefined();
      expect(container.api).toBeDefined();
    });
  });

  describe('when configuration is invalid', () => {
    it('rejects at startup rather than failing later at first use', async () => {
      constants.expoConfig = { extra: { openWeatherApiKey: 12345 } };

      await expect(createContainer()).rejects.toThrow(/openWeatherApiKey/);
    });
  });
});
