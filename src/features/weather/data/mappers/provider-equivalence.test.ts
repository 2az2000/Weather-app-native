import type { Forecast } from '../../domain';

import { openMeteoFixture, openWeatherFixture, OBSERVED_AT } from './__fixtures__';
import { toForecast as openMeteoToForecast } from './open-meteo-mapper';
import { toForecast as openWeatherToForecast } from './open-weather-mapper';

/**
 * ROADMAP Phase 4 DoD: "Both providers map into **identical entity shapes** —
 * proven by a test asserting equivalence on the same location."
 *
 * This is the test that makes the two providers genuinely interchangeable. If
 * it fails, failover would hand the UI a differently-shaped object and the
 * screen would break precisely when the primary provider is already down —
 * the worst possible moment (CLAUDE.md §35).
 */
describe('provider equivalence', () => {
  const FETCHED_AT = new Date('2026-07-31T08:30:00Z');

  const fromOpenMeteo = openMeteoToForecast(openMeteoFixture(), FETCHED_AT);
  const fromOpenWeather = openWeatherToForecast(openWeatherFixture(), FETCHED_AT);

  describe('structural equivalence', () => {
    it('produces the same top-level keys', () => {
      expect(Object.keys(fromOpenMeteo).sort()).toEqual(
        Object.keys(fromOpenWeather).sort(),
      );
    });

    it('produces the same keys on current conditions', () => {
      expect(Object.keys(fromOpenMeteo.current).sort()).toEqual(
        Object.keys(fromOpenWeather.current).sort(),
      );
    });

    it('produces the same keys on an hourly point', () => {
      expect(Object.keys(fromOpenMeteo.hourly.points[0] ?? {}).sort()).toEqual(
        Object.keys(fromOpenWeather.hourly.points[0] ?? {}).sort(),
      );
    });

    it('produces the same keys on a daily point', () => {
      expect(Object.keys(fromOpenMeteo.daily.points[0] ?? {}).sort()).toEqual(
        Object.keys(fromOpenWeather.daily.points[0] ?? {}).sort(),
      );
    });

    it('produces the same keys on a minutely point', () => {
      expect(Object.keys(fromOpenMeteo.minutely?.points[0] ?? {}).sort()).toEqual(
        Object.keys(fromOpenWeather.minutely?.points[0] ?? {}).sort(),
      );
    });
  });

  describe('value equivalence for the same weather', () => {
    it('reports the same current temperature', () => {
      expect(fromOpenMeteo.current.temperature).toBe(fromOpenWeather.current.temperature);
    });

    it('reports the same apparent temperature, humidity and pressure', () => {
      expect(fromOpenMeteo.current.apparentTemperature).toBe(
        fromOpenWeather.current.apparentTemperature,
      );
      expect(fromOpenMeteo.current.humidity).toBe(fromOpenWeather.current.humidity);
      expect(fromOpenMeteo.current.pressure).toBe(fromOpenWeather.current.pressure);
    });

    it('reports the same wind', () => {
      expect(fromOpenMeteo.current.windSpeed).toBe(fromOpenWeather.current.windSpeed);
      expect(fromOpenMeteo.current.windDirection).toBe(
        fromOpenWeather.current.windDirection,
      );
      expect(fromOpenMeteo.current.windGust).toBe(fromOpenWeather.current.windGust);
    });

    it('reports the same dew point, visibility and UV index', () => {
      expect(fromOpenMeteo.current.dewPoint).toBe(fromOpenWeather.current.dewPoint);
      expect(fromOpenMeteo.current.visibility).toBe(fromOpenWeather.current.visibility);
      expect(fromOpenMeteo.current.uvIndex).toBe(fromOpenWeather.current.uvIndex);
    });

    it('resolves the same CONDITION from two different code schemes', () => {
      // WMO 0 and OpenWeather 800 both mean "clear sky". That they land on the
      // same value is what the shared vocabulary buys.
      expect(fromOpenMeteo.current.condition).toBe('clear');
      expect(fromOpenWeather.current.condition).toBe('clear');
    });

    it('agrees on daytime', () => {
      expect(fromOpenMeteo.current.isDaytime).toBe(fromOpenWeather.current.isDaytime);
    });

    it('reports the same observation time despite different wire formats', () => {
      // Open-Meteo sends a zone-less local string with a +03:30 offset;
      // OpenWeather sends Unix seconds. Both must land on the same instant.
      expect(fromOpenMeteo.current.observedAt.getTime()).toBe(OBSERVED_AT.getTime());
      expect(fromOpenWeather.current.observedAt.getTime()).toBe(OBSERVED_AT.getTime());
    });

    it('reports the same daily highs and lows', () => {
      const meteo = fromOpenMeteo.daily.points[0];
      const weather = fromOpenWeather.daily.points[0];

      expect(meteo?.temperatureMax).toBe(weather?.temperatureMax);
      expect(meteo?.temperatureMin).toBe(weather?.temperatureMin);
    });

    it('normalises probability to percent from both a percent and a fraction', () => {
      // Open-Meteo sends 5 (percent); OpenWeather sends 0.05 (fraction).
      expect(fromOpenMeteo.hourly.points[2]?.precipitationProbability).toBe(5);
      expect(fromOpenWeather.hourly.points[2]?.precipitationProbability).toBe(5);
    });
  });

  describe('provenance', () => {
    it('records which provider answered', () => {
      // The only field that SHOULD differ — the circuit breaker and the logs
      // need to know, but nothing above the data layer branches on it.
      expect(fromOpenMeteo.provider).toBe('open-meteo');
      expect(fromOpenWeather.provider).toBe('openweather');
    });

    it('agrees on the scalar fields, differing only in provider', () => {
      const scalarKeys = ['timezone', 'provider', 'fetchedAt'] as const;

      const differing = scalarKeys.filter(
        (key) =>
          JSON.stringify(fromOpenMeteo[key]) !== JSON.stringify(fromOpenWeather[key]),
      );

      expect(differing).toEqual(['provider']);
    });

    it('gives every point in every series an identical key set', () => {
      // This — not a whole-object comparison — is what "identical entity
      // shapes" means. Comparing values would conflate a shape mismatch with a
      // fixture difference, and would pass or fail for the wrong reasons.
      const keysOf = (value: object | undefined): string[] =>
        Object.keys(value ?? {}).sort();

      const series: readonly (keyof Pick<Forecast, 'hourly' | 'daily'>)[] = [
        'hourly',
        'daily',
      ];

      for (const key of series) {
        for (const point of fromOpenWeather[key].points) {
          expect(keysOf(point)).toEqual(keysOf(fromOpenMeteo[key].points[0]));
        }
      }
    });

    it('anchors a daily entry at the same instant from both providers', () => {
      // OpenWeather stamps daily entries near local NOON and Open-Meteo at
      // local MIDNIGHT. Without normalisation the same calendar day would carry
      // two different dates, and a day-grouped list would shift on failover.
      expect(fromOpenMeteo.daily.points[0]?.date.getTime()).toBe(
        fromOpenWeather.daily.points[0]?.date.getTime(),
      );
    });
  });
});
