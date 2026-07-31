import { err, ok, type AppError, type Result } from '@/core/errors';

import type { Coordinates } from '../entities/coordinates';
import type { LocationSearchResult, Place, SavedLocation } from '../entities/place';
import type { LocationRepository } from '../repositories/location-repository';

import { GetCurrentLocation } from './get-current-location';
import { ReorderLocations } from './reorder-locations';
import { ReverseGeocode } from './reverse-geocode';
import { MAX_SAVED_LOCATIONS, SaveLocation } from './save-location';
import { SearchCities } from './search-cities';

/**
 * Domain tests use NO mocking framework.
 *
 * A hand-written fake implementing the interface is enough, which is the whole
 * point of depending on an interface rather than an implementation — if these
 * needed `jest.mock`, the dependencies would be wrong (CLAUDE.md §26 rule 1).
 */

function place(overrides: Partial<Place> = {}): Place {
  return {
    coordinates: { latitude: 35.6892, longitude: 51.389 },
    name: 'Tehran',
    admin1: 'Tehran',
    countryCode: 'IR',
    country: 'Iran',
    timezone: 'Asia/Tehran',
    elevation: 1200,
    ...overrides,
  };
}

function saved(overrides: Partial<SavedLocation> = {}): SavedLocation {
  return {
    ...place(),
    id: 'id-1',
    sortOrder: 0,
    isCurrentLocation: false,
    savedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/** Minimal in-memory repository. Every method is overridable per test. */
function fakeRepository(overrides: Partial<LocationRepository> = {}): LocationRepository {
  const notImplemented = <T>(): Promise<Result<T, AppError>> =>
    Promise.resolve(err({ kind: 'unknown', cause: 'not stubbed', retryable: false }));

  return {
    getCurrentLocation: () => Promise.resolve(ok(place())),
    searchCities: () => Promise.resolve(ok([])),
    reverseGeocode: () => Promise.resolve(ok(place())),
    getSavedLocations: () => Promise.resolve(ok([])),
    saveLocation: (input) => Promise.resolve(ok(saved({ ...input, id: 'new' }))),
    removeLocation: () => Promise.resolve(ok(undefined)),
    reorderLocations: () => Promise.resolve(ok(undefined)),
    getRecentSearches: () => Promise.resolve(ok([])),
    recordSearch: () => Promise.resolve(ok(undefined)),
    clearRecentSearches: () => notImplemented(),
    ...overrides,
  };
}

describe('GetCurrentLocation', () => {
  it('returns the resolved place', async () => {
    const result = await new GetCurrentLocation(fakeRepository()).execute();

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(null as never).name).toBe('Tehran');
  });

  it('propagates a permission refusal as a typed error, not an exception', async () => {
    const repository = fakeRepository({
      getCurrentLocation: () =>
        Promise.resolve(
          err({ kind: 'permissionDenied', permission: 'location', retryable: false }),
        ),
    });

    const result = await new GetCurrentLocation(repository).execute();

    expect(result.isErr() && result.error.kind).toBe('permissionDenied');
  });
});

describe('SearchCities', () => {
  const hit: LocationSearchResult = { ...place(), id: '1', population: 9_000_000 };

  it('returns matches for a valid query', async () => {
    const repository = fakeRepository({ searchCities: () => Promise.resolve(ok([hit])) });

    const result = await new SearchCities(repository).execute('Tehran', 'en');

    expect(result.unwrapOr([])).toHaveLength(1);
  });

  describe('minimum query length', () => {
    it.each(['', ' ', 'a', ' a '])(
      'returns empty for %p without searching',
      async (query) => {
        const searchCities = jest.fn();
        const repository = fakeRepository({ searchCities });

        const result = await new SearchCities(repository).execute(query, 'en');

        // One character matches thousands of places — the request would be wasted.
        expect(result.unwrapOr([])).toEqual([]);
        expect(searchCities).not.toHaveBeenCalled();
      },
    );
  });

  it('trims the query before searching', async () => {
    const searchCities = jest.fn(() => Promise.resolve(ok([hit])));
    const repository = fakeRepository({ searchCities });

    await new SearchCities(repository).execute('  Tehran  ', 'en');

    expect(searchCities).toHaveBeenCalledWith('Tehran', 'en');
  });

  describe('recording searches', () => {
    it('records a search that produced results', async () => {
      const recordSearch = jest.fn(() => Promise.resolve(ok(undefined)));
      const repository = fakeRepository({
        searchCities: () => Promise.resolve(ok([hit])),
        recordSearch,
      });

      await new SearchCities(repository).execute('Tehran', 'en');

      expect(recordSearch).toHaveBeenCalledWith('Tehran');
    });

    it('does NOT record a search that found nothing', async () => {
      const recordSearch = jest.fn();
      const repository = fakeRepository({
        searchCities: () => Promise.resolve(ok([])),
        recordSearch,
      });

      await new SearchCities(repository).execute('Xyzzy', 'en');

      // Offering a query that returns nothing is worse than not offering it.
      expect(recordSearch).not.toHaveBeenCalled();
    });

    it('does not record when the search failed', async () => {
      const recordSearch = jest.fn();
      const repository = fakeRepository({
        searchCities: () => Promise.resolve(err({ kind: 'network', retryable: true })),
        recordSearch,
      });

      await new SearchCities(repository).execute('Tehran', 'en');

      expect(recordSearch).not.toHaveBeenCalled();
    });
  });
});

describe('ReverseGeocode', () => {
  it('resolves valid coordinates', async () => {
    const result = await new ReverseGeocode(fakeRepository()).execute({
      latitude: 35.6892,
      longitude: 51.389,
    });

    expect(result.isOk()).toBe(true);
  });

  describe('validation before the network', () => {
    it.each<Coordinates>([
      { latitude: 91, longitude: 0 },
      { latitude: -91, longitude: 0 },
      { latitude: 0, longitude: 181 },
      { latitude: 0, longitude: -181 },
      { latitude: Number.NaN, longitude: 0 },
      { latitude: 0, longitude: Number.POSITIVE_INFINITY },
    ])('rejects %j without calling the repository', async (coordinates) => {
      const reverseGeocode = jest.fn();
      const repository = fakeRepository({ reverseGeocode });

      const result = await new ReverseGeocode(repository).execute(coordinates);

      // An invalid coordinate would otherwise reach a URL and fail somewhere
      // unrelated, with an error that says nothing about the real cause.
      expect(result.isErr() && result.error.kind).toBe('validation');
      expect(reverseGeocode).not.toHaveBeenCalled();
    });
  });
});

describe('SaveLocation', () => {
  it('saves a new place', async () => {
    const saveLocation = jest.fn((input: Place) =>
      Promise.resolve(ok(saved({ ...input, id: 'new' }))),
    );
    const repository = fakeRepository({ saveLocation });

    const result = await new SaveLocation(repository).execute(place());

    expect(result.isOk()).toBe(true);
    expect(saveLocation).toHaveBeenCalled();
  });

  describe('duplicate detection', () => {
    it('is idempotent for a place already saved', async () => {
      const existing = saved({ id: 'existing' });
      const saveLocation = jest.fn();
      const repository = fakeRepository({
        getSavedLocations: () => Promise.resolve(ok([existing])),
        saveLocation,
      });

      const result = await new SaveLocation(repository).execute(place());

      // The user asked for this place to be in their list, and it is.
      expect(result.unwrapOr(null as never).id).toBe('existing');
      expect(saveLocation).not.toHaveBeenCalled();
    });

    it('compares by geohash CELL, not exact float equality', async () => {
      // Two searches for the same city return coordinates differing in the last
      // decimals. Exact comparison would let "Tehran" be saved repeatedly.
      const existing = saved({
        id: 'existing',
        coordinates: { latitude: 35.689198, longitude: 51.38897 },
      });
      const saveLocation = jest.fn();
      const repository = fakeRepository({
        getSavedLocations: () => Promise.resolve(ok([existing])),
        saveLocation,
      });

      const result = await new SaveLocation(repository).execute(
        place({ coordinates: { latitude: 35.689204, longitude: 51.389012 } }),
      );

      expect(result.unwrapOr(null as never).id).toBe('existing');
      expect(saveLocation).not.toHaveBeenCalled();
    });

    it('still saves a genuinely different city', async () => {
      const existing = saved({ id: 'tehran' });
      const saveLocation = jest.fn((input: Place) =>
        Promise.resolve(ok(saved({ ...input, id: 'shiraz' }))),
      );
      const repository = fakeRepository({
        getSavedLocations: () => Promise.resolve(ok([existing])),
        saveLocation,
      });

      const result = await new SaveLocation(repository).execute(
        place({ name: 'Shiraz', coordinates: { latitude: 29.5918, longitude: 52.5837 } }),
      );

      expect(result.unwrapOr(null as never).id).toBe('shiraz');
    });
  });

  describe('the saved-location limit', () => {
    it('rejects a save once the list is full', async () => {
      const full = Array.from({ length: MAX_SAVED_LOCATIONS }, (_, index) =>
        saved({
          id: `id-${String(index)}`,
          coordinates: { latitude: index, longitude: index },
        }),
      );
      const repository = fakeRepository({
        getSavedLocations: () => Promise.resolve(ok(full)),
      });

      const result = await new SaveLocation(repository).execute(
        place({ coordinates: { latitude: 80, longitude: 80 } }),
      );

      expect(result.isErr() && result.error.kind).toBe('validation');
    });
  });

  it('propagates a failure to read the existing list', async () => {
    const repository = fakeRepository({
      getSavedLocations: () =>
        Promise.resolve(err({ kind: 'storage', operation: 'read', retryable: false })),
    });

    const result = await new SaveLocation(repository).execute(place());

    expect(result.isErr() && result.error.kind).toBe('storage');
  });
});

describe('ReorderLocations', () => {
  const existing = [
    saved({ id: 'a', coordinates: { latitude: 1, longitude: 1 } }),
    saved({ id: 'b', coordinates: { latitude: 2, longitude: 2 } }),
    saved({ id: 'c', coordinates: { latitude: 3, longitude: 3 } }),
  ];

  const withExisting = (overrides: Partial<LocationRepository> = {}) =>
    fakeRepository({
      getSavedLocations: () => Promise.resolve(ok(existing)),
      ...overrides,
    });

  it('persists a valid permutation', async () => {
    const reorderLocations = jest.fn(() => Promise.resolve(ok(undefined)));
    const repository = withExisting({ reorderLocations });

    const result = await new ReorderLocations(repository).execute(['c', 'a', 'b']);

    expect(result.isOk()).toBe(true);
    expect(reorderLocations).toHaveBeenCalledWith(['c', 'a', 'b']);
  });

  describe('permutation validation', () => {
    it('rejects a duplicate id', async () => {
      const reorderLocations = jest.fn();
      const repository = withExisting({ reorderLocations });

      const result = await new ReorderLocations(repository).execute(['a', 'a', 'b']);

      expect(result.isErr() && result.error.kind).toBe('validation');
      expect(reorderLocations).not.toHaveBeenCalled();
    });

    it('rejects a list that drops a location', async () => {
      // A drag-and-drop bug that loses an id would otherwise silently delete a
      // location, and the damage would already be on disk.
      const reorderLocations = jest.fn();
      const repository = withExisting({ reorderLocations });

      const result = await new ReorderLocations(repository).execute(['a', 'b']);

      expect(result.isErr() && result.error.kind).toBe('validation');
      expect(reorderLocations).not.toHaveBeenCalled();
    });

    it('rejects an unknown id', async () => {
      const reorderLocations = jest.fn();
      const repository = withExisting({ reorderLocations });

      const result = await new ReorderLocations(repository).execute(['a', 'b', 'zzz']);

      expect(result.isErr() && result.error.kind).toBe('validation');
      expect(reorderLocations).not.toHaveBeenCalled();
    });
  });

  it('propagates a failure to read the existing list', async () => {
    const repository = fakeRepository({
      getSavedLocations: () =>
        Promise.resolve(err({ kind: 'storage', operation: 'read', retryable: false })),
    });

    const result = await new ReorderLocations(repository).execute(['a']);

    expect(result.isErr() && result.error.kind).toBe('storage');
  });
});
