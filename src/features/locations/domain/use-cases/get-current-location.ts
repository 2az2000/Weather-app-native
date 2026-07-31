import type { AppError, Result } from '@/core/errors';

import type { Place } from '../entities/place';
import type { LocationRepository } from '../repositories/location-repository';

/**
 * Resolve where the device is, as a named place.
 *
 * A thin forwarder today, and worth writing anyway: it is the seam where a
 * "last known position" fallback or a staleness policy will land, and it keeps
 * presentation independent of the repository's shape (CLAUDE.md §6).
 */
export class GetCurrentLocation {
  constructor(private readonly repository: LocationRepository) {}

  execute(): Promise<Result<Place, AppError>> {
    return this.repository.getCurrentLocation();
  }
}
