/**
 * Spacing scale — a strict 4pt grid.
 *
 * A fixed scale is what makes independently-built screens look like one product.
 * Magic numbers in components are banned by lint (CLAUDE.md §15); if a value
 * here does not fit, the design needs a decision, not an inline override.
 */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
  giant: 72,
} as const;

export type Spacing = keyof typeof spacing;

/**
 * Minimum touch target, in points.
 *
 * 44pt is the floor in both the iOS HIG and WCAG 2.5.5. Anything smaller is an
 * accessibility defect, not a design choice (CLAUDE.md §34 step 6).
 */
export const MIN_TOUCH_TARGET = 44;
