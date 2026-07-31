import * as Location from 'expo-location';

import {
  err,
  fromPromise,
  ok,
  permissionDeniedError,
  unknownError,
  type AppError,
  type Result,
} from '@/core/errors';
import type { Logger } from '@/core/logger';
import { geohash, GEOHASH_PRECISION } from '@/shared/utils';

import type { Coordinates, Place } from '../../domain';

/**
 * GPS and OS-native reverse geocoding.
 *
 * The OS geocoder is preferred over a network one: it is free, needs no key,
 * is often available offline, and already returns names in the device language
 * (ADR-0002). Mapbox is the documented fallback for Phase 8, when its key
 * exists.
 */
export interface PermissionState {
  readonly granted: boolean;
  /**
   * Whether the user can still be asked.
   *
   * `false` means the OS will no longer show a prompt, so the app must send the
   * user to Settings instead of calling `request` again to no effect
   * (ROADMAP Phase 3 DoD).
   */
  readonly canAskAgain: boolean;
}

export class DeviceLocationDataSource {
  constructor(private readonly logger: Logger) {}

  async getPermissionState(): Promise<PermissionState> {
    const status = await Location.getForegroundPermissionsAsync();
    return { granted: status.granted, canAskAgain: status.canAskAgain };
  }

  async requestPermission(): Promise<PermissionState> {
    const status = await Location.requestForegroundPermissionsAsync();
    return { granted: status.granted, canAskAgain: status.canAskAgain };
  }

  async getCurrentCoordinates(): Promise<Result<Coordinates, AppError>> {
    const permission = await this.getPermissionState();

    if (!permission.granted) {
      // A refusal is a normal user decision, not an exceptional condition — it
      // is modelled as a typed error so the UI can offer the right next step.
      return err(permissionDeniedError('location'));
    }

    const position = await fromPromise(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      (cause) => {
        this.logger.warn('locations.gps.failed', { cause });
        return unknownError(cause);
      },
    );

    if (position.isErr()) return err(position.error);

    const coordinates = {
      latitude: position.value.coords.latitude,
      longitude: position.value.coords.longitude,
    };

    // Never log a raw position — it is a record of where a person was
    // (CLAUDE.md §23). A coarse cell is enough to debug a cache problem.
    this.logger.debug('locations.gps.resolved', {
      cell: geohash(coordinates, GEOHASH_PRECISION.logging),
    });

    return ok(coordinates);
  }

  /** Resolve coordinates to a place name using the OS geocoder. */
  async reverseGeocode(coordinates: Coordinates): Promise<Result<Place, AppError>> {
    const results = await fromPromise(
      Location.reverseGeocodeAsync(coordinates),
      (cause) => unknownError(cause),
    );

    if (results.isErr()) return err(results.error);

    const first = results.value[0];
    if (first === undefined) {
      return err(unknownError('the OS geocoder returned no match'));
    }

    return ok({
      coordinates,
      // The OS may fill any one of these depending on how rural the point is.
      name: first.city ?? first.subregion ?? first.region ?? first.country ?? 'Unknown',
      admin1: first.region ?? undefined,
      countryCode: (first.isoCountryCode ?? '').toUpperCase(),
      country: first.country ?? '',
      // The OS geocoder does not report a timezone; the weather provider
      // supplies it alongside the forecast.
      timezone: 'auto',
      elevation: undefined,
    });
  }
}
