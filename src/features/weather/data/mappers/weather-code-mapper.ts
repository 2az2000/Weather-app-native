import type { WeatherCondition } from '../../domain';

/**
 * Provider weather codes → the app's shared condition vocabulary.
 *
 * This is the file that makes two providers interchangeable (CLAUDE.md §11).
 * Open-Meteo speaks WMO codes and OpenWeather has its own scheme; both collapse
 * into the same ten conditions, so nothing above the data layer can tell which
 * one answered.
 */

/**
 * WMO 4677 present-weather codes, as used by Open-Meteo.
 *
 * Grouped by what the sky LOOKS like, not by the standard's own taxonomy —
 * codes 51/53/55 are three drizzle intensities the user cannot distinguish at a
 * glance, so they share a condition.
 *
 * @see https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
 */
const WMO_CONDITIONS: Readonly<Record<number, WeatherCondition>> = {
  0: 'clear',
  1: 'clear', // mainly clear
  2: 'partlyCloudy',
  3: 'cloudy', // overcast

  45: 'fog',
  48: 'fog', // depositing rime fog

  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'sleet', // freezing drizzle
  57: 'sleet',

  61: 'rain',
  63: 'rain',
  65: 'heavyRain',
  66: 'sleet', // freezing rain
  67: 'sleet',

  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow', // snow grains

  80: 'rain', // rain showers
  81: 'rain',
  82: 'heavyRain', // violent showers
  85: 'snow', // snow showers
  86: 'snow',

  95: 'thunderstorm',
  96: 'thunderstorm', // with slight hail
  99: 'thunderstorm', // with heavy hail
};

/**
 * Map a WMO code to a condition.
 *
 * Unknown codes fall back to `cloudy` rather than throwing: a code the standard
 * added after this table was written should degrade to a plausible sky, not
 * break the screen (CLAUDE.md §31 — fail gracefully in production).
 */
export function fromWmoCode(code: number): WeatherCondition {
  return WMO_CONDITIONS[code] ?? 'cloudy';
}

/**
 * OpenWeather condition ids → the same vocabulary.
 *
 * OpenWeather groups by leading digit: 2xx thunderstorm, 3xx drizzle, 5xx rain,
 * 6xx snow, 7xx atmosphere, 800 clear, 80x clouds.
 *
 * @see https://openweathermap.org/weather-conditions
 */
export function fromOpenWeatherCode(code: number): WeatherCondition {
  if (code >= 200 && code < 300) return 'thunderstorm';
  if (code >= 300 && code < 400) return 'drizzle';

  if (code >= 500 && code < 600) {
    // 511 is freezing rain, which sits inside the rain range but behaves like
    // sleet — worth the special case, since the two look and feel different.
    if (code === 511) return 'sleet';
    // 502+ are heavy and very heavy rain.
    return code >= 502 ? 'heavyRain' : 'rain';
  }

  if (code >= 600 && code < 700) {
    // 611–616 are sleet and rain-and-snow mixes.
    return code >= 611 && code <= 616 ? 'sleet' : 'snow';
  }

  // 7xx is the "atmosphere" group: mist, smoke, haze, dust, fog, sand, ash.
  // All reduce visibility, which is what `fog` conveys.
  if (code >= 700 && code < 800) return 'fog';

  if (code === 800) return 'clear';

  if (code > 800 && code < 900) {
    // 801 few clouds, 802 scattered, 803 broken, 804 overcast.
    return code <= 802 ? 'partlyCloudy' : 'cloudy';
  }

  return 'cloudy';
}
