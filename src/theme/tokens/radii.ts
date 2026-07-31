/**
 * Corner radii.
 *
 * `full` is a large constant rather than a percentage: React Native does not
 * resolve percentage radii consistently across platforms, and a value larger
 * than half the element always renders as a pill.
 */
export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export type Radius = keyof typeof radii;
