import { validateResponse, type HttpClient } from '@/core/api';
import { err, ok, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';

import type { LocationSearchResult } from '../../domain';
import { openMeteoGeocodingResponseSchema } from '../dto/open-meteo-geocoding-dto';
import { toSearchResult } from '../mappers/place-mapper';

/** Open-Meteo caps this; asking for more returns fewer, not an error. */
const MAX_RESULTS = 10;

/**
 * City search via Open-Meteo Geocoding.
 *
 * No API key (ADR-0002). Results are localised by the provider where it has
 * translations, which is what makes searching in Persian return Persian city
 * names rather than transliterations.
 */
export class RemoteGeocodingDataSource {
  constructor(
    private readonly client: HttpClient,
    private readonly logger: Logger,
  ) {}

  async search(
    query: string,
    locale: string,
  ): Promise<Result<LocationSearchResult[], AppError>> {
    const response = await this.client.get<unknown>('/search', {
      params: { name: query, count: MAX_RESULTS, language: locale, format: 'json' },
    });

    if (response.isErr()) return err(response.error);

    const parsed = validateResponse(
      openMeteoGeocodingResponseSchema,
      response.value,
      { provider: 'open-meteo-geocoding', endpoint: '/search' },
      this.logger,
    );

    if (parsed.isErr()) return err(parsed.error);

    // `results` is ABSENT rather than empty when nothing matches. "No matches"
    // is a successful search with zero hits, not a failure.
    return ok((parsed.value.results ?? []).map(toSearchResult));
  }
}
