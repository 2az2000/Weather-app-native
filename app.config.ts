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

  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-localization',
    [
      'expo-location',
      {
        // Autolinking already puts the permissions in the manifest, so the app
        // works without this entry. What the plugin adds is the RATIONALE the
        // system dialog shows. Phase 3 built designed permission-denied and
        // permanently-denied flows; letting the OS ask with no explanation
        // undercuts them, because a user who declines a blank prompt never
        // reaches those screens in an informed state.
        locationWhenInUsePermission:
          'Weather uses your location to show the forecast where you are.',
      },
    ],
    [
      'expo-font',
      {
        // Persian only. Latin uses the SYSTEM font (SF Pro / Roboto) — the same
        // choice Apple Weather makes, and it participates in Dynamic Type at no
        // bundle cost. Persian has no equivalent option: Arabic-script coverage
        // in system fonts varies by OS version and the metrics are not tuned for
        // Persian at UI sizes (CLAUDE.md §18).
        fonts: [
          './assets/fonts/Vazirmatn-Regular.ttf',
          './assets/fonts/Vazirmatn-Medium.ttf',
          './assets/fonts/Vazirmatn-SemiBold.ttf',
          './assets/fonts/Vazirmatn-Bold.ttf',
        ],
      },
    ],
  ],

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

    // Set by hand rather than by `eas init`, which cannot write to a DYNAMIC
    // config — the same limitation `expo install` hit when adding plugins.
    // If this drifts from the project on expo.dev, builds fail with a
    // mismatched-project error rather than anything descriptive.
    eas: {
      projectId: 'db286aaf-4ed0-4d67-b50e-2620dee7dae4',
    },
  },
});
