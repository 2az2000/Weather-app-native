import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo app configuration.
 *
 * This project uses prebuild / Continuous Native Generation (ADR-0001):
 * `android/` and `ios/` are GENERATED artifacts and are gitignored. All native
 * configuration must be expressed here or in a config plugin — editing the
 * generated native folders directly means the change is destroyed on the next
 * `expo prebuild`.
 *
 * Secrets are read from the environment (EAS Secrets in CI, `.env` locally) and
 * surfaced through `extra`. They are consumed only via `src/core/config`
 * (Phase 1), never read inline elsewhere — see CLAUDE.md §9 and ADR-0003.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Weather',
  slug: 'weather',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'weather',
  // The New Architecture (Fabric/TurboModules) is the only architecture in
  // SDK 57 / RN 0.86, so there is no longer a flag to opt into it. Every new
  // native dependency must be New Architecture compatible (CLAUDE.md §37).
  userInterfaceStyle: 'automatic',

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.amirali.weather',
  },

  android: {
    package: 'com.amirali.weather',
  },

  plugins: ['expo-router'],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    // Open-Meteo (primary provider) requires NO key — see ADR-0002.
    // Only these three services need one, and none guards the primary
    // weather data path.
    openWeatherApiKey: process.env.OPENWEATHER_API_KEY ?? '',
    mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN ?? '',
    mapboxDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN ?? '',
  },
});
