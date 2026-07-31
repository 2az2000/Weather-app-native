import { palette } from '../tokens/colors';

import type { SemanticColors } from './types';

/** Light theme: raw palette → meaning. */
export const lightColors: SemanticColors = {
  background: palette.grey0,
  surface: palette.white,
  surfaceElevated: palette.white,
  surfacePressed: palette.grey50,

  // Glass sits over a light, often bright, weather gradient — so the fill is a
  // white wash and the blur is gentler than in dark, where more separation is
  // needed.
  glassFill: 'rgba(255, 255, 255, 0.55)',
  glassBorder: 'rgba(255, 255, 255, 0.75)',
  glassIntensity: 40,

  textPrimary: palette.grey800,
  textSecondary: palette.grey500,
  textTertiary: palette.grey400,
  textOnAccent: palette.white,
  // Weather backgrounds in light mode still run dark (dusk, storm, night), so
  // text drawn over them stays white in BOTH themes.
  textOnWeather: palette.white,
  textDisabled: palette.grey300,

  border: palette.grey100,
  borderStrong: palette.grey200,
  separator: palette.grey100,

  accent: palette.blue600,
  accentPressed: palette.blue700,
  accentSubtle: palette.blue50,
  focusRing: palette.blue400,

  success: palette.green600,
  warning: palette.amber600,
  danger: palette.red600,
  info: palette.blue600,
  successSubtle: palette.green100,
  warningSubtle: palette.amber100,
  dangerSubtle: palette.red100,

  shadow: palette.grey900,
  overlay: 'rgba(16, 24, 40, 0.45)',
  skeletonBase: palette.grey100,
  skeletonHighlight: palette.grey50,
};
