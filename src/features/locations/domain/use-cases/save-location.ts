import { err, ok, validationError, type AppError, type Result } from '@/core/errors';

import { distanceKm } from '../entities/coordinates';
import type { Place, SavedLocation } from '../entities/place';
import type { LocationRepository } from '../repositories/location-repository';

/** Guards against an unbounded list that would be unusable and slow to sync. */
export const MAX_SAVED_LOCATIONS = 20;

/**
 * Below this, two results are treated as the same place.
 *
 * Expressed as a DISTANCE rather than a geohash cell: "the same city" is a
 * domain judgement, and `distanceKm` already lives in the domain. Reaching into
 * `shared/utils` for a cache-key utility would both break the dependency rule
 * and describe the intent less honestly.
 *
 * 5 km matches the weather grid — two points closer than this share a forecast.
 */
const DUPLICATE_THRESHOLD_KM = 5;

/**
 * Save a place to the user's list.
 *
 * Owns two business rules:
 *
 * 1. **No duplicates.** Two searches for the same city return coordinates that
 *    differ in the last decimals, so equality is decided by geohash CELL rather
 *    than exact float match — otherwise "Tehran" could be saved repeatedly.
 * 2. **A bounded list**, so the UI and future sync stay predictable.
 */
export class SaveLocation {
  constructor(private readonly repository: LocationRepository) {}

  async execute(place: Place): Promise<Result<SavedLocation, AppError>> {
    const existing = await this.repository.getSavedLocations();
    if (existing.isErr()) return err(existing.error);

    const duplicate = existing.value.find(
      (saved) =>
        distanceKm(saved.coordinates, place.coordinates) < DUPLICATE_THRESHOLD_KM,
    );
    if (duplicate !== undefined) {
      // Idempotent rather than an error: the user asked for this place to be in
      // their list, and it is.
      return ok(duplicate);
    }

    if (existing.value.length >= MAX_SAVED_LOCATIONS) {
      return err(
        validationError([`at most ${MAX_SAVED_LOCATIONS} locations can be saved`]),
      );
    }

    return this.repository.saveLocation(place);
  }
}
