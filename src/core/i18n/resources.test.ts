import { APP_ERROR_KINDS } from '@/core/errors';

import { LOCALES } from './locales';
import { NAMESPACES, resources } from './resources';

/**
 * Structural parity between locales.
 *
 * A key present in English but missing in Persian is invisible until a Persian
 * user hits that screen. Comparing key sets catches it at build time instead.
 */
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

describe('translation resources', () => {
  it('provides every namespace for every locale', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(resources[locale]).sort()).toEqual([...NAMESPACES].sort());
    }
  });

  describe.each(NAMESPACES)('%s namespace', (namespace) => {
    it('has identical keys in English and Persian', () => {
      const en = flattenKeys(resources.en[namespace]).sort();
      const fa = flattenKeys(resources.fa[namespace]).sort();

      expect(fa).toEqual(en);
    });

    it('has no empty Persian strings', () => {
      const values = JSON.stringify(resources.fa[namespace]);
      expect(values).not.toMatch(/:\s*""/);
    });

    it('actually translates rather than copying English', () => {
      // A namespace whose Persian is byte-identical to English is untranslated.
      expect(JSON.stringify(resources.fa[namespace])).not.toBe(
        JSON.stringify(resources.en[namespace]),
      );
    });
  });

  describe('errors namespace', () => {
    it('covers every AppError kind, so errorMessageKey() is total', () => {
      // CLAUDE.md §22 rule 4: every error must be user-translatable. If a kind
      // is added without a string, this fails rather than showing a raw key.
      for (const kind of APP_ERROR_KINDS) {
        expect(resources.en.errors).toHaveProperty(kind);
        expect(resources.fa.errors).toHaveProperty(kind);
      }
    });
  });
});
