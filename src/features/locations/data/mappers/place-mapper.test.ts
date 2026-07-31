import type { OpenMeteoPlaceDto } from '../dto/open-meteo-geocoding-dto';

import { toPlace, toSearchResult } from './place-mapper';

/**
 * Mapper coverage is a Phase 3 DoD item.
 *
 * Mappers are where upstream schema changes surface, and they are pure — so
 * they are the cheapest place in the codebase to catch an integration bug
 * (CLAUDE.md §26).
 */
const complete: OpenMeteoPlaceDto = {
  id: 112931,
  name: 'Tehran',
  latitude: 35.69439,
  longitude: 51.42151,
  elevation: 1189,
  timezone: 'Asia/Tehran',
  country: 'Iran',
  country_code: 'ir',
  admin1: 'Tehran',
  admin2: 'Tehran',
  population: 7_153_309,
};

describe('toPlace', () => {
  it('maps every field from a complete response', () => {
    expect(toPlace(complete)).toEqual({
      coordinates: { latitude: 35.69439, longitude: 51.42151 },
      name: 'Tehran',
      admin1: 'Tehran',
      countryCode: 'IR',
      country: 'Iran',
      timezone: 'Asia/Tehran',
      elevation: 1189,
    });
  });

  it('uppercases the country code, which the provider sends lowercase', () => {
    expect(toPlace(complete).countryCode).toBe('IR');
  });

  describe('absent fields', () => {
    it('keeps a missing region as undefined rather than an empty string', () => {
      // Absent means "we do not know"; the UI renders that differently from
      // "there is none" (CLAUDE.md §11).
      const { admin1: _admin1, ...withoutRegion } = complete;

      expect(toPlace(withoutRegion).admin1).toBeUndefined();
    });

    it('keeps a missing elevation as undefined, NOT zero', () => {
      // An elevation of 0 m (sea level) and an unknown elevation are different
      // facts, and a silent 0 would be wrong for coastal cities.
      const { elevation: _elevation, ...withoutElevation } = complete;

      expect(toPlace(withoutElevation).elevation).toBeUndefined();
    });

    it('falls back to UTC when the provider omits the timezone', () => {
      const { timezone: _timezone, ...withoutTimezone } = complete;

      // A forecast in the wrong zone is wrong in a way that looks plausible;
      // UTC at least makes the problem visible.
      expect(toPlace(withoutTimezone).timezone).toBe('UTC');
    });

    it('defaults missing country fields to empty strings', () => {
      const { country: _c, country_code: _cc, ...withoutCountry } = complete;
      const mapped = toPlace(withoutCountry);

      expect(mapped.country).toBe('');
      expect(mapped.countryCode).toBe('');
    });
  });
});

describe('toSearchResult', () => {
  it('includes everything from toPlace', () => {
    const result = toSearchResult(complete);

    expect(result).toMatchObject(toPlace(complete));
  });

  it('converts the numeric provider id to a string', () => {
    // The entity uses strings so a future provider with opaque ids needs no
    // entity change.
    expect(toSearchResult(complete).id).toBe('112931');
    expect(typeof toSearchResult(complete).id).toBe('string');
  });

  it('carries population for ranking', () => {
    expect(toSearchResult(complete).population).toBe(7_153_309);
  });

  it('keeps a missing population as undefined', () => {
    const { population: _population, ...withoutPopulation } = complete;

    expect(toSearchResult(withoutPopulation).population).toBeUndefined();
  });
});
