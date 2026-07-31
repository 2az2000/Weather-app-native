import { err, validationError, type AppError, type Result } from '@/core/errors';

import { isValidCoordinates, type Coordinates } from '../entities/coordinates';
import type { Place } from '../entities/place';
import type { LocationRepository } from '../repositories/location-repository';

/**
 * Resolve coordinates to a place name.
 *
 * Validates before calling out: a NaN or out-of-range coordinate would
 * otherwise reach a URL and fail somewhere unrelated, with an error that says
 * nothing about the real cause.
 */
export class ReverseGeocode {
  constructor(private readonly repository: LocationRepository) {}

  execute(coordinates: Coordinates): Promise<Result<Place, AppError>> {
    if (!isValidCoordinates(coordinates)) {
      return Promise.resolve(
        err(validationError(['coordinates are outside the valid range'])),
      );
    }

    return this.repository.reverseGeocode(coordinates);
  }
}
