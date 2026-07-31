import { locationKeys } from './query-keys';

/**
 * Query keys are centralised so invalidation cannot silently break
 * (CLAUDE.md §8, §32). These tests assert the HIERARCHY, which is what makes a
 * single `invalidateQueries` call refresh the whole feature.
 */
describe('locationKeys', () => {
  it('nests every key under the feature root', () => {
    const root = locationKeys.all[0];

    for (const key of [
      locationKeys.saved(),
      locationKeys.current(),
      locationKeys.permission(),
      locationKeys.recentSearches(),
      locationKeys.searches(),
      locationKeys.search('tehran', 'en'),
    ]) {
      expect(key[0]).toBe(root);
    }
  });

  it('gives each concern a distinct key', () => {
    const keys = [
      locationKeys.saved(),
      locationKeys.current(),
      locationKeys.permission(),
      locationKeys.recentSearches(),
    ].map((key) => key.join('/'));

    expect(new Set(keys).size).toBe(keys.length);
  });

  describe('search keys', () => {
    it('varies by query', () => {
      expect(locationKeys.search('tehran', 'en')).not.toEqual(
        locationKeys.search('shiraz', 'en'),
      );
    });

    it('varies by LOCALE, because the provider localises city names', () => {
      // Without the locale in the key, switching to Persian would show cached
      // English results.
      expect(locationKeys.search('tehran', 'en')).not.toEqual(
        locationKeys.search('tehran', 'fa'),
      );
    });

    it('nests under the searches prefix, so one call invalidates them all', () => {
      const prefix = locationKeys.searches();
      const specific = locationKeys.search('tehran', 'en');

      expect(specific.slice(0, prefix.length)).toEqual([...prefix]);
    });
  });

  it('is stable across calls, so keys compare equal', () => {
    expect(locationKeys.search('tehran', 'en')).toEqual(
      locationKeys.search('tehran', 'en'),
    );
  });
});
