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
 *
 * That warning turned out to be justified. On a real Android device running a
 * locally built debug APK, `Intl.NumberFormat` worked but `Intl.DateTimeFormat`
 * and `Intl.RelativeTimeFormat` were `undefined` — this specific Hermes build
 * has partial, not full, ICU. Calling either threw `TypeError: undefined
 * cannot be used as a constructor`, which — because nothing checked for this —
 * crashed every screen that showed a date, a weekday, or a data-age banner.
 * That is most of the app.
 *
 * `formatDate`, `formatTime`, `formatWeekday`, and `formatRelativeTime` each
 * check for their constructor and fall back to a manual implementation when it
 * is missing. The fallback is DEGRADED, not equivalent: it renders the
 * Gregorian calendar rather than Jalali, because reimplementing Persian/Jalali
 * conversion by hand is exactly the dependency CLAUDE.md §36 asks whether a
 * project needs before adding — and a wrong-but-legible date beats a crashed
 * screen while still being worth replacing the moment a build has full ICU.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/**
 * Run an `Intl`-backed formatter, falling back to `onDegraded` if it throws.
 *
 * A `typeof Intl.X === 'function'` pre-check was tried first and was not
 * enough: on a real device, `Intl.RelativeTimeFormat` existed as a
 * constructor, but calling `.format()` on the instance threw `TypeError:
 * undefined is not a function` — a different partial-ICU failure shape from
 * the missing-constructor one this file's fallbacks were originally built
 * for. Wrapping the actual call, not just checking the constructor exists,
 * degrades correctly regardless of which piece of a given Hermes build's ICU
 * is incomplete.
 */
function withIntl<T>(run: () => T, onDegraded: () => T): T {
  try {
    return run();
  } catch {
    return onDegraded();
  }
}

const PAD2 = (n: number): string => String(n).padStart(2, '0');

/** Gregorian only — used when `Intl.DateTimeFormat` is unavailable. */
const WEEKDAY_NAMES: Record<
  Locale,
  { short: readonly string[]; long: readonly string[] }
> = {
  en: {
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  fa: {
    // Persian weekday names are not conventionally abbreviated the way English
    // ones are, so short and long are the same set.
    short: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
    long: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
  },
};

/** Gregorian only — see the file-level note on the fallback's scope. */
const MONTH_NAMES: Record<Locale, readonly string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  fa: [
    'ژانویه',
    'فوریه',
    'مارس',
    'آوریل',
    'مه',
    'ژوئن',
    'ژوئیه',
    'اوت',
    'سپتامبر',
    'اکتبر',
    'نوامبر',
    'دسامبر',
  ],
};

/**
 * Only the four units `formatRelativeTime` ever produces — a local union
 * rather than `Intl.RelativeTimeFormatUnit`, whose plural variants
 * ('years', 'quarters', …) this function never passes and the fallback table
 * has no use for.
 */
type RelativeUnit = 'second' | 'minute' | 'hour' | 'day';

/** English-only plural forms; Persian nouns do not inflect for count here. */
const RELATIVE_UNIT_NAMES: Record<
  Locale,
  Record<RelativeUnit, { singular: string; plural: string }>
> = {
  en: {
    second: { singular: 'second', plural: 'seconds' },
    minute: { singular: 'minute', plural: 'minutes' },
    hour: { singular: 'hour', plural: 'hours' },
    day: { singular: 'day', plural: 'days' },
  },
  fa: {
    second: { singular: 'ثانیه', plural: 'ثانیه' },
    minute: { singular: 'دقیقه', plural: 'دقیقه' },
    hour: { singular: 'ساعت', plural: 'ساعت' },
    day: { singular: 'روز', plural: 'روز' },
  },
};

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
  return withIntl(
    () => new Intl.DateTimeFormat(tagOf(locale), options).format(date),
    () => {
      // Gregorian, not Jalali — a documented degradation (see the file-level note).
      const rendered = `${date.getDate()} ${MONTH_NAMES[locale][date.getMonth()] ?? ''}`;
      return LOCALE_META[locale].usesPersianDigits ? toPersianDigits(rendered) : rendered;
    },
  );
}

/** Format a time of day. Persian uses a 24-hour clock. */
export function formatTime(date: Date, locale: Locale): string {
  return withIntl(
    () =>
      new Intl.DateTimeFormat(tagOf(locale), {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !LOCALE_META[locale].usesPersianDigits,
      }).format(date),
    () => {
      const hour24 = date.getHours();
      const minute = PAD2(date.getMinutes());

      const rendered = LOCALE_META[locale].usesPersianDigits
        ? `${PAD2(hour24)}:${minute}`
        : `${((hour24 + 11) % 12) + 1}:${minute} ${hour24 < 12 ? 'AM' : 'PM'}`;

      return LOCALE_META[locale].usesPersianDigits ? toPersianDigits(rendered) : rendered;
    },
  );
}

/** Weekday name — used by the daily forecast list. */
export function formatWeekday(date: Date, locale: Locale, short = true): string {
  return withIntl(
    () =>
      new Intl.DateTimeFormat(tagOf(locale), {
        weekday: short ? 'short' : 'long',
      }).format(date),
    () => {
      const names = WEEKDAY_NAMES[locale];
      return (short ? names.short : names.long)[date.getDay()] ?? '';
    },
  );
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

  const [value, unit]: [number, RelativeUnit] =
    absSeconds < 60
      ? [diffSeconds, 'second']
      : absSeconds < 3600
        ? [Math.round(diffSeconds / 60), 'minute']
        : absSeconds < 86_400
          ? [Math.round(diffSeconds / 3600), 'hour']
          : [Math.round(diffSeconds / 86_400), 'day'];

  return withIntl(
    () =>
      new Intl.RelativeTimeFormat(tagOf(locale), { numeric: 'auto' }).format(value, unit),
    () => {
      // `numeric: 'auto'` would say "yesterday"/"now" for certain values; the
      // fallback always says "N units ago/from now", which is correct if plainer.
      const magnitude = Math.abs(value);
      const names = RELATIVE_UNIT_NAMES[locale][unit];
      const unitName = magnitude === 1 ? names.singular : names.plural;
      const count = LOCALE_META[locale].usesPersianDigits
        ? toPersianDigits(String(magnitude))
        : String(magnitude);

      if (magnitude === 0) return locale === 'fa' ? 'اکنون' : 'now';

      return locale === 'fa'
        ? value < 0
          ? `${count} ${unitName} پیش`
          : `${count} ${unitName} دیگر`
        : value < 0
          ? `${count} ${unitName} ago`
          : `in ${count} ${unitName}`;
    },
  );
}
