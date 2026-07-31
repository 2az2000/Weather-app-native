import {
  celsius,
  degrees,
  hectopascals,
  meters,
  metersPerSecond,
  millimeters,
  percent,
  type AlertSeverity,
  type CurrentConditions,
  type DailyPoint,
  type Forecast,
  type HourlyPoint,
  type MinutelyPoint,
  type SevereAlert,
} from '../../domain';
import type {
  OpenWeatherAlertDto,
  OpenWeatherResponseDto,
} from '../dto/open-weather-dto';

import { fromOpenWeatherCode } from './weather-code-mapper';

/**
 * OpenWeather DTO → the SAME domain entities as the Open-Meteo mapper.
 *
 * That both providers land on identical entity shapes is what makes them
 * interchangeable, and it is asserted directly by an equivalence test
 * (ROADMAP Phase 4 DoD).
 *
 * Two shape differences are absorbed here:
 * - **Unix seconds** rather than ISO strings
 * - **Millimetres in a nested `rain['1h']`** rather than a flat field
 */

/** OpenWeather timestamps are Unix seconds; JavaScript wants milliseconds. */
const fromUnix = (seconds: number): Date => new Date(seconds * 1000);

/** OpenWeather reports probability as a 0–1 fraction; the entity uses percent. */
const fromFraction = (value: number | undefined) =>
  value === undefined ? undefined : percent(value * 100);

/**
 * Rain and snow arrive as separate nested objects and must be summed.
 *
 * Both parameters are explicitly `| undefined`: under
 * `exactOptionalPropertyTypes` an optional property is NOT assignable to a
 * parameter that merely allows absence.
 */
function precipitationOf(entry: {
  rain?: { '1h': number } | undefined;
  snow?: { '1h': number } | undefined;
}): number {
  return (entry.rain?.['1h'] ?? 0) + (entry.snow?.['1h'] ?? 0);
}

export function toCurrentConditions(dto: OpenWeatherResponseDto): CurrentConditions {
  const current = dto.current;
  const code = current.weather[0]?.id ?? 800;

  // OpenWeather has no `is_day` flag; the sunrise/sunset pair in the same
  // response answers it directly.
  const isDaytime =
    current.sunrise !== undefined && current.sunset !== undefined
      ? current.dt >= current.sunrise && current.dt < current.sunset
      : true;

  return {
    observedAt: fromUnix(current.dt),
    condition: fromOpenWeatherCode(code),
    isDaytime,

    temperature: celsius(current.temp),
    apparentTemperature: celsius(current.feels_like),
    humidity: percent(current.humidity),
    dewPoint: current.dew_point === undefined ? undefined : celsius(current.dew_point),

    pressure: hectopascals(current.pressure),
    windSpeed: metersPerSecond(current.wind_speed),
    windDirection: degrees(current.wind_deg),
    windGust:
      current.wind_gust === undefined ? undefined : metersPerSecond(current.wind_gust),

    cloudCover: percent(current.clouds),
    visibility: current.visibility === undefined ? undefined : meters(current.visibility),
    uvIndex: current.uvi,
    precipitation: millimeters(precipitationOf(current)),
  };
}

export function toHourlyPoints(dto: OpenWeatherResponseDto): HourlyPoint[] {
  const sunrise = dto.current.sunrise;
  const sunset = dto.current.sunset;

  return dto.hourly.map((hour): HourlyPoint => {
    const code = hour.weather[0]?.id ?? 800;

    // Approximated from today's sun times. Over a multi-day horizon this drifts
    // by minutes, which is immaterial for choosing a day/night icon.
    const secondsIntoDay = hour.dt % 86_400;
    const isDaytime =
      sunrise !== undefined && sunset !== undefined
        ? secondsIntoDay >= sunrise % 86_400 && secondsIntoDay < sunset % 86_400
        : true;

    return {
      time: fromUnix(hour.dt),
      condition: fromOpenWeatherCode(code),
      isDaytime,

      temperature: celsius(hour.temp),
      apparentTemperature: celsius(hour.feels_like),
      humidity: percent(hour.humidity),
      dewPoint: hour.dew_point === undefined ? undefined : celsius(hour.dew_point),

      pressure: hectopascals(hour.pressure),
      windSpeed: metersPerSecond(hour.wind_speed),
      windDirection: degrees(hour.wind_deg),
      windGust:
        hour.wind_gust === undefined ? undefined : metersPerSecond(hour.wind_gust),

      cloudCover: percent(hour.clouds),
      visibility: hour.visibility === undefined ? undefined : meters(hour.visibility),
      uvIndex: hour.uvi,
      precipitation: millimeters(precipitationOf(hour)),
      precipitationProbability: fromFraction(hour.pop),
    };
  });
}

