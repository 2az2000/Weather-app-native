// @ts-check
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');
const boundaries = require('eslint-plugin-boundaries');
const prettierConfig = require('eslint-config-prettier');

/**
 * ESLint configuration.
 *
 * This file is where the architecture stops being a document and becomes a
 * build gate (ADR-0007). Rules maintained by convention decay; rules that fail
 * CI cannot. If a rule here blocks the right outcome, change the rule in a PR —
 * do not add an inline suppression.
 */

const DOMAIN_PURITY_MESSAGE =
  'The domain layer must stay pure TypeScript (CLAUDE.md §6). It may not import React, React Native, Expo, HTTP, storage, or state libraries — that is what keeps business logic testable in plain Node with zero mocks. Pure utility libraries with no side effects (dayjs, suncalc) are the only exception.';

/** Three-or-more-level relative imports always cross a boundary. */
const RELATIVE_ESCAPE_PATTERN = {
  group: ['../../../*'],
  message:
    'Relative imports must not cross a feature or layer boundary. Use a path alias (@/core, @/features, @/shared, @/theme) — CLAUDE.md §14.',
};

/** CLAUDE.md §12 — TS enums have surprising runtime semantics and poor tree-shaking. */
const NO_TS_ENUM = {
  selector: 'TSEnumDeclaration',
  message:
    'TS enums have surprising runtime semantics and poor tree-shaking. Use an `as const` object with a derived union type (CLAUDE.md §12).',
};

/**
 * RTL: physical layout properties are banned (ADR-0006, CLAUDE.md §19).
 *
 * These must be matched as OBJECT LITERAL KEYS (`{ marginLeft: 8 }`), which is
 * how styles are actually written — `no-restricted-properties` only catches
 * member access (`styles.marginLeft`) and would silently never fire.
 */
const RTL_PHYSICAL_PROPERTIES = [
  ['marginLeft', 'marginStart'],
  ['marginRight', 'marginEnd'],
  ['paddingLeft', 'paddingStart'],
  ['paddingRight', 'paddingEnd'],
  ['borderLeftWidth', 'borderStartWidth'],
  ['borderRightWidth', 'borderEndWidth'],
  ['borderLeftColor', 'borderStartColor'],
  ['borderRightColor', 'borderEndColor'],
  ['borderTopLeftRadius', 'borderTopStartRadius'],
  ['borderTopRightRadius', 'borderTopEndRadius'],
  ['borderBottomLeftRadius', 'borderBottomStartRadius'],
  ['borderBottomRightRadius', 'borderBottomEndRadius'],
  ['left', 'start'],
  ['right', 'end'],
].flatMap(([physical, logical]) => [
  {
    selector: `Property[key.name="${physical}"]`,
    message: `Use \`${logical}\` instead of \`${physical}\` — physical properties do not mirror in Persian/RTL (CLAUDE.md §19, ADR-0006).`,
  },
  {
    selector: `Property[key.value="${physical}"]`,
    message: `Use \`${logical}\` instead of \`${physical}\` — physical properties do not mirror in Persian/RTL (CLAUDE.md §19, ADR-0006).`,
  },
]);

