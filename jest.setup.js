/* eslint-disable no-undef */
import '@shopify/react-native-skia/jestSetup';

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

// ROADMAP Phase 6: Skia has no real GPU in a Node test environment, so the
// package's OWN official CanvasKit-backed mock (imported above) stands in for
// it. Hand-rolling this would mean re-deriving every prop shape
// `<Canvas>`/`<Path>`/`<Circle>` accept — the maintainers already did that
// work and keep it in step with the library, which a local mock would not.
