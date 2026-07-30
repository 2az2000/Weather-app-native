import { LOG_COORDINATE_PRECISION } from '@/core/config';

/**
 * PII redaction for log payloads.
 *
 * **Coordinates are personal data.** A raw GPS position in a log is a record of
 * where a specific person was at a specific time, and log sinks are replicated,
 * retained, and searchable. CLAUDE.md §23 therefore forbids logging a raw
 * position or any credential.
 *
 * Redaction is applied centrally in the logger rather than left to call sites,
 * because "remember to redact" is a rule that fails the first time someone is in
 * a hurry.
 */

/** Keys whose values are replaced outright, at any depth. */
const SECRET_KEY_PATTERN =
  /^(.*(api[-_]?key|apikey|access[-_]?token|token|secret|password|authorization|bearer).*)$/i;

/** Keys treated as a coordinate and rounded to a coarse cell. */
const COORDINATE_KEY_PATTERN = /^(lat|latitude|lon|lng|longitude)$/i;

const REDACTED = '[redacted]';

/** Maximum depth traversed, as a cheap guard against cyclic structures. */
const MAX_DEPTH = 6;

/**
 * Round a coordinate to a coarse cell.
 *
 * At {@link LOG_COORDINATE_PRECISION} = 1 this is ~11 km at the equator: useless
 * for locating a person, sufficient to debug a cache-key problem.
 */
export function redactCoordinate(value: number): number {
  const factor = 10 ** LOG_COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

/**
 * Strip a URL down to something safe to log.
 *
 * Query strings routinely carry both coordinates and API keys, so the query is
 * dropped entirely rather than filtered — an allowlist would leak the first time
 * a provider added a parameter.
 */
export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  const withoutQuery = queryStart === -1 ? url : url.slice(0, queryStart);
  return queryStart === -1 ? withoutQuery : `${withoutQuery}?[redacted]`;
}

/**
 * Recursively redact secrets and coarsen coordinates in a log payload.
 *
 * @param value - Arbitrary structured log context.
 * @returns A copy safe to hand to a log sink.
 */
export function redact(value: unknown): unknown {
  return redactAtDepth(value, 0);
}

function redactAtDepth(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return REDACTED;

  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactAtDepth(item, depth + 1));
  }

  if (value instanceof Error) {
    return { name: value.name, message: redactUrl(value.message) };
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(source)) {
      const entry = source[key];

      if (SECRET_KEY_PATTERN.test(key)) {
        output[key] = REDACTED;
        continue;
      }

      if (COORDINATE_KEY_PATTERN.test(key) && typeof entry === 'number') {
        output[key] = redactCoordinate(entry);
        continue;
      }

      if (key.toLowerCase() === 'url' && typeof entry === 'string') {
        output[key] = redactUrl(entry);
        continue;
      }

      output[key] = redactAtDepth(entry, depth + 1);
    }

    return output;
  }

  return value;
}
