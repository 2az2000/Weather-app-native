import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * Typed, validated environment access.
 *
 * Secrets are read here and NOWHERE else (CLAUDE.md §9, ADR-0003). Keeping the
 * surface to one file means key rotation, or later moving behind a proxy,
 * touches a single module.
 *
 * Validation runs at STARTUP, not on first use — a missing variable must fail
 * immediately with a message naming the variable, rather than surfacing as a
 * confusing 401 three screens into the app.
 *
 * Note which keys are ABSENT: Open-Meteo serves forecast, historical, air
 * quality, and geocoding without any credential (ADR-0002), so the primary data
 * path has no secret to leak.
 */

const envSchema = z.object({
  /** OpenWeather One Call 3.0 — severe alerts and resilience fallback. */
  openWeatherApiKey: z.string().min(1, 'OPENWEATHER_API_KEY is required'),

  /**
   * Mapbox public token for map tiles.
   *
   * MUST be URL-restricted to the app's bundle identifiers. An unrestricted
   * token is a billing incident waiting to happen (ADR-0003).
   */
  mapboxAccessToken: z.string().min(1, 'MAPBOX_ACCESS_TOKEN is required'),
});

export type Env = z.infer<typeof envSchema>;

/** Every key optional — the shape before required-key checking. */
type PartialEnv = { [K in keyof Env]?: Env[K] | undefined };

/**
 * Which features require which variables.
 *
 * Phase 1 has no screens that need a key, so nothing is required yet. As
 * Phases 8 and 9 land, their variables move into `required` and a missing value
 * then fails the build-time check rather than the user's session.
 */
const REQUIRED_KEYS: readonly (keyof Env)[] = [];

class EnvironmentError extends Error {
  constructor(issues: readonly string[]) {
    super(
      [
        'Environment configuration is invalid:',
        ...issues.map((issue) => `  • ${issue}`),
        '',
        'Copy .env.example to .env and fill in the missing values.',
        'In CI and EAS builds these come from EAS Secrets (ADR-0003).',
      ].join('\n'),
    );
    this.name = 'EnvironmentError';
  }
}

function readRawEnv(): Record<string, unknown> {
  // `extra` is populated by app.config.ts from process.env at build time.
  return (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
}

/**
 * Validate the environment and return it typed.
 *
 * @throws {EnvironmentError} When a required variable is missing or malformed.
 *   Called from the root layout so the failure happens at startup.
 */
export function loadEnv(): Env {
  const raw = readRawEnv();

  // Partial parse: every key is validated for SHAPE, but only keys in
  // REQUIRED_KEYS are validated for PRESENCE. This lets Phase 1 boot with no
  // secrets configured while still failing loudly once a phase needs one.
  const result = envSchema.partial().safeParse(raw);

  const issues: string[] = result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

  const parsed: PartialEnv = result.success ? result.data : {};

  for (const key of REQUIRED_KEYS) {
    if (parsed[key] === undefined || parsed[key] === '') {
      issues.push(`${key} is required but was empty`);
    }
  }

  if (issues.length > 0) {
    throw new EnvironmentError(issues);
  }

  return {
    openWeatherApiKey: parsed.openWeatherApiKey ?? '',
    mapboxAccessToken: parsed.mapboxAccessToken ?? '',
  };
}

export { EnvironmentError };
