import { LOCALE_META, type Locale } from './locales';

/**
 * Locale-aware formatting.
 *
 * **Never concatenate a number into a string by hand** (CLAUDE.md §19 rule 4).
 * Persian uses Persian-Indic digits (۰۱۲۳), a different group separator, and the
 * Jalali calendar — none of which a template literal produces.
 *
 * ## Why `Intl` rather than Day.js plus a calendar plugin
 *
 * ICU already knows all of this. `fa-IR` **defaults to the Persian calendar**
 * and to Persian-Indic digits, so `Intl` returns "۹ مرداد" for 31 July 2026 with
 * no plugin, no locale registration, and no manual digit substitution.
 *
 * A Jalali plugin was tried first and rejected: it added a dependency, shipped
 * ESM-only (breaking Jest), and duplicated a conversion the platform performs
 * correctly. CLAUDE.md §36 asks whether a dependency is needed before adding one
 * — here it is not.
 *
 * ⚠️ This relies on the JS engine having full ICU. Hermes provides it on both
 * platforms, but the Jalali output must be confirmed on a real device — Node and
 * Hermes do not always ship identical ICU data.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/**
 * Convert ASCII digits to Persian-Indic.
 *
 * `Intl` handles this for values it formats. This helper exists for the few
 * places a number is embedded in a string that ICU never sees — an interpolated
 * translation, for instance.
 */
export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

const tagOf = (locale: Locale): string => LOCALE_META[locale].tag;

export interface NumberFormatOptions {
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
}

/** Format a number for display. */
export function formatNumber(
  value: number,
  locale: Locale,
  options: NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(tagOf(locale), {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(value);
}

/**
 * Format a temperature.
 *
 * Rounds to a whole degree — sub-degree precision is noise the forecast does not
 * support, and it makes the hero figure unreadable.
 */
export function formatTemperature(
  celsius: number,
  locale: Locale,
  unit: 'celsius' | 'fahrenheit' = 'celsius',
): string {
  const value = unit === 'fahrenheit' ? celsius * (9 / 5) + 32 : celsius;
  const rounded = Math.round(value);

  // `Math.round(-0.2)` is genuinely `-0`, which formats as "-0°".
  const normalised = Object.is(rounded, -0) ? 0 : rounded;

  return `${formatNumber(normalised, locale)}°`;
}

/** Format a fraction as a percentage. */
export function formatPercent(fraction: number, locale: Locale): string {
  return new Intl.NumberFormat(tagOf(locale), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(fraction);
}

/**
 * Format a date.
 *
 * Persian resolves to the Jalali (Solar Hijri) calendar automatically — the
 * civil calendar in Iran. Showing a Gregorian date to a Persian user is not a
 * formatting preference; it is the wrong date.
 */
export function formatDate(
  date: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat(tagOf(locale), options).format(date);
}

/** Format a time of day. Persian uses a 24-hour clock. */
export function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(tagOf(locale), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !LOCALE_META[locale].usesPersianDigits,
  }).format(date);
}

/** Weekday name — used by the daily forecast list. */
export function formatWeekday(date: Date, locale: Locale, short = true): string {
  return new Intl.DateTimeFormat(tagOf(locale), {
    weekday: short ? 'short' : 'long',
  }).format(date);
}

/**
 * Relative time, for data-age indicators.
 *
 * Every cached view shows how old its data is (CLAUDE.md §24 rule 1), so this
 * appears on essentially every screen.
 *
 * `Intl.RelativeTimeFormat` handles pluralisation, which Persian and English do
 * differently — hand-written `count === 1 ? …` logic is banned for exactly that
 * reason (CLAUDE.md §19 rule 5).
 */
export function formatRelativeTime(
  date: Date,
  locale: Locale,
  now: Date = new Date(),
): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const formatter = new Intl.RelativeTimeFormat(tagOf(locale), { numeric: 'auto' });

  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    absSeconds < 60
      ? [diffSeconds, 'second']
      : absSeconds < 3600
        ? [Math.round(diffSeconds / 60), 'minute']
        : absSeconds < 86_400
          ? [Math.round(diffSeconds / 3600), 'hour']
          : [Math.round(diffSeconds / 86_400), 'day'];

  return formatter.format(value, unit);
}
