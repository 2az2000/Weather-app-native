import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { GC_TIME, STALE_TIME } from '@/core/config';
import { useContainer } from '@/core/di';
import type { AppError, Result } from '@/core/errors';

import type { Place, SavedLocation } from '../../domain';
import { useLocationPermissionStore } from '../stores/location-permission-store';

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

export interface UseLocationPermissionOptions {
  /**
   * Show the OS dialog once, unprompted, if it has never been shown.
   *
   * Opt-IN rather than default, so the side effect belongs to the screen that
   * wants it. The home screen does — it is useless without a location, and a
   * weather app asking on launch is the behaviour users expect. The locations
   * list does not: it is reached deliberately, and its own prompt card is the
   * better invitation there.
   */
  readonly autoRequest?: boolean;
}

export function useLocationPermission({
  autoRequest = false,
}: UseLocationPermissionOptions = {}) {
  const { deviceLocation } = useContainer();
  const queryClient = useQueryClient();

  const hasRequested = useLocationPermissionStore((state) => state.hasRequested);
  const markRequested = useLocationPermissionStore((state) => state.markRequested);

  const query = useQuery({
    queryKey: locationKeys.permission(),
    queryFn: async (): Promise<LocationPermissionStatus> => {
      const state = await deviceLocation.getPermissionState();
      if (state.granted) return 'granted';
      return state.canAskAgain ? 'denied' : 'blocked';
    },
    staleTime: 0,
  });

  /**
   * A mutation rather than a hand-rolled `useState` flag.
   *
   * Showing the dialog is an imperative action with a pending state and a
   * result — exactly what every other action in this file uses `useMutation`
   * for. It also keeps the pending flag out of this component's own state,
   * which matters because the auto-request below fires from an effect: a
   * `setState` called synchronously in an effect body causes the cascading
   * render `react-hooks/set-state-in-effect` exists to prevent.
   */
  const mutation = useMutation({
    mutationFn: async (): Promise<LocationPermissionStatus> => {
      // Recorded BEFORE awaiting, and here rather than only on the auto path:
      // any call means the dialog has been shown, so a re-render while it is
      // open cannot schedule a second one.
      markRequested();

      const state = await deviceLocation.requestPermission();
      return state.granted ? 'granted' : state.canAskAgain ? 'denied' : 'blocked';
    },

    onSuccess: (status) => {
      queryClient.setQueryData(locationKeys.permission(), status);

      if (status === 'granted') {
        void queryClient.invalidateQueries({ queryKey: locationKeys.current() });
      }
    },
  });

  const { mutateAsync } = mutation;

  const request = useCallback(
    async (): Promise<LocationPermissionStatus> => mutateAsync(),
    [mutateAsync],
  );

  const status: LocationPermissionStatus = query.data ?? 'unknown';

  useEffect(() => {
    if (!autoRequest || hasRequested) return;

    // Only `denied`, never `blocked`. When the OS will no longer prompt,
    // `request` resolves instantly with no dialog — auto-firing it would burn
    // the flag and leave the user looking at a card offering a button that
    // cannot do anything, for a permission only Settings can now change.
    //
    // `unknown` is excluded too: the status query has not resolved yet, and
    // asking before knowing the answer risks prompting someone who has already
    // granted it.
    if (status !== 'denied') return;

    void request();
  }, [autoRequest, hasRequested, status, request]);

  return {
    status,
    isLoading: query.isLoading,
    isRequesting: mutation.isPending,
    request,
  };
}
