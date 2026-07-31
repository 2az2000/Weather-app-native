import { palette } from '../tokens/colors';

import type { SemanticColors } from './types';

/**
 * Dark theme: raw palette → meaning.
 *
 * Not an inversion of light. Two deliberate differences:
 *
 * 1. **Surfaces get lighter as they rise**, not darker. In dark UI, elevation
 *    reads as luminance, because a shadow is nearly invisible on a dark ground.
 * 2. **Accents shift lighter** (`blue500` rather than `blue600`). A mid-tone
 *    blue that passes contrast on white fails on near-black.
 */
export const darkColors: SemanticColors = {
  background: palette.grey950,
  surface: palette.grey900,
  surfaceElevated: palette.grey800,
  surfacePressed: palette.grey700,

  // Darker fill and stronger blur than light: over a night sky, a pale wash
  // would glow, and the panel needs more separation to read as a distinct layer.
  glassFill: 'rgba(16, 24, 40, 0.55)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassIntensity: 60,

  // Text steps are LIGHTER than their light-theme counterparts, not mirrored.
  // `grey400` works as tertiary on a near-white background but scores only
  // 4.03:1 on `grey950` — below the 4.5:1 WCAG AA floor. Every step here is
  // verified against the dark background, not assumed from the light theme.
  textPrimary: palette.grey50,
  textSecondary: palette.grey200,
  textTertiary: palette.grey300,
  textOnAccent: palette.white,
  textOnWeather: palette.white,
  textDisabled: palette.grey500,

  border: palette.grey700,
  borderStrong: palette.grey600,
  separator: palette.grey700,

  accent: palette.blue500,
  accentPressed: palette.blue400,
  accentSubtle: palette.blue900,
  focusRing: palette.blue300,

  // Status colours lighten too — the 600-weight versions used in light mode are
  // too dark to read against grey950.
  success: palette.green400,
  warning: palette.amber400,
  danger: palette.red400,
  info: palette.blue400,
  successSubtle: palette.green700,
  warningSubtle: palette.amber700,
  dangerSubtle: palette.red700,

  shadow: palette.black,
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeletonBase: palette.grey800,
  skeletonHighlight: palette.grey700,
};
