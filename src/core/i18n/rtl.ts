import { I18nManager } from 'react-native';

import { LOCALE_META, type Locale } from './locales';

/**
 * RTL layout direction.
 *
 * ⚠️ **`I18nManager.forceRTL` does not take effect until the app restarts.**
 * The native layout engine reads direction once at startup; flipping it at
 * runtime leaves the app in a half-mirrored state where some views have
 * re-laid-out and others have not (ADR-0006, CLAUDE.md §19).
 *
 * So direction changes are a two-step flow: persist the preference, then
 * restart. {@link needsRestartForLocale} tells the caller whether a restart is
 * actually required — switching between two LTR locales needs none.
 *
 * **Components must read `isRTL` from the theme, never from `I18nManager`.**
 * One accessor means one place to change if the mechanism does, and it keeps
 * `isRTL` mockable in tests.
 */

/** Whether the NATIVE layout engine is currently laying out right-to-left. */
export function isNativeRTL(): boolean {
  return I18nManager.isRTL;
}

/** Whether a locale wants right-to-left layout. */
export function localeIsRTL(locale: Locale): boolean {
  return LOCALE_META[locale].isRTL;
}

/**
 * Whether switching to `locale` requires an app restart.
 *
 * Only true when the DIRECTION changes. en → fa needs a restart; a future
 * en → de would not.
 */
export function needsRestartForLocale(locale: Locale): boolean {
  return localeIsRTL(locale) !== isNativeRTL();
}

/**
 * Tell the native layer which direction to use on the NEXT launch.
 *
 * Has no visible effect on the current session — call
 * {@link needsRestartForLocale} first and prompt the user before restarting.
 *
 * `allowRTL(true)` is unconditional: without it, `forceRTL` is ignored on
 * iOS, which is a common and confusing cause of "RTL does nothing".
 */
export function applyLayoutDirection(locale: Locale): void {
  const shouldBeRTL = localeIsRTL(locale);

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(shouldBeRTL);
}

/**
 * Mirror a horizontal translation for the current direction.
 *
 * ⚠️ **Reanimated gestures are NOT mirrored automatically.** A "swipe to next
 * day" gesture written for English moves the wrong way in Persian, and it is
 * easy to ship because it looks correct to a developer testing in English
 * (ADR-0006 trap #1).
 *
 * @param value - Translation in logical units (positive = "forward").
 * @param isRTL - Current direction, from the theme.
 *
 * @example
 * translateX.value = mirrorHorizontal(event.translationX, theme.isRTL);
 */
export function mirrorHorizontal(value: number, isRTL: boolean): number {
  if (!isRTL) return value;

  // `-0` is a real result of negating zero, and it survives into animation
  // values and serialised state where it compares unequal under `Object.is`.
  // Normalising here keeps a resting gesture indistinguishable from a
  // never-moved one.
  const mirrored = -value;
  return Object.is(mirrored, -0) ? 0 : mirrored;
}

/**
 * Direction multiplier for a chart's x-axis.
 *
 * ⚠️ **Skia has no concept of layout direction.** A canvas draws a time series
 * left-to-right regardless of locale, so in Persian a chart silently claims time
 * runs backwards — visually plausible and easy to miss (ADR-0006 trap #2).
 *
 * @returns `-1` under RTL, `1` otherwise.
 */
export function axisDirection(isRTL: boolean): 1 | -1 {
  return isRTL ? -1 : 1;
}
