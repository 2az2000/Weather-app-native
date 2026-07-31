import type { WeatherCondition } from './weather-condition';
import type {
  Celsius,
  Degrees,
  Hectopascals,
  Meters,
  MetersPerSecond,
  Millimeters,
  Percent,
} from './units';

/**
 * Weather entities.
 *
 * All fields are `readonly` — entities are immutable (CLAUDE.md §31).
 *
 * **Optional means "the provider did not report it", never "zero".** A dew
 * point of 0 °C and an unknown dew point are different facts, and collapsing
 * them would show a confident wrong number rather than an honest gap
 * (CLAUDE.md §11).
 */

/** Conditions right now. */
export interface CurrentConditions {
  readonly observedAt: Date;
  readonly condition: WeatherCondition;
  readonly isDaytime: boolean;

  readonly temperature: Celsius;
  /** What it feels like, accounting for wind and humidity. */
  readonly apparentTemperature: Celsius;
  readonly humidity: Percent;
  readonly dewPoint: Celsius | undefined;

  readonly pressure: Hectopascals;
  readonly windSpeed: MetersPerSecond;
  readonly windDirection: Degrees;
  readonly windGust: MetersPerSecond | undefined;

  readonly cloudCover: Percent;
  readonly visibility: Meters | undefined;
  readonly uvIndex: number | undefined;
  readonly precipitation: Millimeters;
}

/** One hour of forecast. */
export interface HourlyPoint {
  readonly time: Date;
  readonly condition: WeatherCondition;
  readonly isDaytime: boolean;

  readonly temperature: Celsius;
  readonly apparentTemperature: Celsius;
  readonly humidity: Percent;
  readonly dewPoint: Celsius | undefined;

  readonly pressure: Hectopascals;
  readonly windSpeed: MetersPerSecond;
  readonly windDirection: Degrees;
  readonly windGust: MetersPerSecond | undefined;

  readonly cloudCover: Percent;
  readonly visibility: Meters | undefined;
  readonly uvIndex: number | undefined;
  readonly precipitation: Millimeters;
  readonly precipitationProbability: Percent | undefined;
}

export interface HourlyForecast {
  readonly points: readonly HourlyPoint[];
}

/**
 * One 15-minute slot.
 *
 * Natively resolved only for North America (HRRR) and Central Europe
 * (ICON-D2 / AROME); elsewhere Open-Meteo interpolates from hourly data
 * (ADR-0002). `isInterpolated` carries that distinction so the UI never implies
 * precision it does not have.
 */
export interface MinutelyPoint {
  readonly time: Date;
  readonly precipitation: Millimeters;
  readonly isInterpolated: boolean;
}

export interface MinutelyForecast {
  readonly points: readonly MinutelyPoint[];
}

/** One calendar day. */
export interface DailyPoint {
  readonly date: Date;
  readonly condition: WeatherCondition;

  readonly temperatureMax: Celsius;
  readonly temperatureMin: Celsius;
  readonly apparentTemperatureMax: Celsius;
  readonly apparentTemperatureMin: Celsius;

  readonly sunrise: Date | undefined;
  readonly sunset: Date | undefined;

  readonly precipitationSum: Millimeters;
  readonly precipitationProbabilityMax: Percent | undefined;
  readonly windSpeedMax: MetersPerSecond;
  readonly windGustMax: MetersPerSecond | undefined;
  readonly windDirectionDominant: Degrees;
  readonly uvIndexMax: number | undefined;
}

export interface DailyForecast {
  readonly points: readonly DailyPoint[];
}

/**
 * A complete forecast for one place.
 *
 * Aggregated because providers return all of it in one response — splitting it
 * would mean multiple requests for data that arrives together.
 */
export interface Forecast {
  readonly current: CurrentConditions;
  readonly hourly: HourlyForecast;
  readonly daily: DailyForecast;
  readonly minutely: MinutelyForecast | undefined;
  /** IANA timezone. Forecast times are meaningless without it. */
  readonly timezone: string;
  /** Which provider answered — for the circuit breaker and for debugging. */
  readonly provider: string;
  /** When this was fetched. Drives the "last updated" indicator (§24). */
  readonly fetchedAt: Date;
}

/** A past observation. The past does not change, so it is cached forever (§25). */
export interface HistoricalDay {
  readonly date: Date;
  readonly temperatureMax: Celsius;
  readonly temperatureMin: Celsius;
  readonly precipitationSum: Millimeters;
}
