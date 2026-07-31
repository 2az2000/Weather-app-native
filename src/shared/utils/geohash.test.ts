import { decode, geohash, GEOHASH_PRECISION, isSameCell, quantize } from './geohash';

/**
 * ROADMAP Phase 3 DoD: "Geohash quantization unit-tested — two GPS fixes metres
 * apart produce the same key."
 *
 * This is the test that protects the entire caching strategy. Raw float
 * coordinates in a query key produce a cache MISS on every refresh, and nothing
 * about the failure looks broken — the app simply refetches forever and the
 * offline cache never fills (CLAUDE.md §25, §32).
 */
describe('geohash', () => {
  const TEHRAN = { latitude: 35.6892, longitude: 51.389 };

  describe('the DoD guarantee: GPS drift must not change the key', () => {
    it('gives nearby fixes the same key at weather precision', () => {
      // A stationary phone reports positions that differ in the last decimals.
      const fixes = [
        { latitude: 35.689198, longitude: 51.38897 },
        { latitude: 35.689204, longitude: 51.389012 },
        { latitude: 35.68923, longitude: 51.38904 },
        { latitude: 35.68917, longitude: 51.38893 },
      ];

      const keys = fixes.map((fix) => geohash(fix));

      expect(new Set(keys).size).toBe(1);
    });

    it('treats positions a few hundred metres apart as one cell', () => {
      // ~0.002° latitude is roughly 220 m — the same weather, same forecast.
      expect(isSameCell(TEHRAN, { latitude: 35.6912, longitude: 51.3908 })).toBe(true);
    });

    it('DOES distinguish genuinely different cities', () => {
      const shiraz = { latitude: 29.5918, longitude: 52.5837 };
      expect(isSameCell(TEHRAN, shiraz)).toBe(false);
    });

    it('would fail with raw floats — demonstrating what this prevents', () => {
      const a = { latitude: 35.689198, longitude: 51.38897 };
      const b = { latitude: 35.689204, longitude: 51.389012 };

      // The bug this exists to prevent: two keys where there should be one.
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
      expect(geohash(a)).toBe(geohash(b));
    });
  });

  describe('encoding', () => {
    it('produces exactly the requested number of characters', () => {
      for (const precision of [1, 3, 5, 7, 9]) {
        expect(geohash(TEHRAN, precision)).toHaveLength(precision);
      }
    });

    it('uses only the geohash base-32 alphabet', () => {
      // `a`, `i`, `l` and `o` are excluded by the standard.
      expect(geohash(TEHRAN, 9)).toMatch(/^[0-9bcdefghjkmnpqrstuvwxyz]+$/);
    });

    it('is deterministic', () => {
      expect(geohash(TEHRAN)).toBe(geohash(TEHRAN));
    });

    it('nests: a shorter hash is a prefix of a longer one', () => {
      const long = geohash(TEHRAN, 8);
      expect(long.startsWith(geohash(TEHRAN, 5))).toBe(true);
      expect(long.startsWith(geohash(TEHRAN, 3))).toBe(true);
    });

    it('matches known reference values', () => {
      // Cross-checked against the published algorithm, not against this
      // implementation — otherwise the test would only assert self-consistency.
      expect(geohash({ latitude: 0, longitude: 0 }, 5)).toBe('s0000');
      expect(geohash({ latitude: 90, longitude: 180 }, 5)).toBe('zzzzz');
      expect(geohash({ latitude: -90, longitude: -180 }, 5)).toBe('00000');
    });
  });

  describe('edge cases', () => {
    it('handles the poles and the antimeridian', () => {
      expect(() => geohash({ latitude: 90, longitude: 180 })).not.toThrow();
      expect(() => geohash({ latitude: -90, longitude: -180 })).not.toThrow();
    });

    it('wraps longitude, so 181° and -179° are the same place', () => {
      expect(geohash({ latitude: 0, longitude: 181 })).toBe(
        geohash({ latitude: 0, longitude: -179 }),
      );
    });

    it('clamps a latitude outside the valid range rather than producing nonsense', () => {
      expect(geohash({ latitude: 95, longitude: 0 })).toBe(
        geohash({ latitude: 90, longitude: 0 }),
      );
    });

    it('handles the equator and prime meridian without a sign glitch', () => {
      expect(geohash({ latitude: 0, longitude: 0 })).toHaveLength(
        GEOHASH_PRECISION.weather,
      );
    });
  });

  describe('decode', () => {
    it('round-trips to within the cell size', () => {
      const centre = decode(geohash(TEHRAN, 5));

      // Precision 5 is ~5 km, so the centre is within ~0.05°.
      expect(Math.abs(centre.latitude - TEHRAN.latitude)).toBeLessThan(0.05);
      expect(Math.abs(centre.longitude - TEHRAN.longitude)).toBeLessThan(0.05);
    });

    it('is lossy by design — every fix in a cell decodes identically', () => {
      const a = decode(geohash({ latitude: 35.689198, longitude: 51.38897 }));
      const b = decode(geohash({ latitude: 35.68923, longitude: 51.38904 }));

      expect(a).toEqual(b);
    });

    it('ignores characters outside the alphabet rather than throwing', () => {
      expect(() => decode('td!rq')).not.toThrow();
    });
  });

  describe('quantize', () => {
    it('returns the same coordinates for every fix in a cell', () => {
      const a = quantize({ latitude: 35.689198, longitude: 51.38897 });
      const b = quantize({ latitude: 35.68923, longitude: 51.38904 });

      // Sending the cell centre upstream means the provider sees one request
      // shape for the whole cell, so its caching works too.
      expect(a).toEqual(b);
    });
  });

  describe('precision presets', () => {
    it('uses a coarser cell for logging than for caching', () => {
      // Logged positions must be too imprecise to locate a person
      // (CLAUDE.md §23).
      expect(GEOHASH_PRECISION.logging).toBeLessThan(GEOHASH_PRECISION.weather);
    });

    it('makes a logged cell cover a whole metropolitan area', () => {
      const north = { latitude: 35.79, longitude: 51.389 };
      const south = { latitude: 35.62, longitude: 51.389 };

      expect(
        geohash(north, GEOHASH_PRECISION.logging) ===
          geohash(south, GEOHASH_PRECISION.logging),
      ).toBe(true);
    });
  });
});
