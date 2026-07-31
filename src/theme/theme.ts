import { darkColors } from './semantic/dark';
import { lightColors } from './semantic/light';
import type { ColorScheme, SemanticColors } from './semantic/types';
import { elevation, resolveElevation, type Elevation } from './tokens/elevation';
import { radii } from './tokens/radii';
import { MIN_TOUCH_TARGET, spacing } from './tokens/spacing';
import {
  fontSize,
  letterSpacing,
  resolveFont,
  resolveLineHeight,
  type FontWeight,
  type ResolvedFont,
  type Script,
} from './tokens/typography';

/**
 * The complete theme handed to components.
 *
 * Everything a component needs to style itself is here, so no component ever
 * imports a palette file directly (CLAUDE.md §18).
 */
export interface Theme {
  readonly scheme: ColorScheme;
  readonly colors: SemanticColors;
  readonly spacing: typeof spacing;
  readonly radii: typeof radii;
  readonly fontSize: typeof fontSize;
  readonly letterSpacing: typeof letterSpacing;
  readonly elevation: typeof elevation;
  readonly minTouchTarget: number;

  /**
   * Active script, driven by locale.
   *
   * Carried on the theme because typography is script-dependent: Persian needs
   * Vazirmatn and ~12% more line height than Latin at the same size.
   */
  readonly script: Script;
  /** Whether layout runs right-to-left. Read from here, never `I18nManager`. */
  readonly isRTL: boolean;

  /** Family and weight for the active script. Spread into a `TextStyle`. */
  font(weight: FontWeight): ResolvedFont;
  lineHeight(size: number): number;
  shadow(level: Elevation): ReturnType<typeof resolveElevation>;
}

export interface CreateThemeOptions {
  readonly scheme: ColorScheme;
  readonly script: Script;
  readonly isRTL: boolean;
}

export function createTheme({ scheme, script, isRTL }: CreateThemeOptions): Theme {
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return {
    scheme,
    colors,
    spacing,
    radii,
    fontSize,
    letterSpacing,
    elevation,
    minTouchTarget: MIN_TOUCH_TARGET,
    script,
    isRTL,

    font: (weight) => resolveFont(script, weight),
    lineHeight: (size) => resolveLineHeight(size, script),
    shadow: (level) => resolveElevation(level, colors.shadow),
  };
}
