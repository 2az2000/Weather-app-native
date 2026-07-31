import { err, validationError, type AppError, type Result } from '@/core/errors';

import type { LocationRepository } from '../repositories/location-repository';

/**
 * Persist a new order for the saved list.
 *
 * Validates that the incoming ids are a PERMUTATION of what is stored. A
 * drag-and-drop bug that drops or duplicates an id would otherwise silently
 * delete a location or corrupt the ordering, and the damage would already be
 * written to disk before anyone noticed.
 */
export class ReorderLocations {
  constructor(private readonly repository: LocationRepository) {}

  async execute(orderedIds: readonly string[]): Promise<Result<void, AppError>> {
    const saved = await this.repository.getSavedLocations();
    if (saved.isErr()) return err(saved.error);

    const savedIds = new Set(saved.value.map((location) => location.id));
    const incoming = new Set(orderedIds);

    if (incoming.size !== orderedIds.length) {
      return err(validationError(['the new order contains a duplicate id']));
    }

    if (incoming.size !== savedIds.size) {
      return err(validationError(['the new order must contain every saved location']));
    }

    for (const id of orderedIds) {
      if (!savedIds.has(id)) {
        return err(validationError([`unknown location id: ${id}`]));
      }
    }

    return this.repository.reorderLocations(orderedIds);
  }
}
