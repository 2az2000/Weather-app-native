import { AstronomyCalculator, MOON_PHASES } from './astronomy-calculator';

/**
 * ROADMAP Phase 4 DoD: "`AstronomyCalculator` validated against known
 * astronomical values, **with the network disabled**."
 *
 * The network is disabled for the whole suite by `jest.setup.js`, which throws
 * on any real fetch. That these tests pass at all IS the offline proof —
 * astronomy needs no provider (ADR-0008).
 */
describe('AstronomyCalculator', () => {
  const calculator = new AstronomyCalculator();

  const TEHRAN = { latitude: 35.6892, longitude: 51.389 };
  const LONDON = { latitude: 51.5074, longitude: -0.1278 };
  /** Inside the Arctic Circle — polar day and polar night both occur. */
  const TROMSO = { latitude: 69.6492, longitude: 18.9553 };

  describe('sun times against known values', () => {
    it('puts sunrise before sunset', () => {
      const times = calculator.getSunTimes(new Date('2026-06-21T12:00:00Z'), LONDON);

      expect(times.sunrise).toBeDefined();
      expect(times.sunset).toBeDefined();
      expect(times.sunrise!.getTime()).toBeLessThan(times.sunset!.getTime());
    });

    it('gives London a much longer day at the June solstice than at December', () => {
      const june = calculator.getSunTimes(new Date('2026-06-21T12:00:00Z'), LONDON);
      const december = calculator.getSunTimes(new Date('2026-12-21T12:00:00Z'), LONDON);

      const dayLength = (t: typeof june): number =>
        (t.sunset?.getTime() ?? 0) - (t.sunrise?.getTime() ?? 0);

      // London: ~16h40m in June, ~7h50m in December.
      expect(dayLength(june) / 3_600_000).toBeGreaterThan(16);
      expect(dayLength(december) / 3_600_000).toBeLessThan(9);
    });

    it('places solar noon near midday local time', () => {
      const times = calculator.getSunTimes(new Date('2026-03-20T12:00:00Z'), LONDON);

      // London is close to the prime meridian, so solar noon is near 12:00 UTC.
      const hourUtc = times.solarNoon.getUTCHours();
      expect(hourUtc).toBeGreaterThanOrEqual(11);
      expect(hourUtc).toBeLessThanOrEqual(13);
    });

    it('gives dawn before sunrise and dusk after sunset', () => {
      const times = calculator.getSunTimes(new Date('2026-06-21T12:00:00Z'), LONDON);

      expect(times.dawn!.getTime()).toBeLessThan(times.sunrise!.getTime());
      expect(times.dusk!.getTime()).toBeGreaterThan(times.sunset!.getTime());
    });
  });

  describe('polar day and polar night', () => {
    it('reports no sunset during Arctic summer', () => {
      // The sun genuinely does not set in Tromsø in late June. That is an
      // astronomical fact, not a failure — `undefined` says so honestly.
      const times = calculator.getSunTimes(new Date('2026-06-21T12:00:00Z'), TROMSO);

      expect(times.sunset).toBeUndefined();
    });

    it('reports no sunrise during Arctic winter', () => {
      const times = calculator.getSunTimes(new Date('2026-12-21T12:00:00Z'), TROMSO);

      expect(times.sunrise).toBeUndefined();
    });

    it('still reports solar noon, which always exists', () => {
      const times = calculator.getSunTimes(new Date('2026-12-21T12:00:00Z'), TROMSO);

      expect(times.solarNoon).toBeInstanceOf(Date);
      expect(Number.isNaN(times.solarNoon.getTime())).toBe(false);
    });
  });

  describe('sun position', () => {
    it('puts the sun above the horizon at local midday', () => {
      // 12:00 UTC is ~15:30 in Tehran — comfortably daytime.
      const position = calculator.getSunPosition(
        new Date('2026-06-21T09:00:00Z'),
        TEHRAN,
      );

      expect(position.elevation).toBeGreaterThan(0);
      expect(position.isDaytime).toBe(true);
    });

    it('puts the sun below the horizon at local midnight', () => {
      const position = calculator.getSunPosition(
        new Date('2026-06-21T20:30:00Z'),
        TEHRAN,
      );

      expect(position.elevation).toBeLessThan(0);
      expect(position.isDaytime).toBe(false);
    });

    it('reports azimuth as a bearing clockwise from north', () => {
      const position = calculator.getSunPosition(
        new Date('2026-06-21T09:00:00Z'),
        TEHRAN,
      );

      expect(position.azimuth).toBeGreaterThanOrEqual(0);
      expect(position.azimuth).toBeLessThan(360);
    });

    it('never exceeds 90° elevation, the geometric maximum', () => {
      for (let hour = 0; hour < 24; hour += 1) {
        const date = new Date(Date.UTC(2026, 5, 21, hour));
        const { elevation } = calculator.getSunPosition(date, TEHRAN);

        expect(elevation).toBeLessThanOrEqual(90);
        expect(elevation).toBeGreaterThanOrEqual(-90);
      }
    });
  });

  describe('time of day', () => {
    it('reports day when the sun is high', () => {
      expect(calculator.getTimeOfDay(new Date('2026-06-21T09:00:00Z'), TEHRAN)).toBe(
        'day',
      );
    });

    it('reports night well after sunset', () => {
      expect(calculator.getTimeOfDay(new Date('2026-06-21T20:30:00Z'), TEHRAN)).toBe(
        'night',
      );
    });

    it('distinguishes dawn from dusk at the same elevation', () => {
      // The core reason this is derived from solar elevation and its DIRECTION
      // of travel rather than from the clock: the two moments look identical to
      // an elevation-only rule.
      const bands = new Set<string>();

      for (let minutes = 0; minutes < 24 * 60; minutes += 10) {
        const date = new Date(Date.UTC(2026, 2, 20, 0, minutes));
        bands.add(calculator.getTimeOfDay(date, LONDON));
      }

      expect(bands.has('dawn')).toBe(true);
      expect(bands.has('dusk')).toBe(true);
      expect(bands.has('day')).toBe(true);
      expect(bands.has('night')).toBe(true);
    });
  });

  describe('moon phase against known values', () => {
    it('reports a full moon on a known full-moon date', () => {
      // 2026-01-03 is a full moon. Illumination should be near 100%.
      const moon = calculator.getMoonInfo(new Date('2026-01-03T12:00:00Z'), TEHRAN);

      expect(moon.illumination).toBeGreaterThan(97);
      expect(moon.phase).toBe('full');
    });

    it('reports a new moon on a known new-moon date', () => {
      // 2026-01-18 is a new moon.
      const moon = calculator.getMoonInfo(new Date('2026-01-18T12:00:00Z'), TEHRAN);

      expect(moon.illumination).toBeLessThan(3);
      expect(moon.phase).toBe('new');
    });

    it('keeps illumination within 0–100', () => {
      for (let day = 0; day < 30; day += 1) {
        const date = new Date(Date.UTC(2026, 0, 1 + day));
        const moon = calculator.getMoonInfo(date, TEHRAN);

        expect(moon.illumination).toBeGreaterThanOrEqual(0);
        expect(moon.illumination).toBeLessThanOrEqual(100);
      }
    });

    it('passes through every named phase across a lunar cycle', () => {
      const seen = new Set<string>();

      // A synodic month is ~29.53 days; 30 daily samples cover it.
      for (let day = 0; day < 30; day += 1) {
        const date = new Date(Date.UTC(2026, 0, 1 + day));
        seen.add(calculator.getMoonInfo(date, TEHRAN).phase);
      }

      for (const phase of MOON_PHASES) {
        expect(seen).toContain(phase);
      }
    });

    it('reports a phase fraction in 0–1', () => {
      const moon = calculator.getMoonInfo(new Date('2026-07-31T12:00:00Z'), TEHRAN);

      expect(moon.phaseFraction).toBeGreaterThanOrEqual(0);
      expect(moon.phaseFraction).toBeLessThanOrEqual(1);
    });
  });

  describe('determinism', () => {
    it('returns identical results for identical inputs', () => {
      const date = new Date('2026-07-31T12:00:00Z');

      expect(calculator.getMoonInfo(date, TEHRAN)).toEqual(
        calculator.getMoonInfo(date, TEHRAN),
      );
      expect(calculator.getSunTimes(date, TEHRAN)).toEqual(
        calculator.getSunTimes(date, TEHRAN),
      );
    });

    it('works for a date far in the past and far in the future', () => {
      // No cache, no provider, no coverage window — the whole point of
      // computing rather than fetching (ADR-0008).
      expect(() => calculator.getSunTimes(new Date('1899-01-01'), TEHRAN)).not.toThrow();
      expect(() => calculator.getMoonInfo(new Date('2099-12-31'), TEHRAN)).not.toThrow();
    });
  });
});
