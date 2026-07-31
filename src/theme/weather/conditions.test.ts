import {
  getWeatherPalette,
  TIMES_OF_DAY,
  WEATHER_CONDITIONS,
  type TimeOfDay,
  type WeatherCondition,
} from './conditions';

/**
 * ROADMAP Phase 2 DoD: "`getWeatherPalette` unit-tested across all conditions ×
 * times of day."
 *
 * The background is a derivation of weather state, so it is testable without
 * rendering anything — the whole reason it is a pure function (CLAUDE.md §18).
 */
describe('getWeatherPalette', () => {
  const allCombinations: readonly (readonly [WeatherCondition, TimeOfDay])[] =
    WEATHER_CONDITIONS.flatMap((condition) =>
      TIMES_OF_DAY.map((time) => [condition, time] as const),
    );

  it('covers every condition × time-of-day combination', () => {
    expect(allCombinations).toHaveLength(WEATHER_CONDITIONS.length * TIMES_OF_DAY.length);
  });

  describe.each(allCombinations)('%s at %s', (condition, timeOfDay) => {
    const result = getWeatherPalette(condition, timeOfDay);

    it('returns at least two gradient stops', () => {
      expect(result.gradient.length).toBeGreaterThanOrEqual(2);
    });

    it('returns valid colour values', () => {
      for (const stop of result.gradient) {
        expect(stop).toMatch(/^(#[0-9A-Fa-f]{6}|rgba?\()/);
      }
      expect(result.accent).toMatch(/^(#[0-9A-Fa-f]{6}|rgba?\()/);
    });

    it('states a content-contrast preference', () => {
      expect(typeof result.prefersLightContent).toBe('boolean');
    });
  });

  describe('clear skies follow the time of day', () => {
    it('produces a distinct palette for each time band', () => {
      const gradients = TIMES_OF_DAY.map((time) =>
        getWeatherPalette('clear', time).gradient.join(),
      );

      expect(new Set(gradients).size).toBe(TIMES_OF_DAY.length);
    });

    it('renders night darker than day', () => {
      const day = getWeatherPalette('clear', 'day');
      const night = getWeatherPalette('clear', 'night');

      expect(night.gradient[0]).not.toBe(day.gradient[0]);
      expect(luminanceOf(night.gradient[0])).toBeLessThan(luminanceOf(day.gradient[0]));
    });
  });

  describe('severe weather overrides the time of day', () => {
    it.each(['thunderstorm', 'heavyRain', 'fog'] as const)(
      '%s looks the same at every hour',
      (condition) => {
        const palettes = TIMES_OF_DAY.map((time) =>
          getWeatherPalette(condition, time).gradient.join(),
        );

        // A storm at noon and a storm at midnight are both just a storm.
        expect(new Set(palettes).size).toBe(1);
      },
    );
  });

  describe('mild weather at night keeps a night sky', () => {
    it.each(['cloudy', 'rain', 'drizzle', 'partlyCloudy'] as const)(
      '%s at night does not brighten the sky',
      (condition) => {
        const night = getWeatherPalette(condition, 'night');
        const clearNight = getWeatherPalette('clear', 'night');

        // Applying a daytime cloud wash after sunset would produce an
        // implausibly bright night sky.
        expect(night.gradient).toEqual(clearNight.gradient);
      },
    );

    it('still signals the condition through the accent', () => {
      const cloudyNight = getWeatherPalette('cloudy', 'night');
      const clearNight = getWeatherPalette('clear', 'night');

      expect(cloudyNight.accent).not.toBe(clearNight.accent);
    });
  });

  describe('snow is the exception that needs dark content', () => {
    it('prefers dark content by day, because pale gradients swallow white text', () => {
      expect(getWeatherPalette('snow', 'day').prefersLightContent).toBe(false);
      expect(getWeatherPalette('sleet', 'day').prefersLightContent).toBe(false);
    });

    it('prefers light content at night, where the sky is dark again', () => {
      expect(getWeatherPalette('snow', 'night').prefersLightContent).toBe(true);
    });
  });

  it('is pure — repeated calls return equal results', () => {
    for (const [condition, time] of allCombinations) {
      expect(getWeatherPalette(condition, time)).toEqual(
        getWeatherPalette(condition, time),
      );
    }
  });
});

/** Rough relative luminance of a hex colour, for ordering comparisons. */
function luminanceOf(hex: string | undefined): number {
  if (hex === undefined) return 0;
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
