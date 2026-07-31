import type { LocationSearchResult, Place } from '../../domain';
import type { OpenMeteoPlaceDto } from '../dto/open-meteo-geocoding-dto';

/**
 * DTO → entity.
 *
 * Pure functions, one direction (CLAUDE.md §11). This is the one-file firewall
 * that keeps a provider's wire format out of every screen.
 *
 * Each provider gets its OWN mapper into the same entities — that is how the
 * OS geocoder, Open-Meteo and Mapbox stay interchangeable.
 */

/**
 * Fallback when a provider omits the timezone.
 *
 * `UTC` rather than the device zone: a forecast rendered in the wrong zone is
 * wrong in a way that looks plausible, and UTC at least makes the problem
 * visible. In practice Open-Meteo always supplies this when asked with
 * `timezone=auto`.
 */
const UNKNOWN_TIMEZONE = 'UTC';

export function toPlace(dto: OpenMeteoPlaceDto): Place {
  return {
    coordinates: { latitude: dto.latitude, longitude: dto.longitude },
    name: dto.name,
    // Absent ≠ empty string. An optional entity field states "we do not know",
    // which the UI can render differently from "there is none".
    admin1: dto.admin1,
    countryCode: (dto.country_code ?? '').toUpperCase(),
    country: dto.country ?? '',
    timezone: dto.timezone ?? UNKNOWN_TIMEZONE,
    elevation: dto.elevation,
  };
}

export function toSearchResult(dto: OpenMeteoPlaceDto): LocationSearchResult {
  return {
    ...toPlace(dto),
    // Open-Meteo ids are numeric; the entity uses strings so a future provider
    // with opaque ids needs no entity change.
    id: String(dto.id),
    population: dto.population,
  };
}
