import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createKeyValueStorage } from '@/core/storage';

/**
 * Whether the OS location dialog has ever been shown.
 *
 * CLIENT state (ADR-0005): a fact about what this app has done on this device.
 * Nothing fetched lands here.
 *
 * This is deliberately NOT "was permission granted". That answer belongs to the
 * OS and is read through `useLocationPermission` — mirroring it here would
 * create a second source of truth that goes stale the moment the user changes
 * the setting outside the app (CLAUDE.md §8).
 *
 * What the OS cannot tell us is whether it has ever been ASKED. `denied` covers
 * both "never prompted" and "prompted and refused", and the app must treat
 * those differently: the first deserves a prompt, the second must not be
 * re-prompted on every launch.
 *
 * Its own store rather than a field on `useSelectedLocationStore` or
 * `usePreferencesStore`: one store per concern (CLAUDE.md §8), and this is
 * neither a selected location nor a user preference.
 *
 * Persisted to MMKV so it is readable SYNCHRONOUSLY on the first frame. An
 * async read would let the auto-request fire on a relaunch before the flag had
 * loaded, which is precisely the repeat prompt this exists to prevent
 * (ADR-0004).
 */
interface LocationPermissionState {
  readonly hasRequested: boolean;

  /** Record that the dialog has been shown, whatever the user answered. */
  markRequested(): void;
}

const storage = createKeyValueStorage('weather.location-permission');

export const useLocationPermissionStore = create<LocationPermissionState>()(
  persist(
    (set) => ({
      hasRequested: false,

      markRequested: () => {
        set({ hasRequested: true });
      },
    }),
    {
      name: 'location-permission',
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
