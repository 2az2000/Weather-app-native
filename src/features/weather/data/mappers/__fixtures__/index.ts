import type { OpenMeteoForecastResponseDto } from '../../dto/open-meteo-forecast-dto';
import type { OpenWeatherResponseDto } from '../../dto/open-weather-dto';

/**
 * Fixtures shaped like real provider responses.
 *
 * Both describe the SAME weather at the SAME place, which is what makes the
 * equivalence test meaningful: if the two mappers disagree, it is the mappers
 * that differ, not the inputs (ROADMAP Phase 4 DoD).
 *
 * Tehran, 2026-07-31, clear, 31 °C.
 */

const TIMEZONE = 'Asia/Tehran';
/** +03:30 — deliberately a half-hour offset, where naive parsing goes wrong. */
const UTC_OFFSET_SECONDS = 12_600;

/** 2026-07-31T12:00 local = 08:30 UTC. */
export const OBSERVED_AT = new Date('2026-07-31T08:30:00Z');

export function openMeteoFixture(): OpenMeteoForecastResponseDto {
  return {
    latitude: 35.6892,
    longitude: 51.389,
    timezone: TIMEZONE,
    utc_offset_seconds: UTC_OFFSET_SECONDS,
    elevation: 1189,

    current: {
      time: '2026-07-31T12:00',
      temperature_2m: 31.4,
      relative_humidity_2m: 22,
      apparent_temperature: 29.8,
      is_day: 1,
      precipitation: 0,
      weather_code: 0,
      cloud_cover: 5,
      pressure_msl: 1012.3,
      wind_speed_10m: 4.2,
      wind_direction_10m: 315,
      wind_gusts_10m: 8.1,
      dew_point_2m: 6.5,
      visibility: 24_000,
      uv_index: 8.3,
    },

    hourly: {
      time: ['2026-07-31T12:00', '2026-07-31T13:00', '2026-07-31T14:00'],
      temperature_2m: [31.4, 32.1, 32.6],
      relative_humidity_2m: [22, 20, 19],
      apparent_temperature: [29.8, 30.4, 30.9],
      precipitation: [0, 0, 0],
      precipitation_probability: [0, 0, 5],
      weather_code: [0, 0, 1],
      pressure_msl: [1012.3, 1012.0, 1011.8],
      cloud_cover: [5, 8, 12],
      visibility: [24_000, 24_000, 23_000],
      wind_speed_10m: [4.2, 4.6, 5.1],
      wind_direction_10m: [315, 310, 305],
      wind_gusts_10m: [8.1, 8.6, 9.2],
      dew_point_2m: [6.5, 6.2, 6.0],
      uv_index: [8.3, 8.0, 7.2],
      is_day: [1, 1, 1],
    },

    daily: {
      time: ['2026-07-31', '2026-08-01'],
      weather_code: [0, 1],
      temperature_2m_max: [33.2, 34.0],
      temperature_2m_min: [21.5, 22.1],
      apparent_temperature_max: [31.6, 32.4],
      apparent_temperature_min: [20.8, 21.4],
      sunrise: ['2026-07-31T05:56', '2026-08-01T05:57'],
      sunset: ['2026-07-31T20:11', '2026-08-01T20:10'],
      precipitation_sum: [0, 0],
      precipitation_probability_max: [0, 5],
      wind_speed_10m_max: [6.4, 6.9],
      wind_gusts_10m_max: [11.2, 12.0],
      wind_direction_10m_dominant: [312, 308],
      uv_index_max: [8.6, 8.4],
    },

    minutely_15: {
      time: ['2026-07-31T12:00', '2026-07-31T12:15', '2026-07-31T12:30'],
      precipitation: [0, 0, 0],
    },
  };
}

export function openWeatherFixture(): OpenWeatherResponseDto {
  const observed = OBSERVED_AT.getTime() / 1000;
  const hour = 3600;

  return {
    lat: 35.6892,
    lon: 51.389,
    timezone: TIMEZONE,
    timezone_offset: UTC_OFFSET_SECONDS,

    current: {
      dt: observed,
      temp: 31.4,
      feels_like: 29.8,
      pressure: 1012.3,
      humidity: 22,
      dew_point: 6.5,
      uvi: 8.3,
      clouds: 5,
      visibility: 24_000,
      wind_speed: 4.2,
      wind_deg: 315,
      wind_gust: 8.1,
      // 800 is OpenWeather's "clear sky", the counterpart of WMO 0.
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      sunrise: observed - 6 * hour,
      sunset: observed + 8 * hour,
    },

    hourly: [0, 1, 2].map((offset) => ({
      dt: observed + offset * hour,
      temp: [31.4, 32.1, 32.6][offset] ?? 0,
      feels_like: [29.8, 30.4, 30.9][offset] ?? 0,
      pressure: [1012.3, 1012.0, 1011.8][offset] ?? 0,
      humidity: [22, 20, 19][offset] ?? 0,
      dew_point: [6.5, 6.2, 6.0][offset] ?? 0,
      uvi: [8.3, 8.0, 7.2][offset] ?? 0,
      clouds: [5, 8, 12][offset] ?? 0,
      visibility: [24_000, 24_000, 23_000][offset] ?? 0,
      wind_speed: [4.2, 4.6, 5.1][offset] ?? 0,
      wind_deg: [315, 310, 305][offset] ?? 0,
      wind_gust: [8.1, 8.6, 9.2][offset] ?? 0,
      // OpenWeather reports probability as a 0–1 fraction, not a percentage.
      pop: [0, 0, 0.05][offset] ?? 0,
      weather: [
        offset === 2
          ? { id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }
          : { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' },
      ],
    })),

    daily: [0, 1].map((offset) => ({
      dt: observed + offset * 24 * hour,
      sunrise: observed - 6 * hour + offset * 24 * hour,
      sunset: observed + 8 * hour + offset * 24 * hour,
      temp: {
        max: [33.2, 34.0][offset] ?? 0,
        min: [21.5, 22.1][offset] ?? 0,
      },
      feels_like: {
        day: [31.6, 32.4][offset] ?? 0,
        night: [20.8, 21.4][offset] ?? 0,
      },
      pressure: 1012.3,
      humidity: 22,
      wind_speed: [6.4, 6.9][offset] ?? 0,
      wind_deg: [312, 308][offset] ?? 0,
      wind_gust: [11.2, 12.0][offset] ?? 0,
      pop: [0, 0.05][offset] ?? 0,
      uvi: [8.6, 8.4][offset] ?? 0,
      weather: [
        offset === 1
          ? { id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }
          : { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' },
      ],
    })),

    minutely: [0, 15, 30].map((minutes) => ({
      dt: observed + minutes * 60,
      precipitation: 0,
    })),

    alerts: [
      {
        sender_name: 'Iran Meteorological Organization',
        event: 'Extreme Heat Warning',
        start: observed,
        end: observed + 12 * hour,
        description: 'Temperatures above 40 °C expected.',
        tags: ['Extreme temperature value'],
      },
    ],
  };
}
