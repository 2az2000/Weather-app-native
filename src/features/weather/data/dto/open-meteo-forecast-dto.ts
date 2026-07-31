import { z } from 'zod';

/**
 * Open-Meteo Forecast — wire shapes.
 *
 * DTOs mirror the wire exactly: `snake_case`, provider-specific, arrays of
 * parallel values rather than arrays of objects. They never leave this layer
 * (CLAUDE.md §11).
 *
 * ## Why the columnar shape matters
 *
 * Open-Meteo returns `{ time: [...], temperature_2m: [...] }` — parallel arrays
 * indexed by position, not a list of hourly objects. This is compact on the
 * wire but hostile to work with, and a length mismatch between two arrays would
 * silently pair the wrong temperature with the wrong hour.
 *
 * The mapper zips them into entities and is where that risk is contained.
 *
 * @see https://open-meteo.com/en/docs
 */

/** Arrays are `nullable` per element: the model can omit a single hour. */
const numberSeries = z.array(z.number().nullable());

export const openMeteoCurrentSchema = z.object({
  time: z.string(),
  interval: z.number().optional(),
  temperature_2m: z.number(),
  relative_humidity_2m: z.number(),
  apparent_temperature: z.number(),
  is_day: z.number(),
  precipitation: z.number(),
  weather_code: z.number(),
  cloud_cover: z.number(),
  pressure_msl: z.number(),
  wind_speed_10m: z.number(),
  wind_direction_10m: z.number(),
  wind_gusts_10m: z.number().optional(),
  dew_point_2m: z.number().optional(),
  visibility: z.number().optional(),
  uv_index: z.number().optional(),
});

export const openMeteoHourlySchema = z.object({
  time: z.array(z.string()),
  temperature_2m: numberSeries,
  relative_humidity_2m: numberSeries,
  apparent_temperature: numberSeries,
  precipitation: numberSeries,
  precipitation_probability: numberSeries.optional(),
  weather_code: numberSeries,
  pressure_msl: numberSeries,
  cloud_cover: numberSeries,
  visibility: numberSeries.optional(),
  wind_speed_10m: numberSeries,
  wind_direction_10m: numberSeries,
  wind_gusts_10m: numberSeries.optional(),
  dew_point_2m: numberSeries.optional(),
  uv_index: numberSeries.optional(),
  is_day: numberSeries.optional(),
});

export const openMeteoDailySchema = z.object({
  time: z.array(z.string()),
  weather_code: numberSeries,
  temperature_2m_max: numberSeries,
  temperature_2m_min: numberSeries,
  apparent_temperature_max: numberSeries,
  apparent_temperature_min: numberSeries,
  sunrise: z.array(z.string().nullable()).optional(),
  sunset: z.array(z.string().nullable()).optional(),
  precipitation_sum: numberSeries,
  precipitation_probability_max: numberSeries.optional(),
  wind_speed_10m_max: numberSeries,
  wind_gusts_10m_max: numberSeries.optional(),
  wind_direction_10m_dominant: numberSeries,
  uv_index_max: numberSeries.optional(),
});

export const openMeteoMinutelySchema = z.object({
  time: z.array(z.string()),
  precipitation: numberSeries,
});

export const openMeteoForecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  utc_offset_seconds: z.number(),
  elevation: z.number().optional(),
  current: openMeteoCurrentSchema,
  hourly: openMeteoHourlySchema,
  daily: openMeteoDailySchema,
  minutely_15: openMeteoMinutelySchema.optional(),
});

export const openMeteoArchiveResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: numberSeries,
    temperature_2m_min: numberSeries,
    precipitation_sum: numberSeries,
  }),
});

export type OpenMeteoForecastResponseDto = z.infer<
  typeof openMeteoForecastResponseSchema
>;
export type OpenMeteoArchiveResponseDto = z.infer<typeof openMeteoArchiveResponseSchema>;
export type OpenMeteoCurrentDto = z.infer<typeof openMeteoCurrentSchema>;
export type OpenMeteoHourlyDto = z.infer<typeof openMeteoHourlySchema>;
export type OpenMeteoDailyDto = z.infer<typeof openMeteoDailySchema>;
