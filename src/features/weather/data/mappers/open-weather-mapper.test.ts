import { openWeatherFixture } from './__fixtures__';
import {
  toCurrentConditions,
  toDailyPoints,
  toForecast,
  toHourlyPoints,
  toMinutelyPoints,
  toSevereAlerts,
} from './open-weather-mapper';

describe('open-weather mapper', () => {
  describe('wire-format differences', () => {
    it('converts Unix seconds to a Date', () => {
      const current = toCurrentConditions(openWeatherFixture());

      expect(current.observedAt.toISOString()).toBe('2026-07-31T08:30:00.000Z');
    });

    it('sums nested rain and snow into one precipitation value', () => {
      const dto = openWeatherFixture();
      const current = {
        ...dto.current,
        rain: { '1h': 0.4 },
        snow: { '1h': 0.1 },
      };

      expect(toCurrentConditions({ ...dto, current }).precipitation).toBeCloseTo(0.5, 5);
    });

    it('treats absent rain and snow as no precipitation', () => {
      expect(toCurrentConditions(openWeatherFixture()).precipitation).toBe(0);
    });

    it('converts a 0–1 probability fraction to percent', () => {
      const hourly = toHourlyPoints(openWeatherFixture());

      expect(hourly[2]?.precipitationProbability).toBe(5);
    });
  });

  describe('daytime', () => {
    it('derives daytime from the sunrise/sunset pair', () => {
      // OpenWeather has no `is_day` flag.
      expect(toCurrentConditions(openWeatherFixture()).isDaytime).toBe(true);
    });

    it('reports night when the observation is after sunset', () => {
      const dto = openWeatherFixture();
      const current = { ...dto.current, dt: dto.current.dt + 20 * 3600 };

      expect(toCurrentConditions({ ...dto, current }).isDaytime).toBe(false);
    });

    it('assumes daytime when sun times are missing', () => {
      const dto = openWeatherFixture();
      const { sunrise: _s, sunset: _t, ...current } = dto.current;

      expect(toCurrentConditions({ ...dto, current }).isDaytime).toBe(true);
    });
  });

  describe('absent values', () => {
    it('keeps a missing dew point, visibility and UV undefined', () => {
      const dto = openWeatherFixture();
      const { dew_point: _d, visibility: _v, uvi: _u, ...current } = dto.current;

      const mapped = toCurrentConditions({ ...dto, current });

      expect(mapped.dewPoint).toBeUndefined();
      expect(mapped.visibility).toBeUndefined();
      expect(mapped.uvIndex).toBeUndefined();
    });

    it('falls back to clear when the weather array is empty', () => {
      const dto = openWeatherFixture();
      const current = { ...dto.current, weather: [] };

      expect(toCurrentConditions({ ...dto, current }).condition).toBe('clear');
    });
  });

  describe('daily', () => {
    it('maps feels-like day and night onto the max/min pair', () => {
      const daily = toDailyPoints(openWeatherFixture());

      expect(daily[0]?.apparentTemperatureMax).toBe(31.6);
      expect(daily[0]?.apparentTemperatureMin).toBe(20.8);
    });

    it('sums flat daily rain and snow', () => {
      const dto = openWeatherFixture();
      const daily = dto.daily.map((day) => ({ ...day, rain: 2, snow: 1 }));

      expect(toDailyPoints({ ...dto, daily })[0]?.precipitationSum).toBe(3);
    });
  });

  describe('minutely', () => {
    it('marks OpenWeather minutely data as natively resolved', () => {
      expect(toMinutelyPoints(openWeatherFixture()).every((p) => !p.isInterpolated)).toBe(
        true,
      );
    });

    it('returns an empty array when the block is absent', () => {
      const { minutely: _omitted, ...dto } = openWeatherFixture();

      expect(toMinutelyPoints(dto)).toEqual([]);
    });
  });

  describe('severe alerts', () => {
    it('maps an alert with a stable id', () => {
      const alerts = toSevereAlerts(openWeatherFixture());

      expect(alerts).toHaveLength(1);
      // Derived from fields that identify the alert, so it is stable across
      // refetches — which is what a list key needs.
      expect(alerts[0]?.id).toContain('Extreme Heat Warning');
    });

    it('reads severity from the tags, erring HIGH', () => {
      // Agencies word their own warnings and OpenWeather does not normalise
      // severity. Showing a watch as a warning is a smaller failure than the
      // reverse.
      expect(toSevereAlerts(openWeatherFixture())[0]?.severity).toBe('emergency');
    });

    it.each([
      ['Severe Thunderstorm Warning', [], 'warning'],
      ['Flood Watch', [], 'watch'],
      ['Small Craft Advisory', [], 'advisory'],
    ] as const)('maps %s to %s', (event, tags, expected) => {
      const dto = openWeatherFixture();
      const alerts = [{ ...dto.alerts![0]!, event, tags: [...tags] }];

      expect(toSevereAlerts({ ...dto, alerts })[0]?.severity).toBe(expected);
    });

    it('returns an empty array when there are no alerts', () => {
      const { alerts: _omitted, ...dto } = openWeatherFixture();

      expect(toSevereAlerts(dto)).toEqual([]);
    });
  });

  it('records the provider', () => {
    expect(toForecast(openWeatherFixture()).provider).toBe('openweather');
  });
});
