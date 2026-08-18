import {
  celsius,
  degrees,
  hectopascals,
  meters,
  metersPerSecond,
  millimeters,
  percent,
} from '../entities/units';
import type {
  DailyPoint,
  Forecast,
  HourlyPoint,
  MinutelyPoint,
} from '../entities/forecast';

/**
 * Domain-level fixtures, built as ENTITIES rather than mapped from a DTO.
 *
 * A domain test must not reach into `data/` — the boundaries rule catches it,
 * and rightly: a use case's behaviour has nothing to do with a provider's wire
 * format, so a test that couples the two would fail when a provider changed
 * something the use case never sees.
 *
 * Times are chosen so a "now" of 2026-07-31T08:30:00Z sits on the first hourly
 * point, which is what the past-hour-dropping rules are tested against.
 */

const HOUR = 3_600_000;

/** The reference instant these fixtures are built around. */
export const NOW = new Date('2026-07-31T08:30:00Z');

export function hourlyPoint(offsetHours: number): HourlyPoint {
  return {
    time: new Date(NOW.getTime() + offsetHours * HOUR),
    condition: 'clear',
    isDaytime: true,
    temperature: celsius(31.4 + offsetHours * 0.6),
    apparentTemperature: celsius(29.8 + offsetHours * 0.6),
    humidity: percent(22),
    dewPoint: celsius(6.5),
    pressure: hectopascals(1012.3),
    windSpeed: metersPerSecond(4.2),
    windDirection: degrees(315),
    windGust: metersPerSecond(8.1),
    cloudCover: percent(5),
    visibility: meters(24_000),
    uvIndex: 8.3,
    precipitation: millimeters(0),
    precipitationProbability: percent(offsetHours === 2 ? 5 : 0),
  };
}

/**
 * Local midnight of the day containing {@link NOW}.
 *
 * DERIVED rather than hardcoded. This was written as the literal instant
 * `2026-07-30T20:30:00Z` — local midnight in UTC+03:30 — which silently bound
 * every daily test to one author's timezone. `GetDailyForecast` computes the
 * day boundary in local time, so a fixture that hardcodes one offset agrees
 * with it on exactly one machine and disagrees everywhere else.
 */
function localMidnightOfToday(): number {
  const midnight = new Date(NOW);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

export function dailyPoint(offsetDays: number): DailyPoint {
  const base = localMidnightOfToday();

  return {
    date: new Date(base + offsetDays * 24 * HOUR),
    condition: 'clear',
    temperatureMax: celsius(33.2 + offsetDays * 0.8),
    temperatureMin: celsius(21.5 + offsetDays * 0.6),
    apparentTemperatureMax: celsius(31.6),
    apparentTemperatureMin: celsius(20.8),
    sunrise: new Date(base + offsetDays * 24 * HOUR + 5.93 * HOUR),
    sunset: new Date(base + offsetDays * 24 * HOUR + 20.18 * HOUR),
    precipitationSum: millimeters(0),
    precipitationProbabilityMax: percent(0),
    windSpeedMax: metersPerSecond(6.4),
    windGustMax: metersPerSecond(11.2),
    windDirectionDominant: degrees(312),
    uvIndexMax: 8.6,
  };
}

export function minutelyPoint(offsetMinutes: number, precipitation = 0): MinutelyPoint {
  return {
    time: new Date(NOW.getTime() + offsetMinutes * 60_000),
    precipitation: millimeters(precipitation),
    // Asia/Tehran is outside the natively-resolved regions (ADR-0002).
    isInterpolated: true,
  };
}

export function forecastFixture(overrides: Partial<Forecast> = {}): Forecast {
  return {
    current: {
      observedAt: NOW,
      condition: 'clear',
      isDaytime: true,
      temperature: celsius(31.4),
      apparentTemperature: celsius(29.8),
      humidity: percent(22),
      dewPoint: celsius(6.5),
      pressure: hectopascals(1012.3),
      windSpeed: metersPerSecond(4.2),
      windDirection: degrees(315),
      windGust: metersPerSecond(8.1),
      cloudCover: percent(5),
      visibility: meters(24_000),
      uvIndex: 8.3,
      precipitation: millimeters(0),
    },
    hourly: { points: [hourlyPoint(0), hourlyPoint(1), hourlyPoint(2)] },
    daily: { points: [dailyPoint(0), dailyPoint(1)] },
    minutely: { points: [minutelyPoint(0), minutelyPoint(15), minutelyPoint(30)] },
    timezone: 'Asia/Tehran',
    provider: 'open-meteo',
    fetchedAt: NOW,
    ...overrides,
  };
}