module.exports = defineConfig([
  expoConfig,

  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'coverage/**',
      'dist/**',
      '**/*.config.js',
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TypeScript
  // ───────────────────────────────────────────────────────────────────────────
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // CLAUDE.md §12 — `any` is banned. Use `unknown` and narrow.
      '@typescript-eslint/no-explicit-any': 'error',

      // `@ts-ignore` silences errors invisibly. `@ts-expect-error` fails when
      // the underlying problem is fixed, so it cannot rot.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],

      // CLAUDE.md §12 — no TS enums; use `as const` objects.
      // NOTE: restated in the RTL block below, because flat config REPLACES
      // rather than merges options for the same rule.
      'no-restricted-syntax': ['error', NO_TS_ENUM],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Global bans (CLAUDE.md §23, §32)
  // ───────────────────────────────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      // Use the `core/logger` facade instead — it routes to Reactotron in dev
      // and Sentry in prod, and redacts PII.
      'no-console': 'error',

      // A bare `catch {}` silently discards failures.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // False positive on libraries that expose both a default object and
      // matching named exports — `axios.create()` is axios's documented factory,
      // and the rule's suggested `import { create }` is not equivalent.
      'import/no-named-as-default-member': 'off',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // RTL: physical layout properties are banned (ADR-0006, CLAUDE.md §19)
  //
  // This is the highest-leverage rule in the file. A convention would be
  // violated within a week; a lint rule cannot be. Every `marginLeft` written
  // before RTL support would become a bug findable only by manual audit.
  // ───────────────────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', NO_TS_ENUM, ...RTL_PHYSICAL_PROPERTIES],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Architecture boundaries (ADR-0007)
  //
  // Element types are matched top-down, so the more specific feature-layer
  // patterns must be declared before the broader `core`/`shared` ones.
  // ───────────────────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*', 'app/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'app/**/*', mode: 'full' },
        {
          type: 'feature-domain',
          pattern: 'src/features/*/domain/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-data',
          pattern: 'src/features/*/data/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-presentation',
          pattern: 'src/features/*/presentation/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-barrel',
          pattern: 'src/features/*/index.ts',
          mode: 'full',
          capture: ['feature'],
        },
        { type: 'core', pattern: 'src/core/**/*', mode: 'full' },
        { type: 'shared', pattern: 'src/shared/**/*', mode: 'full' },
        { type: 'theme', pattern: 'src/theme/**/*', mode: 'full' },
      ],
    },
    rules: {
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-files': 'off',

      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            '${file.type} is not allowed to import ${dependency.type} — dependencies must point inward (CLAUDE.md §4, ADR-0007).',
          rules: [
            // ── domain: the sacred core ───────────────────────────────────────
            // Depends on NOTHING. Not on data, not on presentation, not on
            // core, not on another feature. This is what keeps business logic
            // testable in plain Node with zero mocks.
            {
              from: ['feature-domain'],
              allow: [['feature-domain', { feature: '${from.feature}' }]],
            },

            // ── data: implements domain interfaces ────────────────────────────
            // May use core infrastructure (http, storage) and its OWN domain.
            // Never presentation, never another feature's internals.
            {
              from: ['feature-data'],
              allow: [
                ['feature-domain', { feature: '${from.feature}' }],
                ['feature-data', { feature: '${from.feature}' }],
                'core',
                'shared',
                'feature-barrel',
              ],
            },

            // ── presentation: consumes use cases ──────────────────────────────
            // Explicitly NOT allowed to import `feature-data` — it must go
            // through domain interfaces. This is the rule that stops a
            // component reaching for a repository or Axios directly.
            {
              from: ['feature-presentation'],
              allow: [
                ['feature-domain', { feature: '${from.feature}' }],
                ['feature-presentation', { feature: '${from.feature}' }],
                'core',
                'shared',
                'theme',
                'feature-barrel',
              ],
            },

            // ── barrel: the feature's only public surface ─────────────────────
            {
              from: ['feature-barrel'],
              allow: [
                ['feature-domain', { feature: '${from.feature}' }],
                ['feature-data', { feature: '${from.feature}' }],
                ['feature-presentation', { feature: '${from.feature}' }],
              ],
            },

            // ── core & shared: sit BELOW features ─────────────────────────────
            // Must never import from features. An import here inverts the
            // dependency graph.
            { from: ['core'], allow: ['core'] },
            { from: ['shared'], allow: ['core', 'shared', 'theme'] },
            { from: ['theme'], allow: ['theme'] },

            // ── app: thin route files ─────────────────────────────────────────
            // May only reach features through their public barrels.
            {
              from: ['app'],
              allow: ['app', 'feature-barrel', 'core', 'shared', 'theme'],
            },
          ],
        },
      ],

      // Features are islands: only the public barrel may be imported from
      // outside (CLAUDE.md §7). This catches deep imports that
      // `element-types` alone would permit.
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          message:
            'Import features through their public barrel (`@/features/<name>`), not their internals (CLAUDE.md §7).',
          rules: [
            { target: ['feature-barrel'], allow: 'index.ts' },
            {
              target: ['feature-domain', 'feature-data', 'feature-presentation'],
              allow: '**/*',
            },
            { target: ['core', 'shared', 'theme', 'app'], allow: '**/*' },
          ],
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Relative imports must not cross a feature or layer boundary (CLAUDE.md §14)
  //
  // NOTE: `no-restricted-imports` is not merged across flat-config blocks — a
  // later block REPLACES an earlier one for the same file. The domain-purity
  // block below therefore restates this pattern rather than relying on it.
  // ───────────────────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [RELATIVE_ESCAPE_PATTERN] }],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Domain purity (CLAUDE.md §6)
  //
  // The boundaries plugin governs internal imports; this governs EXTERNAL ones.
  // The moment domain imports React, business logic stops being testable in a
  // plain Node process — which is the foundation everything else rests on.
  //
  // Declared AFTER the block above so it wins for domain files, and restates
  // the relative-escape pattern so that protection is not lost.
  // ───────────────────────────────────────────────────────────────────────────
  {
    files: ['src/features/*/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            'react',
            'react-native',
            'react-dom',
            'axios',
            'zod',
            'zustand',
            '@tanstack/react-query',
            'react-native-mmkv',
            'expo-sqlite',
          ].map((name) => ({
            name,
            message: DOMAIN_PURITY_MESSAGE,
          })),
          patterns: [
            RELATIVE_ESCAPE_PATTERN,
            {
              group: ['expo', 'expo-*', '@expo/*'],
              message: DOMAIN_PURITY_MESSAGE,
            },
            {
              group: ['react-native-*', '@react-native/*', '@shopify/*', '@gorhom/*'],
              message: DOMAIN_PURITY_MESSAGE,
            },
          ],
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Tests
  // ───────────────────────────────────────────────────────────────────────────
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      '**/__mocks__/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-imports': 'off',
    },
  },

  // Prettier last — turns off every rule that conflicts with formatting.
  prettierConfig,
]);
