/**
 * Sky conditions, provider-agnostic.
 *
 * Deliberately coarser than any provider's code list: WMO defines 28+ codes and
 * OpenWeather has its own scheme, but they collapse into far fewer *skies* that
 * a user can distinguish and that the app needs to draw differently.
 *
 * This union is the SHARED VOCABULARY both providers map into — the thing that
 * makes them interchangeable (CLAUDE.md §11).
 *
 * It intentionally matches `theme/weather` so a condition can drive the
 * background gradient without a translation step.
 */
export const WEATHER_CONDITIONS = [
  'clear',
  'partlyCloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'heavyRain',
  'snow',
  'sleet',
  'thunderstorm',
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

/** Severity of a weather alert, ordered from least to most urgent. */
export const ALERT_SEVERITIES = ['advisory', 'watch', 'warning', 'emergency'] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/**
 * A severe weather alert issued by a meteorological authority.
 *
 * Sourced from OpenWeather (ADR-0002) — Open-Meteo does not publish warnings.
 */
export interface SevereAlert {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: AlertSeverity;
  /** The issuing authority, shown so users can judge the source. */
  readonly sender: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/** Whether an alert is currently in effect. */
export function isAlertActive(alert: SevereAlert, now: Date = new Date()): boolean {
  return (
    alert.startsAt.getTime() <= now.getTime() && now.getTime() <= alert.endsAt.getTime()
  );
}

/**
 * Whether a condition involves falling precipitation.
 *
 * Used by the recommendation engine (Phase 7) and to decide whether to draw
 * particle effects.
 */
export function isPrecipitating(condition: WeatherCondition): boolean {
  return (
    condition === 'drizzle' ||
    condition === 'rain' ||
    condition === 'heavyRain' ||
    condition === 'snow' ||
    condition === 'sleet' ||
    condition === 'thunderstorm'
  );
}

/**
 * Whether a condition warrants caution outdoors.
 *
 * A judgement about the *sky*, not about any threshold — thresholds belong to
 * the recommendation rules in Phase 7.
 */
export function isSevereCondition(condition: WeatherCondition): boolean {
  return condition === 'thunderstorm' || condition === 'heavyRain';
}
