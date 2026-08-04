import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createKeyValueStorage } from '@/core/storage';

/**
 * Which saved location the app is currently showing.
 *
 * CLIENT state (ADR-0005): a choice the user made, authoritative locally, and
 * never stale. Only the ID is kept — the location's DATA belongs to TanStack
 * Query, and copying it here would create a second source of truth that goes
 * stale the moment a name or coordinate is corrected (CLAUDE.md §8).
 *
 * Persisted to MMKV so the app reopens on the location it was last showing,
 * readable synchronously on the first frame (ADR-0004).
 *
 * Lives in `locations` rather than `weather` because it is a fact about
 * locations, and both the home screen and the location list need it.
 */
interface SelectedLocationState {
  /**
   * The chosen saved location, or `undefined` to follow the device's position.
   *
   * `undefined` is the DEFAULT and a meaningful value, not an empty state: a
   * fresh install shows wherever the user is.
   */
  readonly selectedId: string | undefined;

  select(id: string): void;
  /** Follow the device's current position again. */
  followCurrentLocation(): void;
  /**
   * Clear the selection if it points at `id`.
   *
   * Called when a location is deleted, so the app falls back to the device
   * position rather than pointing at something that no longer exists.
   */
  clearIfSelected(id: string): void;
}

const storage = createKeyValueStorage('weather.selected-location');

export const useSelectedLocationStore = create<SelectedLocationState>()(
  persist(
    (set, get) => ({
      selectedId: undefined,

      select: (selectedId) => {
        set({ selectedId });
      },

      followCurrentLocation: () => {
        set({ selectedId: undefined });
      },

      clearIfSelected: (id) => {
        if (get().selectedId === id) set({ selectedId: undefined });
      },
    }),
    {
      name: 'selected-location',
      storage: createJSONStorage(() => ({
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      })),
      version: 1,
    },
  ),
);
