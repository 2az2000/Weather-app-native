/**
 * Settings — user preferences.
 *
 * Owns units, theme mode, language, and (from Phase 9) notification preferences.
 * All of it is CLIENT state: decisions the user made, authoritative locally, and
 * never stale (ADR-0005).
 *
 * Public surface: the preferences store and its types. Screens land in a later
 * phase; Phase 2 needs only the store, because the theme and i18n bootstrap read
 * from it.
 */
export { usePreferencesStore } from './presentation/stores/preferences-store';
export type { ThemeMode, TemperatureUnit } from './presentation/stores/preferences-store';
