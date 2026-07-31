export { ThemeProvider, useTheme } from './theme-provider';
export { createTheme } from './theme';
export type { Theme, CreateThemeOptions } from './theme';

export type { SemanticColors, ColorScheme } from './semantic/types';
export { lightColors } from './semantic/light';
export { darkColors } from './semantic/dark';

export { spacing, MIN_TOUCH_TARGET } from './tokens/spacing';
export type { Spacing } from './tokens/spacing';
export { radii } from './tokens/radii';
export type { Radius } from './tokens/radii';
export { elevation, resolveElevation } from './tokens/elevation';
export type { Elevation, ElevationStyle } from './tokens/elevation';
export {
  fontSize,
  letterSpacing,
  fontFamily,
  lineHeightMultiplier,
  resolveFont,
  resolveLineHeight,
} from './tokens/typography';
export type { FontSize, FontWeight, Script, ResolvedFont } from './tokens/typography';

export {
  getWeatherPalette,
  WEATHER_CONDITIONS,
  TIMES_OF_DAY,
} from './weather/conditions';
export type { WeatherCondition, TimeOfDay, WeatherPalette } from './weather/conditions';
