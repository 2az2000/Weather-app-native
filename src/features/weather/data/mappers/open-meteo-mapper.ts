import {
  celsius,
  degrees,
  hectopascals,
  meters,
  metersPerSecond,
  millimeters,
  percent,
  type CurrentConditions,
  type DailyPoint,
  type Forecast,
  type HistoricalDay,
  type HourlyPoint,
  type MinutelyPoint,
} from '../../domain';
import type {
  OpenMeteoArchiveResponseDto,
  OpenMeteoForecastResponseDto,
} from '../dto/open-meteo-forecast-dto';

import { fromWmoCode } from './weather-code-mapper';

/**
 * Open-Meteo DTO → domain entities.
 *
 * Pure functions, one direction (CLAUDE.md §11).
 *
 * ## The columnar hazard
 *
 * Open-Meteo returns parallel arrays indexed by position. Two risks follow:
 *
 * 1. **Length mismatch.** If `time` has 24 entries and `temperature_2m` has 23,
 *    naive indexing silently pairs the wrong temperature with the wrong hour.
 *    Every series read goes through {@link at}, which returns `undefined` past
 *    the end rather than producing a wrong pairing.
 * 2. **Per-element nulls.** A model can omit a single hour. `noUncheckedIndexedAccess`
 *    forces that to be handled, and it is: an hour missing its temperature is
 *    DROPPED rather than defaulted, because inventing a value is worse than a gap.
 */

/** Whether the provider natively resolves 15-minute data for this region (ADR-0002). */
export const NATIVE_MINUTELY_TIMEZONES = /^(America|Europe)\//;

/** Read a series element, tolerating a short or sparse array. */
function at(
  series: readonly (number | null)[] | undefined,
  index: number,
): number | undefined {
  const value = series?.[index];
  return value ?? undefined;
}

/**
 * Parse an Open-Meteo timestamp.
 *
 * The provider returns local-to-the-location times WITHOUT a zone suffix
 * (`2026-07-31T14:00`). Appending `Z` would shift every reading by the UTC
 * offset — the classic timezone bug in this class of app. The `utc_offset_seconds`
 * from the response is applied instead.
 */
function parseTime(value: string, utcOffsetSeconds: number): Date {
  const asUtc = Date.parse(`${value}Z`);
  return new Date(asUtc - utcOffsetSeconds * 1000);
}

export function toCurrentConditions(
  dto: OpenMeteoForecastResponseDto,
): CurrentConditions {
  const current = dto.current;

  return {
    observedAt: parseTime(current.time, dto.utc_offset_seconds),
    condition: fromWmoCode(current.weather_code),
    isDaytime: current.is_day === 1,

    temperature: celsius(current.temperature_2m),
    apparentTemperature: celsius(current.apparent_temperature),
    humidity: percent(current.relative_humidity_2m),
    // Absent ≠ 0 °C. A dew point of zero is a real reading; not knowing it is
    // a different fact (CLAUDE.md §11).
    dewPoint:
      current.dew_point_2m === undefined ? undefined : celsius(current.dew_point_2m),

    pressure: hectopascals(current.pressure_msl),
    windSpeed: metersPerSecond(current.wind_speed_10m),
    windDirection: degrees(current.wind_direction_10m),
    windGust:
      current.wind_gusts_10m === undefined
        ? undefined
        : metersPerSecond(current.wind_gusts_10m),

    cloudCover: percent(current.cloud_cover),
    visibility: current.visibility === undefined ? undefined : meters(current.visibility),
    uvIndex: current.uv_index,
    precipitation: millimeters(current.precipitation),
  };
}

export function toHourlyPoints(dto: OpenMeteoForecastResponseDto): HourlyPoint[] {
  const hourly = dto.hourly;
  const points: HourlyPoint[] = [];

  for (const [index, time] of hourly.time.entries()) {
    const temperature = at(hourly.temperature_2m, index);
    const apparent = at(hourly.apparent_temperature, index);
    const code = at(hourly.weather_code, index);

    // An hour missing its core values is dropped. A gap in a chart is honest;
    // a fabricated 0 °C is not.
    if (temperature === undefined || apparent === undefined || code === undefined) {
      continue;
    }

    const dewPoint = at(hourly.dew_point_2m, index);
    const gust = at(hourly.wind_gusts_10m, index);
    const visibility = at(hourly.visibility, index);
    const probability = at(hourly.precipitation_probability, index);
    const isDay = at(hourly.is_day, index);

    points.push({
      time: parseTime(time, dto.utc_offset_seconds),
      condition: fromWmoCode(code),
      isDaytime: isDay === undefined ? true : isDay === 1,

      temperature: celsius(temperature),
      apparentTemperature: celsius(apparent),
      humidity: percent(at(hourly.relative_humidity_2m, index) ?? 0),
      dewPoint: dewPoint === undefined ? undefined : celsius(dewPoint),

      pressure: hectopascals(at(hourly.pressure_msl, index) ?? 0),
      windSpeed: metersPerSecond(at(hourly.wind_speed_10m, index) ?? 0),
      windDirection: degrees(at(hourly.wind_direction_10m, index) ?? 0),
      windGust: gust === undefined ? undefined : metersPerSecond(gust),

      cloudCover: percent(at(hourly.cloud_cover, index) ?? 0),
      visibility: visibility === undefined ? undefined : meters(visibility),
      uvIndex: at(hourly.uv_index, index),
      precipitation: millimeters(at(hourly.precipitation, index) ?? 0),
      precipitationProbability:
        probability === undefined ? undefined : percent(probability),
    });
  }

  return points;
}

