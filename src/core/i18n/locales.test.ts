import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_META,
  LOCALES,
  resolveLocale,
} from './locales';

describe('locales', () => {
  it('declares metadata for every supported locale', () => {
    expect(Object.keys(LOCALE_META).sort()).toEqual([...LOCALES].sort());
  });

  it('marks Persian as RTL, Arabic-script, Persian-digit and Jalali', () => {
    expect(LOCALE_META.fa).toMatchObject({
      isRTL: true,
      script: 'arabic',
      usesPersianDigits: true,
      usesJalaliCalendar: true,
    });
  });

  it('names each locale in its own language', () => {
    expect(LOCALE_META.fa.nativeName).toBe('فارسی');
    expect(LOCALE_META.en.nativeName).toBe('English');
  });

  describe('isSupportedLocale', () => {
    it.each(LOCALES)('accepts %s', (locale) => {
      expect(isSupportedLocale(locale)).toBe(true);
    });

    it('rejects an unsupported tag', () => {
      expect(isSupportedLocale('de')).toBe(false);
    });
  });

  describe('resolveLocale', () => {
    it('matches on the primary subtag', () => {
      expect(resolveLocale('fa-IR')).toBe('fa');
      expect(resolveLocale('en-GB')).toBe('en');
    });

    it('resolves Dari to Persian rather than falling back to English', () => {
      expect(resolveLocale('fa-AF')).toBe('fa');
    });

    it('is case-insensitive', () => {
      expect(resolveLocale('FA-ir')).toBe('fa');
    });

    it('falls back for an unsupported language', () => {
      expect(resolveLocale('de-DE')).toBe(DEFAULT_LOCALE);
    });

    it.each([null, undefined, ''])('falls back for %p', (value) => {
      expect(resolveLocale(value)).toBe(DEFAULT_LOCALE);
    });
  });
});
