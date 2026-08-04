import { useMemo } from 'react';

import { useContainer } from '@/core/di';
import type { Coordinates } from '@/shared/types';
import { getWeatherPalette, type WeatherPalette } from '@/theme';

import type { MoonInfo, SunTimes, WeatherCondition } from '../../domain';

/**
 * The visual appearance of the current sky.
 *
 * The background is a DERIVATION of weather state, not styling decided in a
 * component (CLAUDE.md §18). This hook is the single place that derivation
 * happens, so every screen showing weather gets the same sky for the same
 * conditions.
 *
 * Astronomy is computed on-device, so the palette is correct with no network
 * at all — the background does not wait for a forecast to know whether it is
 * night (ADR-0008).
 */
export interface WeatherAppearance {
  readonly palette: WeatherPalette;
  readonly sun: SunTimes;
  readonly moon: MoonInfo;
  readonly isDaytime: boolean;
}

export function useWeatherAppearance(
  coordinates: Coordinates | undefined,
  condition: WeatherCondition | undefined,
  /** Injected so a test can pin the sky without faking timers. */
  now: Date = new Date(),
): WeatherAppearance | undefined {
  const { astronomy } = useContainer();

  // Recomputed only when the inputs change. This runs on the render path of the
  // background, so a new object every render would defeat the memo on every
  // gradient below it.
  const timestamp = now.getTime();

  return useMemo(() => {
    if (coordinates === undefined) return undefined;

    const at = new Date(timestamp);
    const timeOfDay = astronomy.getTimeOfDay(at, coordinates);

    return {
      // A clear sky is the honest default before a forecast arrives: the
      // time-of-day gradient is already correct, so the background paints on
      // the first frame and only refines when conditions load.
      palette: getWeatherPalette(condition ?? 'clear', timeOfDay),
      sun: astronomy.getSunTimes(at, coordinates),
      moon: astronomy.getMoonInfo(at, coordinates),
      isDaytime: astronomy.isDaytime(at, coordinates),
    };
  }, [astronomy, coordinates, condition, timestamp]);
}
