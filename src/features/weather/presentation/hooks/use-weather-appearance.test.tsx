import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ContainerProvider } from '@/core/di';
import { createFakeContainer } from '@/core/di/__tests__/fake-container';

import { useWeatherAppearance } from './use-weather-appearance';

/**
 * The background is a DERIVATION of weather state (CLAUDE.md §18), and this
 * hook is where the derivation happens — so it is testable without rendering a
 * single pixel.
 *
 * Astronomy is computed on-device, so every case here runs with the network
 * disabled by `jest.setup.js` (ADR-0008).
 */
describe('useWeatherAppearance', () => {
  const TEHRAN = { latitude: 35.6892, longitude: 51.389 };
  const TROMSO = { latitude: 69.6492, longitude: 18.9553 };

  // 09:00 UTC is early afternoon in Tehran; 20:30 UTC is the middle of the night.
  const AFTERNOON = new Date('2026-06-21T09:00:00Z');
  const NIGHT = new Date('2026-06-21T20:30:00Z');

  function wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <ContainerProvider container={createFakeContainer()}>{children}</ContainerProvider>
    );
  }

  const renderAppearance = (
    coordinates: typeof TEHRAN | undefined,
    condition: 'clear' | 'thunderstorm' | 'snow' | undefined,
    now: Date,
  ) =>
    renderHook(() => useWeatherAppearance(coordinates, condition, now), { wrapper })
      .result.current;

  it('returns nothing before a location resolves', () => {
    expect(renderAppearance(undefined, 'clear', AFTERNOON)).toBeUndefined();
  });

  it('produces a palette WITHOUT a forecast, so the sky paints on frame one', () => {
    // The time-of-day gradient is already correct before any condition is
    // known, which is what lets the background render immediately.
    const appearance = renderAppearance(TEHRAN, undefined, AFTERNOON);

    expect(appearance?.palette.gradient.length).toBeGreaterThanOrEqual(2);
  });

  it('gives a clear afternoon a different sky from a clear night', () => {
    const day = renderAppearance(TEHRAN, 'clear', AFTERNOON);
    const night = renderAppearance(TEHRAN, 'clear', NIGHT);

    expect(day?.palette.gradient).not.toEqual(night?.palette.gradient);
    expect(day?.isDaytime).toBe(true);
    expect(night?.isDaytime).toBe(false);
  });

  it('lets severe weather override the time of day', () => {
    const clear = renderAppearance(TEHRAN, 'clear', AFTERNOON);
    const storm = renderAppearance(TEHRAN, 'thunderstorm', AFTERNOON);

    expect(storm?.palette.gradient).not.toEqual(clear?.palette.gradient);
  });

  it('reports snow as needing dark content, the one palette that does', () => {
    const snow = renderAppearance(TEHRAN, 'snow', AFTERNOON);

    expect(snow?.palette.prefersLightContent).toBe(false);
  });

  it('supplies sun times and moon information alongside the palette', () => {
    const appearance = renderAppearance(TEHRAN, 'clear', AFTERNOON);

    expect(appearance?.sun.solarNoon).toBeInstanceOf(Date);
    expect(appearance?.moon.phase).toBeTruthy();
    expect(appearance?.moon.illumination).toBeGreaterThanOrEqual(0);
  });

  it('handles polar day, where the sun never sets', () => {
    const appearance = renderAppearance(TROMSO, 'clear', AFTERNOON);

    // A real astronomical state, not a failure — the domain names it so the UI
    // does not have to guess from a missing sunrise.
    expect(appearance?.sun.polarState).toBe('polarDay');
    expect(appearance?.sun.sunset).toBeUndefined();
  });

  it('is stable for identical inputs, so downstream memos hold', () => {
    const first = renderAppearance(TEHRAN, 'clear', AFTERNOON);
    const second = renderAppearance(TEHRAN, 'clear', AFTERNOON);

    expect(first?.palette).toEqual(second?.palette);
  });
});
