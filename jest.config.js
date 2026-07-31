/**
 * Jest configuration.
 *
 * Coverage thresholds encode CLAUDE.md §26: the domain layer carries the
 * highest value density (pure logic, zero mocks) and therefore the highest bar.
 * Per-layer thresholds are raised as each layer is built out — see ROADMAP
 * phase Definitions of Done.
 */
module.exports = {
  preset: 'jest-expo',

  // Reanimated 4 moved its worklet runtime into react-native-worklets, whose
  // `.native` entry points require a JSI binding that does not exist in Node.
  // This official resolver strips the `.native` extension so the plain JS
  // implementation is used instead.
  resolver: 'react-native-worklets/jest/resolver',

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
