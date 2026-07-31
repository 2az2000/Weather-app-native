import { usePreferencesStore } from './preferences-store';

/**
 * Preferences are CLIENT state (ADR-0005) — authoritative locally, never stale.
 * These tests assert that boundary as much as the behaviour.
 */
describe('usePreferencesStore', () => {
  const initial = usePreferencesStore.getState();

  beforeEach(() => {
    usePreferencesStore.setState({
      themeMode: initial.themeMode,
      locale: initial.locale,
      temperatureUnit: initial.temperatureUnit,
      pendingLocale: undefined,
    });
  });

  describe('defaults', () => {
    it('follows the device theme rather than forcing one', () => {
      expect(usePreferencesStore.getState().themeMode).toBe('system');
    });

    it('starts in Celsius, the canonical internal unit', () => {
      expect(usePreferencesStore.getState().temperatureUnit).toBe('celsius');
    });

    it('has no pending locale before the user chooses one', () => {
      expect(usePreferencesStore.getState().pendingLocale).toBeUndefined();
    });
  });

  describe('setThemeMode', () => {
    it.each(['light', 'dark', 'system'] as const)('accepts %s', (mode) => {
      usePreferencesStore.getState().setThemeMode(mode);
      expect(usePreferencesStore.getState().themeMode).toBe(mode);
    });

    it('leaves other preferences untouched', () => {
      usePreferencesStore.getState().setTemperatureUnit('fahrenheit');
      usePreferencesStore.getState().setThemeMode('dark');

      expect(usePreferencesStore.getState().temperatureUnit).toBe('fahrenheit');
    });
  });

  describe('locale and the restart flow', () => {
    it('records a pending locale without applying it', () => {
      // Direction only changes on restart (ADR-0006). Applying the locale
      // immediately would render Persian text inside an unmirrored layout.
      usePreferencesStore.getState().setPendingLocale('fa');

      expect(usePreferencesStore.getState().pendingLocale).toBe('fa');
      expect(usePreferencesStore.getState().locale).toBe('en');
    });

    it('clears the pending locale once the locale is actually applied', () => {
      usePreferencesStore.getState().setPendingLocale('fa');
      usePreferencesStore.getState().setLocale('fa');

      expect(usePreferencesStore.getState().locale).toBe('fa');
      expect(usePreferencesStore.getState().pendingLocale).toBeUndefined();
    });

    it('allows a pending selection to be cancelled', () => {
      usePreferencesStore.getState().setPendingLocale('fa');
      usePreferencesStore.getState().setPendingLocale(undefined);

      expect(usePreferencesStore.getState().pendingLocale).toBeUndefined();
    });
  });

  describe('temperature unit', () => {
    it('switches between Celsius and Fahrenheit', () => {
      usePreferencesStore.getState().setTemperatureUnit('fahrenheit');
      expect(usePreferencesStore.getState().temperatureUnit).toBe('fahrenheit');

      usePreferencesStore.getState().setTemperatureUnit('celsius');
      expect(usePreferencesStore.getState().temperatureUnit).toBe('celsius');
    });
  });

  describe('persistence contract', () => {
    it('declares a version, so a shape change can be migrated', () => {
      // Retrofitting migrations onto preferences already on users' devices
      // means writing a recovery path for every shape ever shipped
      // (CLAUDE.md §8).
      expect(usePreferencesStore.persist.getOptions().version).toBe(1);
    });

    it('supplies a migration for the version that predates pendingLocale', () => {
      const migrate = usePreferencesStore.persist.getOptions().migrate;
      expect(migrate).toBeDefined();

      const migrated = migrate?.({ themeMode: 'dark', locale: 'en' }, 0) as {
        pendingLocale?: unknown;
        themeMode?: string;
      };

      expect(migrated.pendingLocale).toBeUndefined();
      expect(migrated.themeMode).toBe('dark');
    });

    it('passes newer state through unchanged', () => {
      const migrate = usePreferencesStore.persist.getOptions().migrate;
      const state = { themeMode: 'light', locale: 'fa', pendingLocale: undefined };

      expect(migrate?.(state, 1)).toBe(state);
    });
  });

  it('holds no server data — only user decisions', () => {
    // A forecast in this store would be a second, silently stale source of
    // truth (ADR-0005). The shape is asserted so that stays true.
    expect(Object.keys(usePreferencesStore.getState()).sort()).toEqual([
      'locale',
      'pendingLocale',
      'setLocale',
      'setPendingLocale',
      'setTemperatureUnit',
      'setThemeMode',
      'temperatureUnit',
      'themeMode',
    ]);
  });
});
