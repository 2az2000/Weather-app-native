import { changeLanguage, createI18n, localeMetaOf } from './i18n';
import { LOCALE_META } from './locales';

describe('createI18n', () => {
  it('starts in the requested locale', () => {
    expect(createI18n('fa').language).toBe('fa');
  });

  it('defaults to English', () => {
    expect(createI18n().language).toBe('en');
  });

  it('creates independent instances rather than mutating a global', () => {
    const english = createI18n('en');
    const persian = createI18n('fa');

    // Sharing one instance would mean a language switch in one place silently
    // changing another — and would make these tests order-dependent.
    expect(english.language).toBe('en');
    expect(persian.language).toBe('fa');
  });

  describe('translation lookup', () => {
    it('resolves a namespaced key in English', () => {
      expect(createI18n('en').t('common:actions.retry')).toBe('Try again');
    });

    it('resolves the same key in Persian', () => {
      expect(createI18n('fa').t('common:actions.retry')).toBe('تلاش دوباره');
    });

    it('uses `common` as the default namespace', () => {
      expect(createI18n('en').t('actions.cancel')).toBe('Cancel');
    });

    it('resolves an error message for every AppError kind', () => {
      const instance = createI18n('fa');
      expect(instance.t('errors:network')).toContain('اینترنت');
    });

    it('interpolates values without escaping them', () => {
      // React escapes rendered output already; escaping here would
      // double-encode apostrophes and Persian punctuation.
      const result = createI18n('en').t('common:state.updatedAt', { time: '5 min ago' });
      expect(result).toBe('Updated 5 min ago');
    });
  });

  describe('changeLanguage', () => {
    it('switches the active language', async () => {
      const instance = createI18n('en');

      await changeLanguage(instance, 'fa');

      expect(instance.language).toBe('fa');
      expect(instance.t('common:actions.close')).toBe('بستن');
    });

    it('does not alter layout direction, which is handled separately', async () => {
      // Direction only changes on restart (ADR-0006), so changing the language
      // must NOT try to flip it — the two are deliberately decoupled.
      const instance = createI18n('en');
      await changeLanguage(instance, 'fa');

      expect(instance.language).toBe('fa');
    });
  });

  describe('localeMetaOf', () => {
    it('returns metadata for the active locale', () => {
      expect(localeMetaOf(createI18n('fa'))).toBe(LOCALE_META.fa);
      expect(localeMetaOf(createI18n('en'))).toBe(LOCALE_META.en);
    });

    it('falls back to the default when the language is unrecognised', async () => {
      const instance = createI18n('en');
      await instance.changeLanguage('de');

      expect(localeMetaOf(instance)).toBe(LOCALE_META.en);
    });
  });
});
