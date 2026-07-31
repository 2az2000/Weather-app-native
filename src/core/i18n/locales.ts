/**
 * Supported locales.
 *
 * English and Persian are BOTH first-class (CLAUDE.md §19). Persian is not a
 * translation layer over an English app — it has its own script, its own digits,
 * its own calendar, and its own layout direction.
 */
export const LOCALES = ['en', 'fa'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

interface LocaleMeta {
  /** Endonym — shown in the language picker, in its own language. */
  readonly nativeName: string;
  readonly englishName: string;
  readonly isRTL: boolean;
  /** Which font family and line-height band this locale needs. */
  readonly script: 'latin' | 'arabic';
  /** BCP 47 tag for `Intl` and Day.js. */
  readonly tag: string;
  /** Whether numbers render with Persian-Indic digits (۰۱۲۳). */
  readonly usesPersianDigits: boolean;
  /** Whether dates default to the Jalali (Solar Hijri) calendar. */
  readonly usesJalaliCalendar: boolean;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    nativeName: 'English',
    englishName: 'English',
    isRTL: false,
    script: 'latin',
    tag: 'en-US',
    usesPersianDigits: false,
    usesJalaliCalendar: false,
  },
  fa: {
    nativeName: 'فارسی',
    englishName: 'Persian',
    isRTL: true,
    script: 'arabic',
    tag: 'fa-IR',
    usesPersianDigits: true,
    usesJalaliCalendar: true,
  },
};

/** Narrow an arbitrary string to a supported locale. */
export function isSupportedLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Best supported locale for a device language tag.
 *
 * Matches on the primary subtag, so `fa-AF` (Dari) resolves to Persian rather
 * than silently falling back to English.
 */
export function resolveLocale(deviceTag: string | null | undefined): Locale {
  if (deviceTag == null) return DEFAULT_LOCALE;

  const primary = deviceTag.split('-')[0]?.toLowerCase() ?? '';
  return isSupportedLocale(primary) ? primary : DEFAULT_LOCALE;
}
