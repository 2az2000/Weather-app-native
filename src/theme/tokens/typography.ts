/**
 * Typography — script-aware by design.
 *
 * **Persian is not Latin at a different size.** Arabic-script glyphs carry
 * ascenders and descenders that Latin does not, so at the same point size they
 * need materially more vertical room. Reusing Latin line-heights for Persian
 * produces text that looks cramped and clips diacritics (CLAUDE.md §18).
 *
 * That is why `lineHeightMultiplier` is per-script rather than a single constant.
 */

/**
 * Latin uses the SYSTEM font — SF Pro on iOS, Roboto on Android.
 *
 * This is a deliberate choice, not a fallback. The system font is what Apple
 * Weather itself uses; it participates in Dynamic Type, is already optimised for
 * the platform's rendering stack, and costs nothing in bundle size. Shipping a
 * custom Latin face would add ~3.5 MB to buy a difference most users cannot
 * name.
 *
 * Persian gets a bundled face because there is no equivalent choice: Arabic
 * script support in system fonts varies by OS version, and the metrics are not
 * tuned for Persian text at UI sizes.
 */
export const fontFamily = {
  /** `undefined` means "use the platform default". */
  latin: {
    regular: undefined,
    medium: undefined,
    semibold: undefined,
    bold: undefined,
  },
  arabic: {
    regular: 'Vazirmatn-Regular',
    medium: 'Vazirmatn-Medium',
    semibold: 'Vazirmatn-SemiBold',
    bold: 'Vazirmatn-Bold',
  },
} as const satisfies Record<string, Record<string, string | undefined>>;

export type Script = keyof typeof fontFamily;
export type FontWeight = keyof (typeof fontFamily)['latin'];

/**
 * Numeric weights, used for the system font.
 *
 * Vazirmatn carries its weight in the family name, so these apply to Latin only.
 * Setting both would double-bold a face that is already bold.
 */
const SYSTEM_FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<FontWeight, string>;

/** Font style for a script and weight, ready to spread into a `TextStyle`. */
export interface ResolvedFont {
  readonly fontFamily: string | undefined;
  readonly fontWeight: '400' | '500' | '600' | '700' | undefined;
}

export function resolveFont(script: Script, weight: FontWeight): ResolvedFont {
  return script === 'arabic'
    ? { fontFamily: fontFamily.arabic[weight], fontWeight: undefined }
    : { fontFamily: undefined, fontWeight: SYSTEM_FONT_WEIGHT[weight] };
}

/**
 * Line-height multipliers per script.
 *
 * Persian is ~12% looser. Verified against Vazirmatn's metrics — this is not an
 * arbitrary nudge.
 */
export const lineHeightMultiplier: Record<Script, number> = {
  latin: 1.35,
  arabic: 1.55,
};

/** Type scale. Names describe ROLE, not size, so the scale can be retuned. */
export const fontSize = {
  caption: 12,
  footnote: 13,
  body: 15,
  callout: 17,
  headline: 20,
  title3: 24,
  title2: 30,
  title1: 36,
  display: 48,
  /** Reserved for the home screen's current-temperature hero. */
  hero: 84,
} as const;

export type FontSize = keyof typeof fontSize;

export const letterSpacing = {
  tight: -0.4,
  normal: 0,
  wide: 0.4,
} as const;

/** Line height in points for a size and script. */
export function resolveLineHeight(size: number, script: Script): number {
  return Math.round(size * lineHeightMultiplier[script]);
}
