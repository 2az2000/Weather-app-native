import * as SunCalc from 'suncalc';

import type { Coordinates } from '@/shared/types';

import { degrees, percent, type Degrees, type Percent } from '../entities/units';

/**
 * Sun and moon, computed on-device.
 *
 * **Astronomy is not weather** (ADR-0008). Sun position and moon phase are
 * deterministic functions of a timestamp and a position, computed from orbital
 * mechanics known precisely for centuries. Unlike temperature they are not
 * measured, not forecast, and not uncertain.
 *
 * Computing rather than fetching means:
 * - it works **offline**, for any date, including ones never fetched
 * - it costs no request and no quota
 * - it is exact rather than interpolated
 * - it needs no provider that supplies moon data (Open-Meteo does not)
 *
 * This is a DOMAIN SERVICE, not a data source: it performs no I/O. `suncalc` is
 * permitted in the domain under the CLAUDE.md §6 exception for pure libraries
 * with no side effects.
 */

/** The eight named lunar phases. */
export const MOON_PHASES = [
  'new',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'full',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
] as const;

export type MoonPhase = (typeof MOON_PHASES)[number];

export interface SunTimes {
  readonly sunrise: Date | undefined;
  readonly sunset: Date | undefined;
  readonly solarNoon: Date;
  /** Civil dawn/dusk — the "golden hour" boundaries. */
  readonly dawn: Date | undefined;
  readonly dusk: Date | undefined;
}

export interface SunPosition {
  /** Degrees above the horizon. Negative means below. */
  readonly elevation: Degrees;
  readonly azimuth: Degrees;
  readonly isDaytime: boolean;
}

export interface MoonInfo {
  readonly phase: MoonPhase;
  /** Fraction of the disc lit, 0–100. */
  readonly illumination: Percent;
  /** Position in the cycle, 0–1. 0 and 1 are both new moon. */
  readonly phaseFraction: number;
  readonly moonrise: Date | undefined;
  readonly moonset: Date | undefined;
}

/**
 * Time-of-day band, derived from SOLAR ELEVATION rather than the clock.
 *
 * 6 pm is golden hour in one place and the middle of the night in another, so a
 * clock-based rule produces a wrong sky at high latitudes and in the wrong
 * season. Elevation is correct everywhere.
 *
 * Boundaries follow the standard twilight definitions:
 * - below -6°: night (past civil twilight)
 * - -6° to 6°: dawn or dusk, depending on whether the sun is rising
 * - above 6°: day
 */
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

const CIVIL_TWILIGHT_ELEVATION = -6;
const FULL_DAYLIGHT_ELEVATION = 6;

export class AstronomyCalculator {
  /**
   * Sunrise, sunset and twilight for a date and place.
   *
   * Times are `undefined` inside the polar circles during polar day or night,
   * where the sun genuinely does not cross the horizon. That is a real
   * astronomical fact, not a failure — the UI must handle it.
   */
  getSunTimes(date: Date, coordinates: Coordinates): SunTimes {
    const times = SunCalc.getTimes(date, coordinates.latitude, coordinates.longitude);

    return {
      sunrise: validDate(times.sunrise),
      sunset: validDate(times.sunset),
      solarNoon: times.solarNoon,
      dawn: validDate(times.dawn),
      dusk: validDate(times.dusk),
    };
  }

  /**
   * Where the sun is right now.
   *
   * ⚠️ **This build of suncalc returns DEGREES with a north-based azimuth**, not
   * the radians-and-south-based convention its widely-cited documentation
   * describes. Verified against known positions: at solar noon the azimuth is
   * exactly 180.00 (due south) and at the June sunrise in Tehran it is 60
   * (north-east) — both correct only under the north-based reading.
   *
   * Converting as the docs describe produced elevations of several hundred
   * degrees, which is geometrically impossible. **Do not add a radian
   * conversion here.**
   */
  getSunPosition(date: Date, coordinates: Coordinates): SunPosition {
    const position = SunCalc.getPosition(
      date,
      coordinates.latitude,
      coordinates.longitude,
    );

    return {
      elevation: degrees(position.altitude),
      azimuth: degrees(((position.azimuth % 360) + 360) % 360),
      isDaytime: position.altitude > 0,
    };
  }

  /**
   * The time-of-day band, for the dynamic background palette.
   *
   * Uses solar elevation, and the sun's direction of travel to tell dawn from
   * dusk at the same elevation.
   */
  getTimeOfDay(date: Date, coordinates: Coordinates): TimeOfDay {
    const { elevation } = this.getSunPosition(date, coordinates);

    if (elevation > FULL_DAYLIGHT_ELEVATION) return 'day';
    if (elevation < CIVIL_TWILIGHT_ELEVATION) return 'night';

    // In the twilight band: compare with a moment later to see which way the
    // sun is moving. Rising means dawn, setting means dusk.
    const later = new Date(date.getTime() + 10 * 60_000);
    const isRising = this.getSunPosition(later, coordinates).elevation > elevation;

    return isRising ? 'dawn' : 'dusk';
  }

  /** Moon phase, illumination and rise/set times. */
  getMoonInfo(date: Date, coordinates: Coordinates): MoonInfo {
    const illumination = SunCalc.getMoonIllumination(date);
    const times = SunCalc.getMoonTimes(date, coordinates.latitude, coordinates.longitude);

    return {
      phase: toMoonPhase(illumination.phase),
      illumination: percent(illumination.fraction * 100),
      phaseFraction: illumination.phase,
      moonrise: validDate(times.rise),
      moonset: validDate(times.set),
    };
  }

  /** Whether it is daylight — the cheap check, when only day/night matters. */
  isDaytime(date: Date, coordinates: Coordinates): boolean {
    return this.getSunPosition(date, coordinates).isDaytime;
  }
}

/**
 * Map a 0–1 cycle position to a named phase.
 *
 * The four "quarter" phases occupy narrow bands around their exact points; the
 * crescent and gibbous phases fill the space between. Boundaries at ±1/16 of
 * the cycle (~1.85 days) match how the phases are conventionally named.
 */
function toMoonPhase(fraction: number): MoonPhase {
  const cycle = ((fraction % 1) + 1) % 1;
  const eighth = 1 / 8;
  const sixteenth = 1 / 16;

  if (cycle < sixteenth) return 'new';
  if (cycle < eighth * 2 - sixteenth) return 'waxingCrescent';
  if (cycle < eighth * 2 + sixteenth) return 'firstQuarter';
  if (cycle < eighth * 4 - sixteenth) return 'waxingGibbous';
  if (cycle < eighth * 4 + sixteenth) return 'full';
  if (cycle < eighth * 6 - sixteenth) return 'waningGibbous';
  if (cycle < eighth * 6 + sixteenth) return 'lastQuarter';
  if (cycle < 1 - sixteenth) return 'waningCrescent';
  return 'new';
}

/**
 * Normalise suncalc's "no such event" markers into `undefined`.
 *
 * suncalc signals a non-occurring event two different ways — `null` for moon
 * rise/set and an Invalid Date for sun times — and both happen legitimately:
 * polar day and polar night, and days when the moon does not rise at all.
 *
 * Collapsing both into `undefined` makes the absence explicit in the type,
 * rather than leaving a Date that throws when formatted (CLAUDE.md §11).
 */
function validDate(value: Date | null | undefined): Date | undefined {
  if (value === null || value === undefined) return undefined;
  return Number.isNaN(value.getTime()) ? undefined : value;
}