export function toDailyPoints(dto: OpenMeteoForecastResponseDto): DailyPoint[] {
  const daily = dto.daily;
  const points: DailyPoint[] = [];

  for (const [index, date] of daily.time.entries()) {
    const max = at(daily.temperature_2m_max, index);
    const min = at(daily.temperature_2m_min, index);
    const code = at(daily.weather_code, index);

    if (max === undefined || min === undefined || code === undefined) continue;

    const sunrise = daily.sunrise?.[index];
    const sunset = daily.sunset?.[index];
    const gustMax = at(daily.wind_gusts_10m_max, index);
    const probabilityMax = at(daily.precipitation_probability_max, index);

    points.push({
      // A daily entry is a calendar DATE, not an instant — parsed at local
      // midnight so it lands on the right day in the location's timezone.
      date: parseTime(`${date}T00:00`, dto.utc_offset_seconds),
      condition: fromWmoCode(code),

      temperatureMax: celsius(max),
      temperatureMin: celsius(min),
      apparentTemperatureMax: celsius(at(daily.apparent_temperature_max, index) ?? max),
      apparentTemperatureMin: celsius(at(daily.apparent_temperature_min, index) ?? min),

      // Absent inside the polar circles, where the sun does not cross the
      // horizon — a real astronomical fact, not a provider failure.
      sunrise:
        sunrise === null || sunrise === undefined
          ? undefined
          : parseTime(sunrise, dto.utc_offset_seconds),
      sunset:
        sunset === null || sunset === undefined
          ? undefined
          : parseTime(sunset, dto.utc_offset_seconds),

      precipitationSum: millimeters(at(daily.precipitation_sum, index) ?? 0),
      precipitationProbabilityMax:
        probabilityMax === undefined ? undefined : percent(probabilityMax),
      windSpeedMax: metersPerSecond(at(daily.wind_speed_10m_max, index) ?? 0),
      windGustMax: gustMax === undefined ? undefined : metersPerSecond(gustMax),
      windDirectionDominant: degrees(at(daily.wind_direction_10m_dominant, index) ?? 0),
      uvIndexMax: at(daily.uv_index_max, index),
    });
  }

  return points;
}

export function toMinutelyPoints(dto: OpenMeteoForecastResponseDto): MinutelyPoint[] {
  const minutely = dto.minutely_15;
  if (minutely === undefined) return [];

  // Outside North America and Central Europe these values are interpolated from
  // hourly data (ADR-0002). Carrying the distinction stops the UI implying
  // precision the model does not have.
  const isInterpolated = !NATIVE_MINUTELY_TIMEZONES.test(dto.timezone);

  return minutely.time.flatMap((time, index) => {
    const precipitation = at(minutely.precipitation, index);
    if (precipitation === undefined) return [];

    return [
      {
        time: parseTime(time, dto.utc_offset_seconds),
        precipitation: millimeters(precipitation),
        isInterpolated,
      },
    ];
  });
}

/** The complete forecast. */
export function toForecast(
  dto: OpenMeteoForecastResponseDto,
  fetchedAt: Date = new Date(),
): Forecast {
  const minutelyPoints = toMinutelyPoints(dto);

  return {
    current: toCurrentConditions(dto),
    hourly: { points: toHourlyPoints(dto) },
    daily: { points: toDailyPoints(dto) },
    minutely: minutelyPoints.length === 0 ? undefined : { points: minutelyPoints },
    timezone: dto.timezone,
    provider: 'open-meteo',
    fetchedAt,
  };
}

export function toHistoricalDays(dto: OpenMeteoArchiveResponseDto): HistoricalDay[] {
  const daily = dto.daily;

  return daily.time.flatMap((date, index) => {
    const max = at(daily.temperature_2m_max, index);
    const min = at(daily.temperature_2m_min, index);

    if (max === undefined || min === undefined) return [];

    return [
      {
        // Archive dates are plain calendar days with no offset to apply.
        date: new Date(`${date}T00:00:00Z`),
        temperatureMax: celsius(max),
        temperatureMin: celsius(min),
        precipitationSum: millimeters(at(daily.precipitation_sum, index) ?? 0),
      },
    ];
  });
}
