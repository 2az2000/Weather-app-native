import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_LOCALE, type Locale } from '@/core/i18n';
import { createKeyValueStorage } from '@/core/storage';

/**
 * User preferences — CLIENT state (ADR-0005).
 *
 * These are decisions the user made. They are authoritative locally and can
 * never be stale, which is exactly what distinguishes them from server state.
 * Nothing fetched ever lands here.
 *
 * Persisted to MMKV so they are readable SYNCHRONOUSLY on the first frame — the
 * theme cannot flash the wrong colours while an async read resolves (ADR-0004).
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

interface PreferencesState {
  readonly themeMode: ThemeMode;
  readonly locale: Locale;
  readonly temperatureUnit: TemperatureUnit;
  /**
   * Locale the user selected but which has not taken effect yet.
   *
   * Layout direction only changes on restart (ADR-0006), so a pending Persian
   * selection is recorded here until the user restarts. Without this, the app
   * would show Persian text in a left-to-right layout after a language switch.
   */
  readonly pendingLocale: Locale | undefined;

  setThemeMode(mode: ThemeMode): void;
  setLocale(locale: Locale): void;
  setPendingLocale(locale: Locale | undefined): void;
  setTemperatureUnit(unit: TemperatureUnit): void;
}

const storage = createKeyValueStorage('weather.preferences');

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      locale: DEFAULT_LOCALE,
      temperatureUnit: 'celsius',
      pendingLocale: undefined,

      setThemeMode: (themeMode) => {
        set({ themeMode });
      },
      setLocale: (locale) => {
        set({ locale, pendingLocale: undefined });
      },
      setPendingLocale: (pendingLocale) => {
        set({ pendingLocale });
      },
      setTemperatureUnit: (temperatureUnit) => {
        set({ temperatureUnit });
      },
    }),
    {
      name: 'preferences',

      storage: createJSONStorage(() => ({
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      })),

      // An explicit version and migration from day one. Retrofitting these onto
      // preferences already on users' devices means writing a recovery path for
      // every shape ever shipped (CLAUDE.md §8).
      version: 1,
      migrate: (persisted, fromVersion) => {
        if (fromVersion === 0) {
          // v0 had no `pendingLocale`. Absent is the correct default.
          return { ...(persisted as object), pendingLocale: undefined };
        }
        return persisted;
      },
    },
  ),
);
