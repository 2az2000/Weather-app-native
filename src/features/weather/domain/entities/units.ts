/**
 * Unit value objects.
 *
 * **A raw `number` for temperature invites a Celsius/Fahrenheit mix-up the
 * compiler cannot catch** (CLAUDE.md §12). Branding makes the unit part of the
 * type, so passing a Fahrenheit value where Celsius is expected is a build
 * error rather than a wrong number on a screen.
 *
 * ## Canonical units
 *
 * Everything is stored and computed in ONE unit per dimension:
 *
 * | Dimension | Canonical | Why |
 * |---|---|---|
 * | Temperature | °C | What every provider reports natively |
 * | Speed | m/s | SI; km/h and mph are display choices |
 * | Pressure | hPa | Identical to mbar, the meteorological standard |
 * | Distance | m | SI |
 *
 * **Display conversion happens in presentation, driven by user settings**
 * (CLAUDE.md §11). Storing user-preferred units would corrupt the cache the
 * moment the user changes preference — every cached reading would be in a unit
 * nothing records.
 */

declare const brand: unique symbol;

/** Attaches a compile-time-only tag. Erased at runtime; costs nothing. */
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Celsius = Brand<number, 'Celsius'>;
export type MetersPerSecond = Brand<number, 'MetersPerSecond'>;
export type Hectopascals = Brand<number, 'Hectopascals'>;
export type Meters = Brand<number, 'Meters'>;
export type Degrees = Brand<number, 'Degrees'>;
export type Percent = Brand<number, 'Percent'>;
export type Millimeters = Brand<number, 'Millimeters'>;

// ── Constructors ─────────────────────────────────────────────────────────────
// The ONLY way to produce a branded value, so a raw number can never be
// mistaken for one that has been checked.

export const celsius = (value: number): Celsius => value as Celsius;
export const metersPerSecond = (value: number): MetersPerSecond =>
  value as MetersPerSecond;
export const hectopascals = (value: number): Hectopascals => value as Hectopascals;
export const meters = (value: number): Meters => value as Meters;
export const degrees = (value: number): Degrees => value as Degrees;
export const millimeters = (value: number): Millimeters => value as Millimeters;

/** Clamps to 0–100: a humidity of 103% is a provider bug, not a reading. */
export const percent = (value: number): Percent =>
  Math.min(100, Math.max(0, value)) as Percent;

// ── Display conversions ──────────────────────────────────────────────────────
// Presentation-only. Nothing in domain or data may store a converted value.

export const toFahrenheit = (value: Celsius): number => value * (9 / 5) + 32;
export const toKilometersPerHour = (value: MetersPerSecond): number => value * 3.6;
export const toMilesPerHour = (value: MetersPerSecond): number => value * 2.23694;
export const toKnots = (value: MetersPerSecond): number => value * 1.94384;
export const toInchesOfMercury = (value: Hectopascals): number => value * 0.02953;
export const toMillimetersOfMercury = (value: Hectopascals): number => value * 0.750062;
export const toKilometers = (value: Meters): number => value / 1000;
export const toMiles = (value: Meters): number => value / 1609.344;

/**
 * Compass point for a wind bearing.
 *
 * ⚠️ **Never mirror this under RTL.** North is north in every language — the
 * compass is one of the few things that must not flip (CLAUDE.md §19).
 */
export const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

/**
 * Convert a bearing in degrees to a 16-point compass direction.
 *
 * @param bearing - Degrees clockwise from north. Values outside 0–360 wrap.
 */
export function toCompassPoint(bearing: Degrees): CompassPoint {
  // Each sector spans 22.5°; the +11.25 offset centres the sector on its label.
  const normalised = ((bearing % 360) + 360) % 360;
  const index = Math.floor((normalised + 11.25) / 22.5) % 16;
  return COMPASS_POINTS[index] ?? 'N';
}
