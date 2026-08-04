import { weatherKeys } from './query-keys';

/**
 * The cache-key contract.
 *
 * The quantization test is the load-bearing one: raw GPS floats in a key
 * produce a cache MISS on every refresh, the app refetches constantly, and
 * nothing about it looks broken (CLAUDE.md §25, §32).
 */
describe('weatherKeys', () => {
  const TEHRAN = { latitude: 35.6892, longitude: 51.389 };
  const SHIRAZ = { latitude: 29.5918, longitude: 52.5837 };

  it('namespaces every key under `weather`', () => {
    expect(weatherKeys.forecast(TEHRAN)[0]).toBe('weather');
    expect(weatherKeys.alerts(TEHRAN)[0]).toBe('weather');
    expect(weatherKeys.historical(TEHRAN, new Date(), new Date())[0]).toBe('weather');
  });

  it('distinguishes forecast from alerts for the same place', () => {
    expect(weatherKeys.forecast(TEHRAN)).not.toEqual(weatherKeys.alerts(TEHRAN));
  });

  describe('coordinate quantization', () => {
    it('gives DRIFTING GPS fixes the same key', () => {
      // Metres apart — the same place to a user and to a weather model.
      const first = weatherKeys.forecast({ latitude: 35.689198, longitude: 51.38897 });
      const second = weatherKeys.forecast({ latitude: 35.689204, longitude: 51.389012 });

      expect(first).toEqual(second);
    });

    it('gives genuinely different places different keys', () => {
      expect(weatherKeys.forecast(TEHRAN)).not.toEqual(weatherKeys.forecast(SHIRAZ));
    });

    it('never puts a raw float in the key', () => {
      const key = weatherKeys.forecast(TEHRAN);

      // A raw coordinate would appear as a number; a geohash is a short string.
      expect(key.every((part) => typeof part === 'string')).toBe(true);
      expect(JSON.stringify(key)).not.toContain('35.6892');
    });
  });

  describe('historical keys', () => {
    it('includes the date range, since a different range is different data', () => {
      const july = weatherKeys.historical(
        TEHRAN,
        new Date('2026-07-01'),
        new Date('2026-07-10'),
      );
      const august = weatherKeys.historical(
        TEHRAN,
        new Date('2026-08-01'),
        new Date('2026-08-10'),
      );

      expect(july).not.toEqual(august);
    });

    it('uses calendar dates, so two times on the same day share a key', () => {
      const morning = weatherKeys.historical(
        TEHRAN,
        new Date('2026-07-01T06:00:00Z'),
        new Date('2026-07-10T06:00:00Z'),
      );
      const evening = weatherKeys.historical(
        TEHRAN,
        new Date('2026-07-01T20:00:00Z'),
        new Date('2026-07-10T20:00:00Z'),
      );

      expect(morning).toEqual(evening);
    });
  });
});
