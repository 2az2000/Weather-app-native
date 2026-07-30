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

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  moduleNameMapper: {
    // Must stay in sync with tsconfig.json `paths` and babel.config.js `alias`.
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/theme/(.*)$': '<rootDir>/src/theme/$1',
  },

  testMatch: ['**/*.test.ts', '**/*.test.tsx'],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__fixtures__/**',
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
  },

  clearMocks: true,
  restoreMocks: true,
};