/**
 * Anchor a daily entry at LOCAL MIDNIGHT.
 *
 * OpenWeather stamps a daily entry at roughly local NOON, while Open-Meteo uses
 * local midnight. Left as-is, the same calendar day would carry two different
 * `date` values depending on which provider answered — so a day-grouped list or
 * a chart axis would shift the moment failover happened.
 *
 * Normalising here is what keeps the two providers genuinely interchangeable.
 */
function toLocalMidnight(unixSeconds: number, offsetSeconds: number): Date {
  const DAY = 86_400;
  const localMidnight = Math.floor((unixSeconds + offsetSeconds) / DAY) * DAY;
  return new Date((localMidnight - offsetSeconds) * 1000);
}

export function toDailyPoints(dto: OpenWeatherResponseDto): DailyPoint[] {
  return dto.daily.map((day): DailyPoint => {
    const code = day.weather[0]?.id ?? 800;

    return {
      date: toLocalMidnight(day.dt, dto.timezone_offset),
      condition: fromOpenWeatherCode(code),

      temperatureMax: celsius(day.temp.max),
      temperatureMin: celsius(day.temp.min),
      // OpenWeather gives feels-like per time of day rather than as a range;
      // day is the warmest and night the coolest, which is the same shape.
      apparentTemperatureMax: celsius(day.feels_like.day),
      apparentTemperatureMin: celsius(day.feels_like.night),

      sunrise: day.sunrise === undefined ? undefined : fromUnix(day.sunrise),
      sunset: day.sunset === undefined ? undefined : fromUnix(day.sunset),

      // Daily totals are already flat millimetres here, unlike the hourly shape.
      precipitationSum: millimeters((day.rain ?? 0) + (day.snow ?? 0)),
      precipitationProbabilityMax: fromFraction(day.pop),
      windSpeedMax: metersPerSecond(day.wind_speed),
      windGustMax:
        day.wind_gust === undefined ? undefined : metersPerSecond(day.wind_gust),
      windDirectionDominant: degrees(day.wind_deg),
      uvIndexMax: day.uvi,
    };
  });
}

export function toMinutelyPoints(dto: OpenWeatherResponseDto): MinutelyPoint[] {
  return (dto.minutely ?? []).map((minute) => ({
    time: fromUnix(minute.dt),
    precipitation: millimeters(minute.precipitation),
    // OpenWeather's minutely data is natively resolved wherever it is offered.
    isInterpolated: false,
  }));
}

export function toForecast(
  dto: OpenWeatherResponseDto,
  fetchedAt: Date = new Date(),
): Forecast {
  const minutelyPoints = toMinutelyPoints(dto);

  return {
    current: toCurrentConditions(dto),
    hourly: { points: toHourlyPoints(dto) },
    daily: { points: toDailyPoints(dto) },
    minutely: minutelyPoints.length === 0 ? undefined : { points: minutelyPoints },
    timezone: dto.timezone,
    provider: 'openweather',
    fetchedAt,
  };
}

/**
 * Severity from an alert's tags and title.
 *
 * OpenWeather relays warnings from national agencies verbatim and does NOT
 * normalise severity — each agency words its own. Keyword matching is a
 * heuristic, and it deliberately errs toward the HIGHER severity: showing a
 * watch as a warning is a smaller failure than the reverse.
 */
function toSeverity(dto: OpenWeatherAlertDto): AlertSeverity {
  const haystack = `${dto.event} ${(dto.tags ?? []).join(' ')}`.toLowerCase();

  if (haystack.includes('emergency') || haystack.includes('extreme')) return 'emergency';
  if (haystack.includes('warning') || haystack.includes('severe')) return 'warning';
  if (haystack.includes('watch')) return 'watch';
  return 'advisory';
}

export function toSevereAlerts(dto: OpenWeatherResponseDto): SevereAlert[] {
  return (dto.alerts ?? []).map((alert) => ({
    // No stable id is provided, so one is derived from the fields that identify
    // the alert. Stable across refetches, which is what a list key needs.
    id: `${alert.sender_name}-${String(alert.start)}-${alert.event}`,
    title: alert.event,
    description: alert.description,
    severity: toSeverity(alert),
    sender: alert.sender_name,
    startsAt: fromUnix(alert.start),
    endsAt: fromUnix(alert.end),
  }));
}
