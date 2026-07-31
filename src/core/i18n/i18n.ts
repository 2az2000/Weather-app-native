import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, LOCALE_META, type Locale } from './locales';
import { DEFAULT_NAMESPACE, NAMESPACES, resources } from './resources';

/**
 * i18next bootstrap.
 *
 * Every user-facing string comes from here — hardcoded strings are a review
 * blocker (CLAUDE.md §19 rule 1).
 */

export function createI18n(locale: Locale = DEFAULT_LOCALE): I18nInstance {
  const instance = i18next.createInstance();

  void instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,

    interpolation: {
      // React already escapes rendered output; escaping again would double-encode
      // apostrophes and Persian punctuation.
      escapeValue: false,
    },

    returnNull: false,

    // Fail loudly in development, quietly in production (CLAUDE.md §31).
    // A missing key should be obvious while building, never a crash for a user.
    //
    // Spread conditionally rather than passing `undefined`: under
    // `exactOptionalPropertyTypes`, an explicit `undefined` is not the same as
    // an absent property, and i18next's type rejects it.
    saveMissing: __DEV__,
    ...(__DEV__
      ? {
          missingKeyHandler: (
            _languages: readonly string[],
            namespace: string,
            key: string,
          ): void => {
            throw new Error(`Missing translation: ${namespace}:${key}`);
          },
        }
      : {}),
  });

  return instance;
}

/** Change the active language. Layout direction is handled separately — see `rtl.ts`. */
export async function changeLanguage(
  instance: I18nInstance,
  locale: Locale,
): Promise<void> {
  await instance.changeLanguage(locale);
}

/** Metadata for the active locale of an instance. */
export function localeMetaOf(instance: I18nInstance): (typeof LOCALE_META)[Locale] {
  const language = instance.language;
  const locale = (language in LOCALE_META ? language : DEFAULT_LOCALE) as Locale;
  return LOCALE_META[locale];
}
