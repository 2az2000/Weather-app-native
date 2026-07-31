import { palette } from '../tokens/colors';

/**
 * Dynamic weather palette — layer 3 of 3.
 *
 * The background is a **derivation of weather state**, not styling scattered
 * across screens (CLAUDE.md §18). `getWeatherPalette` is a pure function, so the
 * entire visual identity of the app is unit-testable without rendering anything.
 *
 * It lives in `theme/` rather than in the weather feature because `theme/`
 * depends on nothing, and a feature importing it must not create a cycle.
 */

/**
 * Sky conditions the app distinguishes visually.
 *
 * Deliberately coarser than a provider's weather-code list: WMO defines 28+
 * codes, but they collapse into far fewer *skies*. Mapping code → condition is
 * the data layer's job (Phase 4); this module only knows about skies.
 */
export const WEATHER_CONDITIONS = [
  'clear',
  'partlyCloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'heavyRain',
  'snow',
  'sleet',
  'thunderstorm',
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

/**
 * Time-of-day bands.
 *
 * Derived from solar elevation rather than the clock, so the palette is correct
 * at any latitude and season — 6pm is golden hour in one place and the middle of
 * the night in another. `AstronomyCalculator` (Phase 4) supplies the elevation.
 */
export const TIMES_OF_DAY = ['dawn', 'day', 'dusk', 'night'] as const;

export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export interface WeatherPalette {
  /** Gradient stops, top to bottom. At least two. */
  readonly gradient: readonly [string, string, ...string[]];
  /** Tint for particle effects and weather iconography. */
  readonly accent: string;
  /**
   * Whether content over this background should use light text.
   *
   * Precomputed rather than derived at render time so a component never has to
   * do luminance maths, and so it is directly testable.
   */
  readonly prefersLightContent: boolean;
}

/** Base sky for each time band, before weather is applied. */
const SKY_BY_TIME: Record<TimeOfDay, WeatherPalette> = {
  dawn: {
    gradient: [palette.indigo500, palette.skyDawn, palette.amber300],
    accent: palette.amber400,
    prefersLightContent: true,
  },
  day: {
    gradient: [palette.blue600, palette.skyDay, palette.blue200],
    accent: palette.blue700,
    prefersLightContent: true,
  },
  dusk: {
    gradient: [palette.indigo700, palette.skyDusk, palette.orange400],
    accent: palette.orange500,
    prefersLightContent: true,
  },
  night: {
    gradient: [palette.skyNight, palette.indigo900, palette.grey800],
    accent: palette.indigo400,
    prefersLightContent: true,
  },
};

/**
 * Conditions that override the sky entirely.
 *
 * Heavy weather flattens the sky — a thunderstorm at noon and at dusk look far
 * more like each other than either looks like its clear-sky counterpart. Light
 * conditions instead *tint* the time-of-day sky, which is why the two are
 * handled separately below.
 */
const OVERRIDING_CONDITIONS: Partial<Record<WeatherCondition, WeatherPalette>> = {
  heavyRain: {
    gradient: [palette.grey700, palette.skyStorm, palette.grey600],
    accent: palette.blue300,
    prefersLightContent: true,
  },
  thunderstorm: {
    gradient: [palette.grey900, palette.skyStorm, palette.indigo900],
    accent: palette.purple400,
    prefersLightContent: true,
  },
  fog: {
    gradient: [palette.grey400, palette.skyOvercast, palette.grey300],
    accent: palette.grey200,
    prefersLightContent: true,
  },
};

/** Conditions that blend a wash over the time-of-day sky. */
const CONDITION_TINT: Partial<Record<WeatherCondition, WeatherPalette>> = {
  partlyCloudy: {
    gradient: [palette.blue500, palette.skyDay, palette.grey200],
    accent: palette.grey100,
    prefersLightContent: true,
  },
  cloudy: {
    gradient: [palette.grey500, palette.skyOvercast, palette.grey200],
    accent: palette.grey300,
    prefersLightContent: true,
  },
  drizzle: {
    gradient: [palette.grey500, palette.skyOvercast, palette.blue300],
    accent: palette.blue400,
    prefersLightContent: true,
  },
  rain: {
    gradient: [palette.grey600, palette.skyStorm, palette.blue400],
    accent: palette.blue300,
    prefersLightContent: true,
  },
  snow: {
    gradient: [palette.grey300, palette.blue100, palette.white],
    accent: palette.blue200,
    // The only palette dark content reads better on — snow gradients are pale
    // enough that white text disappears.
    prefersLightContent: false,
  },
  sleet: {
    gradient: [palette.grey400, palette.blue200, palette.grey200],
    accent: palette.teal300,
    prefersLightContent: false,
  },
};

/**
 * Resolve the background palette for the current sky.
 *
 * @param condition - The sky condition.
 * @param timeOfDay - The solar band.
 * @returns Gradient stops, an accent, and whether to use light content.
 *
 * @example
 * const { gradient } = getWeatherPalette('clear', 'night');
 */
export function getWeatherPalette(
  condition: WeatherCondition,
  timeOfDay: TimeOfDay,
): WeatherPalette {
  // Severe weather dominates the sky regardless of the hour.
  const overriding = OVERRIDING_CONDITIONS[condition];
  if (overriding !== undefined) return overriding;

  // A clear sky IS the time-of-day sky.
  if (condition === 'clear') return SKY_BY_TIME[timeOfDay];

  const tint = CONDITION_TINT[condition];
  if (tint === undefined) return SKY_BY_TIME[timeOfDay];

  // At night, weather is barely visible — the sky stays dark and only the accent
  // carries the condition. Applying a daytime cloud wash after sunset produces
  // an implausibly bright night sky.
  if (timeOfDay === 'night') {
    return {
      gradient: SKY_BY_TIME.night.gradient,
      accent: tint.accent,
      prefersLightContent: true,
    };
  }

  return tint;
}
