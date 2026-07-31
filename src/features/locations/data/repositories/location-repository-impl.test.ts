import { err, ok } from '@/core/errors';
import { noopLogger } from '@/core/logger';

import type { Place } from '../../domain';
import type { DeviceLocationDataSource } from '../datasources/device-location-datasource';
import type { LocalLocationStore } from '../datasources/local-location-datasource';
import type { RemoteGeocodingDataSource } from '../datasources/remote-geocoding-datasource';

import {
  LocationRepositoryImpl,
  createUnavailableLocationStore,
} from './location-repository-impl';

const COORDINATES = { latitude: 35.6892, longitude: 51.389 };

const PLACE: Place = {
  coordinates: COORDINATES,
  name: 'Tehran',
  admin1: 'Tehran',
  countryCode: 'IR',
  country: 'Iran',
  timezone: 'Asia/Tehran',
  elevation: 1189,
};

function fakeDevice(overrides: Partial<DeviceLocationDataSource> = {}) {
  return {
    getPermissionState: () => Promise.resolve({ granted: true, canAskAgain: true }),
    requestPermission: () => Promise.resolve({ granted: true, canAskAgain: true }),
    getCurrentCoordinates: () => Promise.resolve(ok(COORDINATES)),
    reverseGeocode: () => Promise.resolve(ok(PLACE)),
    ...overrides,
  } as unknown as DeviceLocationDataSource;
}

function fakeRemote(): RemoteGeocodingDataSource {
  return {
    search: () => Promise.resolve(ok([])),
  } as unknown as RemoteGeocodingDataSource;
}

function build(device: DeviceLocationDataSource, local?: LocalLocationStore) {
  return new LocationRepositoryImpl(
    device,
    fakeRemote(),
    local ?? createUnavailableLocationStore(),
    noopLogger,
  );
}

describe('LocationRepositoryImpl', () => {
  describe('getCurrentLocation', () => {
    it('returns the resolved place when everything works', async () => {
      const result = await build(fakeDevice()).getCurrentLocation();

      expect(result.unwrapOr(null as never).name).toBe('Tehran');
    });

    it('propagates a permission refusal', async () => {
      const device = fakeDevice({
        getCurrentCoordinates: () =>
          Promise.resolve(
            err({ kind: 'permissionDenied', permission: 'location', retryable: false }),
          ),
      });

      const result = await build(device).getCurrentLocation();

      expect(result.isErr() && result.error.kind).toBe('permissionDenied');
    });

    describe('when reverse geocoding fails', () => {
      const device = () =>
        fakeDevice({
          reverseGeocode: () =>
            Promise.resolve(err({ kind: 'network', retryable: true })),
        });

      it('still returns the coordinates', async () => {
        // Losing the place label is cosmetic; losing the position would break
        // every weather query on the screen (CLAUDE.md §24: degrade, do not fail).
        const result = await build(device()).getCurrentLocation();

        expect(result.isOk()).toBe(true);
        expect(result.unwrapOr(null as never).coordinates).toEqual(COORDINATES);
      });

      it('leaves the name blank rather than inventing one', async () => {
        const result = await build(device()).getCurrentLocation();

        expect(result.unwrapOr(null as never).name).toBe('');
      });

      it('logs the degradation, so it is visible rather than silent', async () => {
        const warn = jest.fn();
        const repository = new LocationRepositoryImpl(
          device(),
          fakeRemote(),
          createUnavailableLocationStore(),
          { ...noopLogger, warn },
        );

        await repository.getCurrentLocation();

        expect(warn).toHaveBeenCalledWith(
          'locations.reverseGeocode.degraded',
          expect.objectContaining({ kind: 'network' }),
        );
      });
    });
  });
});

describe('createUnavailableLocationStore', () => {
  /**
   * A corrupt database must not prevent the app from starting (CLAUDE.md §24),
   * but it must not silently swallow writes either — accepting a save the user
   * would never get back is worse than telling them it failed.
   */
  const store = createUnavailableLocationStore();

  describe('operations that need persistence fail explicitly', () => {
    it('fails to read saved locations', async () => {
      const result = await store.getSaved();
      expect(result.isErr() && result.error.kind).toBe('storage');
    });

    it('fails to save', async () => {
      const result = await store.save(PLACE);
      expect(result.isErr() && result.error.kind).toBe('storage');
    });

    it('fails to remove', async () => {
      expect((await store.remove('id')).isErr()).toBe(true);
    });

    it('fails to reorder', async () => {
      expect((await store.reorder(['a'])).isErr()).toBe(true);
    });
  });

  describe('optional reads degrade to empty instead', () => {
    it('reports no recent searches, which is a truthful answer', async () => {
      const result = await store.getRecentSearches();

      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr(['x'])).toEqual([]);
    });

    it('accepts a recorded search as a no-op', async () => {
      expect((await store.recordSearch('tehran')).isOk()).toBe(true);
    });

    it('accepts clearing as a no-op', async () => {
      expect((await store.clearRecentSearches()).isOk()).toBe(true);
    });
  });

  it('keeps search and GPS working, so the app is still useful', async () => {
    const repository = build(fakeDevice(), store);

    // The whole point: a broken database costs persistence, not the app.
    expect((await repository.getCurrentLocation()).isOk()).toBe(true);
    expect((await repository.searchCities('tehran', 'en')).isOk()).toBe(true);
  });
});
