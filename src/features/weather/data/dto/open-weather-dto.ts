import { z } from 'zod';

/**
 * OpenWeather One Call 3.0 — wire shapes.
 *
 * The fallback provider, and the ONLY source of severe weather alerts
 * (ADR-0002). Its shape is completely different from Open-Meteo's — objects per
 * hour rather than parallel arrays, Unix seconds rather than ISO strings — which
 * is precisely why each provider needs its own mapper into shared entities.
 *
 * @see https://openweathermap.org/api/one-call-3
 */

const weatherEntrySchema = z.object({
  id: z.number(),
  main: z.string(),
  description: z.string(),
  icon: z.string(),
});

const commonFields = {
  dt: z.number(),
  temp: z.number(),
  feels_like: z.number(),
  pressure: z.number(),
  humidity: z.number(),
  dew_point: z.number().optional(),
  uvi: z.number().optional(),
  clouds: z.number(),
  visibility: z.number().optional(),
  wind_speed: z.number(),
  wind_deg: z.number(),
  wind_gust: z.number().optional(),
  weather: z.array(weatherEntrySchema),
};

export const openWeatherCurrentSchema = z.object({
  ...commonFields,
  sunrise: z.number().optional(),
  sunset: z.number().optional(),
  rain: z.object({ '1h': z.number() }).optional(),
  snow: z.object({ '1h': z.number() }).optional(),
});

export const openWeatherHourlySchema = z.object({
  ...commonFields,
  pop: z.number().optional(),
  rain: z.object({ '1h': z.number() }).optional(),
  snow: z.object({ '1h': z.number() }).optional(),
});

export const openWeatherDailySchema = z.object({
  dt: z.number(),
  sunrise: z.number().optional(),
  sunset: z.number().optional(),
  temp: z.object({ min: z.number(), max: z.number() }),
  feels_like: z.object({ day: z.number(), night: z.number() }),
  pressure: z.number(),
  humidity: z.number(),
  wind_speed: z.number(),
  wind_deg: z.number(),
  wind_gust: z.number().optional(),
  weather: z.array(weatherEntrySchema),
  pop: z.number().optional(),
  rain: z.number().optional(),
  snow: z.number().optional(),
  uvi: z.number().optional(),
});

export const openWeatherAlertSchema = z.object({
  sender_name: z.string(),
  event: z.string(),
  start: z.number(),
  end: z.number(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
});

export const openWeatherMinutelySchema = z.object({
  dt: z.number(),
  precipitation: z.number(),
});

export const openWeatherResponseSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  timezone: z.string(),
  timezone_offset: z.number(),
  current: openWeatherCurrentSchema,
  minutely: z.array(openWeatherMinutelySchema).optional(),
  hourly: z.array(openWeatherHourlySchema),
  daily: z.array(openWeatherDailySchema),
  alerts: z.array(openWeatherAlertSchema).optional(),
});

export type OpenWeatherResponseDto = z.infer<typeof openWeatherResponseSchema>;
export type OpenWeatherAlertDto = z.infer<typeof openWeatherAlertSchema>;
