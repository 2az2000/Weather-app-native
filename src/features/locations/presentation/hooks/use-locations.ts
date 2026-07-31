import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { GC_TIME, STALE_TIME } from '@/core/config';
import { useContainer } from '@/core/di';
import type { AppError, Result } from '@/core/errors';

import type { Place, SavedLocation } from '../../domain';

import { locationKeys } from './query-keys';

/**
 * Query hooks for locations.
 *
 * Hooks call USE CASES, never repositories or data sources (CLAUDE.md §16).
 * Use cases come from the container, so a test renders against fakes with no
 * module mocking.
 *
 * Queries resolve `Result` — a failure is THROWN here, at the query boundary,
 * so TanStack's error state works normally. That is the one place unwrapping is
 * correct: everything below has already handled failure as a value.
 */
function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isErr()) throw result.error;
  return result.value;
}

/** The device's current position, resolved to a named place. */
export function useCurrentLocation(enabled = true) {
  const { locations } = useContainer();

  return useQuery({
    queryKey: locationKeys.current(),
    queryFn: async () => unwrap(await locations.getCurrentLocation.execute()),
    enabled,
    // A device does not teleport. Re-resolving more often than this spends
    // battery on GPS for an answer that has not changed.
    staleTime: STALE_TIME.current,
    gcTime: GC_TIME.current,
  });
}

/** The user's saved locations, in their chosen order. */
export function useSavedLocations() {
  const { locationRepository } = useContainer();

  return useQuery({
    queryKey: locationKeys.saved(),
    queryFn: async () => unwrap(await locationRepository.getSavedLocations()),
    // Local data with no remote counterpart — it cannot go stale behind our
    // back, so it is only refetched when something here invalidates it.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * City search.
 *
 * @param query - Already debounced by the caller. Debouncing here would tie the
 *   delay to the data layer rather than to the input that produces it.
 */
export function useCitySearch(query: string, locale: string) {
  const { locations } = useContainer();

  return useQuery({
    queryKey: locationKeys.search(query, locale),
    queryFn: async () => unwrap(await locations.searchCities.execute(query, locale)),
    // The use case rejects anything shorter, but not issuing the query at all
    // avoids a pointless render cycle.
    enabled: query.trim().length >= 2,
    // City coordinates are effectively static (CLAUDE.md §25).
    staleTime: STALE_TIME.geocoding,
    gcTime: GC_TIME.geocoding,
  });
}

export function useRecentSearches() {
  const { locationRepository } = useContainer();

  return useQuery({
    queryKey: locationKeys.recentSearches(),
    queryFn: async () => unwrap(await locationRepository.getRecentSearches()),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Save a place, with an optimistic insert and rollback on failure. */
export function useSaveLocation() {
  const { locations } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (place: Place) =>
      unwrap(await locations.saveLocation.execute(place)),

    onMutate: async (place) => {
      await queryClient.cancelQueries({ queryKey: locationKeys.saved() });
      const previous = queryClient.getQueryData<SavedLocation[]>(locationKeys.saved());

      // Optimistic: the row appears immediately. The temporary id is replaced
      // when the real one arrives (CLAUDE.md §24 rule 3).
      queryClient.setQueryData<SavedLocation[]>(locationKeys.saved(), (current = []) => [
        ...current,
        {
          ...place,
          id: `optimistic-${String(Date.now())}`,
          sortOrder: current.length,
          isCurrentLocation: false,
          savedAt: new Date(),
        },
      ]);

      return { previous };
    },

    onError: (_error, _place, context) => {
      // Roll back to exactly what was there before, rather than refetching —
      // the user should not see their list flicker through an empty state.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(locationKeys.saved(), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: locationKeys.saved() });
    },
  });
}

export function useRemoveLocation() {
  const { locationRepository } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await locationRepository.removeLocation(id)),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: locationKeys.saved() });
      const previous = queryClient.getQueryData<SavedLocation[]>(locationKeys.saved());

      queryClient.setQueryData<SavedLocation[]>(locationKeys.saved(), (current = []) =>
        current.filter((location) => location.id !== id),
      );

      return { previous };
    },

    onError: (_error, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(locationKeys.saved(), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: locationKeys.saved() });
    },
  });
}

/** Reorder the saved list, applied optimistically. */
export function useReorderLocations() {
  const { locations } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: readonly string[]) =>
      unwrap(await locations.reorderLocations.execute(orderedIds)),

    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: locationKeys.saved() });
      const previous = queryClient.getQueryData<SavedLocation[]>(locationKeys.saved());

      // A drag must land instantly. Waiting for a round trip makes the list
      // feel like it is fighting the user's finger.
      queryClient.setQueryData<SavedLocation[]>(locationKeys.saved(), (current = []) => {
        const byId = new Map(current.map((location) => [location.id, location]));

        return orderedIds
          .map((id, index) => {
            const location = byId.get(id);
            return location === undefined ? undefined : { ...location, sortOrder: index };
          })
          .filter((location): location is SavedLocation => location !== undefined);
      });

      return { previous };
    },

    onError: (_error, _ids, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(locationKeys.saved(), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: locationKeys.saved() });
    },
  });
}

/**
 * Location permission, as a state machine the UI can switch on.
 *
 * `blocked` is deliberately distinct from `denied`: when the OS will no longer
 * show a prompt, asking again does nothing, and the app must send the user to
 * Settings instead (ROADMAP Phase 3 DoD).
 */
export type LocationPermissionStatus = 'unknown' | 'granted' | 'denied' | 'blocked';

export function useLocationPermission() {
  const { deviceLocation } = useContainer();
  const queryClient = useQueryClient();
  const [isRequesting, setIsRequesting] = useState(false);

  const query = useQuery({
    queryKey: locationKeys.permission(),
    queryFn: async (): Promise<LocationPermissionStatus> => {
      const state = await deviceLocation.getPermissionState();
      if (state.granted) return 'granted';
      return state.canAskAgain ? 'denied' : 'blocked';
    },
    staleTime: 0,
  });

  const request = useCallback(async (): Promise<LocationPermissionStatus> => {
    setIsRequesting(true);
    try {
      const state = await deviceLocation.requestPermission();
      const status: LocationPermissionStatus = state.granted
        ? 'granted'
        : state.canAskAgain
          ? 'denied'
          : 'blocked';

      queryClient.setQueryData(locationKeys.permission(), status);

      if (status === 'granted') {
        void queryClient.invalidateQueries({ queryKey: locationKeys.current() });
      }

      return status;
    } finally {
      setIsRequesting(false);
    }
  }, [deviceLocation, queryClient]);

  return {
    status: query.data ?? 'unknown',
    isLoading: query.isLoading,
    isRequesting,
    request,
  };
}
