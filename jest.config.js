/**
 * Jest configuration.
 *
 * Coverage thresholds encode CLAUDE.md §26: the domain layer carries the
 * highest value density (pure logic, zero mocks) and therefore the highest bar.
 * Per-layer thresholds are raised as each layer is built out — see ROADMAP
 * phase Definitions of Done.
 */
/**
 * The timezone every test runs in.
 *
 * Several domain rules are deliberately expressed in the DEVICE's local time —
 * `GetDailyForecast` asks for "the user's today", not "today in UTC". That
 * makes them correct by design and environment-dependent by consequence, so the
 * environment has to be fixed or the assertions have nothing stable to compare
 * against.
 *
 * Without this, the suite passed on a machine at UTC+03:30 and failed in CI at
 * UTC — the fixtures had quietly been written around one author's offset. Half
 * hour zones (Iran, India, Newfoundland) are the sharp edge: zeroing local
 * minutes moves the underlying instant by thirty minutes, so a cutoff lands on
 * a different side of a data point.
 *
 * An explicit `TZ` is honoured so the choice stays AUDITABLE — running
 * `TZ=Asia/Kolkata npm test` re-checks that nothing has quietly re-acquired a
 * dependency on one offset. That audit is what surfaced this in the first
 * place, and a hard assignment would have made it impossible to repeat.
 */
process.env.TZ ??= 'UTC';

module.exports = {
  preset: 'jest-expo',

  // Reanimated 4 moved its worklet runtime into react-native-worklets, whose
  // `.native` entry points require a JSI binding that does not exist in Node.
  // This official resolver strips the `.native` extension so the plain JS
  // implementation is used instead.
  resolver: 'react-native-worklets/jest/resolver',

  // jest-expo's own `transformIgnorePatterns` (the negative-lookahead list
  // below) does not know about `@shopify/react-native-skia` — its Jest mock
  // (`lib/module/mock/index.js`, wired in `jest.setup.js`) ships ESM `import`
  // syntax that Babel never gets a chance to transform, since Jest skips
  // `node_modules` by default. Re-declaring the preset's list WITH Skia added
  // is the supported way to extend it; Jest does not merge array options.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@shopify/react-native-skia))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  moduleNameMapper: {
    // Must stay in sync with tsconfig.json `paths` and babel.config.js `alias`.
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@/core$': '<rootDir>/src/core',
    '^@/features$': '<rootDir>/src/features',
    '^@/shared$': '<rootDir>/src/shared',
    '^@/theme$': '<rootDir>/src/theme',
  },

  testMatch: ['**/*.test.ts', '**/*.test.tsx'],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__fixtures__/**',
    // Test helpers, not production code.
    '!src/**/__tests__/**',
    // Development-only gallery, redirected away in production builds.
    '!src/shared/ui/showcase/**',
  ],

  coverageThreshold: {
    // A ratchet, not an aspiration: these are set just below current coverage so
    // a regression fails CI. Raise them as each phase lands (ROADMAP DoD).
    './src/core/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/theme/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    // ROADMAP Phase 3 DoD: domain + mappers >= 95%. Both sit at 100%; the
    // ratchet is set just below so a regression fails CI.
    './src/features/locations/domain/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/features/locations/data/mappers/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    // ROADMAP Phase 4 DoD: domain >= 95%, mappers 100%. Mappers sit at 99.1%
    // statements / 100% functions; the remaining branches are defensive
    // fallbacks for provider shapes not present in the fixtures.
    './src/features/weather/domain/': {
      branches: 80,
      functions: 90,
      lines: 95,
      statements: 95,
    },
    './src/features/weather/data/mappers/': {
      branches: 80,
      functions: 100,
      lines: 100,
      statements: 95,
    },
    './src/features/weather/data/repositories/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/shared/': {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },

  clearMocks: true,
  restoreMocks: true,
};
