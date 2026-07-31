import { z } from 'zod';

/**
 * Open-Meteo Geocoding — wire shapes.
 *
 * DTOs mirror the wire exactly: `snake_case`, nullable, provider-specific
 * (CLAUDE.md §11). They never leave this layer. A `*Dto` type appearing in
 * `domain/` or `presentation/` means the architecture has been broken.
 *
 * Nearly every field is optional because Open-Meteo omits rather than nulls what
 * it does not know — `admin1` is absent for city-states, `elevation` for some
 * small settlements. Modelling that honestly here is what lets the mapper make
 * an explicit decision instead of a silent `0`.
 *
 * @see https://open-meteo.com/en/docs/geocoding-api
 */
export const openMeteoPlaceSchema = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  timezone: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  admin1: z.string().optional(),
  admin2: z.string().optional(),
  population: z.number().optional(),
});

export const openMeteoGeocodingResponseSchema = z.object({
  // Absent entirely when nothing matches — NOT an empty array.
  results: z.array(openMeteoPlaceSchema).optional(),
});

export type OpenMeteoPlaceDto = z.infer<typeof openMeteoPlaceSchema>;
export type OpenMeteoGeocodingResponseDto = z.infer<
  typeof openMeteoGeocodingResponseSchema
>;
