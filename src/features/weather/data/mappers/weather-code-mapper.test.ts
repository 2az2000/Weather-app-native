import { WEATHER_CONDITIONS, type WeatherCondition } from '../../domain';

import { fromOpenWeatherCode, fromWmoCode } from './weather-code-mapper';

/**
 * The two code tables that make the providers interchangeable.
 *
 * Both must land on the SAME condition for the same real sky — otherwise the
 * background gradient and the icon would change on failover, which is the one
 * moment the user should notice nothing (CLAUDE.md §11).
 */
describe('fromWmoCode', () => {
  it.each([
    [0, 'clear'],
    [1, 'clear'],
    [2, 'partlyCloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'drizzle'],
    [55, 'drizzle'],
    [61, 'rain'],
    [65, 'heavyRain'],
    [71, 'snow'],
    [75, 'snow'],
    [80, 'rain'],
    [82, 'heavyRain'],
    [85, 'snow'],
    [95, 'thunderstorm'],
    [99, 'thunderstorm'],
  ] as const)('maps WMO %s to %s', (code, expected) => {
    expect(fromWmoCode(code)).toBe(expected);
  });

  it('treats freezing drizzle and freezing rain as sleet', () => {
    // They sit inside the drizzle and rain ranges but behave — and look —
    // like sleet.
    expect(fromWmoCode(56)).toBe('sleet');
    expect(fromWmoCode(66)).toBe('sleet');
  });

  it('degrades an unknown code to a plausible sky rather than throwing', () => {
    // A code added to the standard after this table was written must not break
    // the screen (CLAUDE.md §31 — fail gracefully in production).
    expect(fromWmoCode(9999)).toBe('cloudy');
    expect(fromWmoCode(-1)).toBe('cloudy');
  });

  it('only ever returns a declared condition', () => {
    for (let code = 0; code <= 100; code += 1) {
      expect(WEATHER_CONDITIONS).toContain(fromWmoCode(code));
    }
  });
});

describe('fromOpenWeatherCode', () => {
  it.each([
    [200, 'thunderstorm'],
    [232, 'thunderstorm'],
    [300, 'drizzle'],
    [321, 'drizzle'],
    [500, 'rain'],
    [501, 'rain'],
    [502, 'heavyRain'],
    [504, 'heavyRain'],
    [600, 'snow'],
    [622, 'snow'],
    [701, 'fog'],
    [781, 'fog'],
    [800, 'clear'],
    [801, 'partlyCloudy'],
    [802, 'partlyCloudy'],
    [803, 'cloudy'],
    [804, 'cloudy'],
  ] as const)('maps OpenWeather %s to %s', (code, expected) => {
    expect(fromOpenWeatherCode(code)).toBe(expected);
  });

  it('treats 511 as sleet despite sitting in the rain range', () => {
    // Freezing rain. Worth the special case: it looks and feels different from
    // rain, and dressing for it differs too.
    expect(fromOpenWeatherCode(511)).toBe('sleet');
  });

  it('treats the 611–616 mixes as sleet', () => {
    expect(fromOpenWeatherCode(611)).toBe('sleet');
    expect(fromOpenWeatherCode(616)).toBe('sleet');
  });

  it('maps the whole atmosphere group to reduced visibility', () => {
    // Mist, smoke, haze, dust, sand, ash — all reduce visibility, which is what
    // `fog` conveys to a user.
    for (const code of [701, 711, 721, 731, 741, 751, 761, 771, 781]) {
      expect(fromOpenWeatherCode(code)).toBe('fog');
    }
  });

  it('degrades an unknown code rather than throwing', () => {
    expect(fromOpenWeatherCode(1234)).toBe('cloudy');
  });

  it('only ever returns a declared condition', () => {
    for (let code = 200; code <= 810; code += 1) {
      expect(WEATHER_CONDITIONS).toContain(fromOpenWeatherCode(code));
    }
  });
});

describe('cross-provider agreement', () => {
  /**
   * Pairs of codes that describe the SAME real sky in the two schemes.
   *
   * If a pair diverges, the icon and background would change on failover.
   */
  it.each([
    ['clear sky', 0, 800],
    ['few clouds', 2, 801],
    ['overcast', 3, 804],
    ['fog', 45, 741],
    ['drizzle', 51, 300],
    ['rain', 61, 501],
    ['heavy rain', 65, 502],
    ['snow', 71, 601],
    ['thunderstorm', 95, 200],
  ] as const)('agrees on %s', (_label, wmo, openWeather) => {
    const fromMeteo: WeatherCondition = fromWmoCode(wmo);
    const fromWeather: WeatherCondition = fromOpenWeatherCode(openWeather);

    expect(fromMeteo).toBe(fromWeather);
  });
});
