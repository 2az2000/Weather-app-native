import { ok, type AppError, type Result } from '@/core/errors';

import type { LocationSearchResult } from '../entities/place';
import type { LocationRepository } from '../repositories/location-repository';

/** Below this, a query matches too much to be useful. */
const MIN_QUERY_LENGTH = 2;

/**
 * Search for a city by name.
 *
 * Owns two rules that are business decisions, not UI concerns — which is why
 * they live here rather than in a component:
 *
 * 1. **A too-short query returns nothing rather than searching.** One character
 *    matches thousands of places and wastes a request on a useless answer.
 * 2. **A successful search is recorded** so it can be offered again later.
 */
export class SearchCities {
  constructor(private readonly repository: LocationRepository) {}

  async execute(
    query: string,
    locale: string,
  ): Promise<Result<LocationSearchResult[], AppError>> {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return ok([]);
    }

    const results = await this.repository.searchCities(trimmed, locale);

    // Recording is best-effort: a failure to remember a search must never fail
    // the search itself.
    if (results.isOk() && results.value.length > 0) {
      await this.repository.recordSearch(trimmed);
    }

    return results;
  }
}
