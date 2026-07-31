import type { ViewStyle } from 'react-native';

/**
 * Elevation — shadow on iOS, `elevation` on Android.
 *
 * The two platforms model depth differently and neither can be derived from the
 * other, so both are specified per level. Keeping them together here prevents
 * the common bug where a shadow is tuned on iOS and silently absent on Android.
 *
 * Shadow colour comes from the SEMANTIC layer, since it differs between light
 * and dark. These levels carry only geometry and opacity.
 */
export interface ElevationStyle {
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
}

export const elevation = {
  none: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** Resting cards. */
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  /** Raised cards, the default for content surfaces. */
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  /** Sheets and popovers. */
  lg: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  /** Modals. */
  xl: {
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 16,
  },
} as const satisfies Record<string, ElevationStyle>;

export type Elevation = keyof typeof elevation;

/** Combine an elevation level with the theme's shadow colour. */
export function resolveElevation(level: Elevation, shadowColor: string): ViewStyle {
  return { ...elevation[level], shadowColor };
}
