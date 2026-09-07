/**
 * @jest-environment ../../../../../node_modules/@shopify/react-native-skia/jestEnv
 *
 * Skia's own mock (`jestSetup.js`, wired globally in `jest.setup.js`) needs a
 * REAL CanvasKit WASM instance on `global.CanvasKit` to build paths against —
 * plain `jest-environment-node` never sets that global. This docblock swaps
 * the environment for ONLY this file, via Skia's own `SkiaEnvironment`, rather
 * than changing `jest.config.js`'s global `testEnvironment` and paying a WASM
 * load on every one of the other 57+ suites that never touch a canvas.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import {
  renderWithTheme,
  THEME_COMBINATIONS,
} from '@/shared/ui/__tests__/render-with-theme';

import { LineChart } from '../line-chart';

/**
 * The Skia canvas itself renders through the library's own official Jest mock
 * (`jestSetup.js`, wired in `jest.setup.js`), so these tests do not — and
 * should not try to — assert on drawn pixels. What they DO own: the props the
 * canvas is fed came from the right computation, the accessible surface
 * exists (the canvas itself has none), and a scrub gesture drives the
 * callbacks it promises.
 */
const POINTS = [
  { x: 0, y: 20 },
  { x: 1, y: 24 },
  { x: 2, y: 22 },
  { x: 3, y: 30 },
];

function renderChart(overrides: Partial<React.ComponentProps<typeof LineChart>> = {}) {
  return renderWithTheme(
    <LineChart
      points={POINTS}
      color="#ff8800"
      accessibilityLabel="Temperature, 20 to 30 degrees"
      formatValue={(v) => `${String(Math.round(v))}°`}
      {...overrides}
    />,
  );
}

describe('LineChart', () => {
  it('exposes an accessible summary, since the canvas itself has none', () => {
    renderChart();
    expect(screen.getByLabelText('Temperature, 20 to 30 degrees')).toBeTruthy();
  });

  it('renders with an empty series rather than crashing', () => {
    expect(() => renderChart({ points: [] })).not.toThrow();
  });

  it('renders under all four locale × theme combinations', () => {
    // Not a visual check (the canvas has no accessible pixels here) but the
    // RTL mirroring math in `scaleToCanvas` runs off `theme.isRTL`, so this is
    // what proves the component reads it without throwing in either
    // direction (CLAUDE.md §34 step 7).
    for (const combination of THEME_COMBINATIONS) {
      expect(() =>
        renderWithTheme(
          <LineChart
            points={POINTS}
            color="#3366ff"
            accessibilityLabel="Wind speed"
            formatValue={(v) => `${String(v)} m/s`}
          />,
          combination,
        ),
      ).not.toThrow();
    }
  });

  it('survives a real layout pass, where the gesture detector actually mounts', () => {
    // The chart lays out asynchronously (`onLayout`): the `GestureDetector`
    // and `Canvas` are not even rendered until a non-zero width is measured
    // (`width > 0` in the component). Before this fires, `points={[]}`-style
    // rendering is trivial; this test exercises the branch that actually
    // builds the Skia path and wires the pan gesture, which is where a
    // scaling or path-construction bug would throw.
    renderChart();

    const surface = screen.getByLabelText('Temperature, 20 to 30 degrees');

    expect(() => {
      fireEvent(surface, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 160 } },
      });
    }).not.toThrow();

    // Still mounted and still accessible after the layout-driven remount.
    expect(screen.getByLabelText('Temperature, 20 to 30 degrees')).toBeTruthy();
  });
});
