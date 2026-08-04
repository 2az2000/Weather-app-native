import { geohash } from '@/shared/utils';
import type { Coordinates } from '@/shared/types';

/**
 * Query keys for weather.
 *
 * **Centralised, never inlined** (CLAUDE.md §8). An inline key array at a call
 * site is how cache invalidation silently breaks: two spellings of the same
 * logical key look identical in review and behave as different caches.
 *
 * **Every key is built from a QUANTIZED cell, never raw floats.** A GPS fix
 * drifts metres between reads, so raw coordinates produce a different key —
 * and therefore a cache miss — on literally every refresh (CLAUDE.md §25).
 */
export const weatherKeys = {
  all: ['weather'] as const,

  forecast: (coordinates: Coordinates) =>
    [...weatherKeys.all, 'forecast', geohash(coordinates)] as const,

  alerts: (coordinates: Coordinates) =>
    [...weatherKeys.all, 'alerts', geohash(coordinates)] as const,

  historical: (coordinates: Coordinates, from: Date, to: Date) =>
    [
      ...weatherKeys.all,
      'historical',
      geohash(coordinates),
      from.toISOString().slice(0, 10),
      to.toISOString().slice(0, 10),
    ] as const,
} as const;
