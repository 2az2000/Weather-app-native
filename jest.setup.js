/* eslint-disable no-undef */
/**
 * Jest setup.
 *
 * Per CLAUDE.md §26, the network is NEVER real in tests. Domain tests should
 * need no mocking at all — if a use case requires `jest.mock`, its dependencies
 * are wrong and should be injected as a fake implementing the interface.
 *
 * Feature-specific mocks (MMKV, SQLite, Reanimated, Skia) are registered here
 * as those libraries are introduced in their respective phases.
 */

// Fail a test that performs a real network call, rather than letting it hang
// or silently hit the internet.
global.fetch = jest.fn(() => {
  throw new Error(
    'Real network calls are forbidden in tests (CLAUDE.md §26). Use MSW or a fake data source.',
  );
});
