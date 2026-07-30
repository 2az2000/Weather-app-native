import { AxiosError } from 'axios';

import {
  networkError,
  notFoundError,
  providerDegradedError,
  rateLimitError,
  timeoutError,
  unknownError,
  type AppError,
} from '@/core/errors';

/**
 * The ONLY place HTTP failures are interpreted.
 *
 * Above `core/api`, no code inspects `error.response.status` (CLAUDE.md §9, §22).
 * That containment is what lets a provider be swapped, or a proxy introduced,
 * without touching a single screen.
 */

/** `Retry-After` may be seconds or an HTTP date. Both are accepted. */
function parseRetryAfter(header: unknown, fallbackMs: number): number {
  if (typeof header !== 'string' || header.trim() === '') return fallbackMs;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

  return fallbackMs;
}

const DEFAULT_RETRY_AFTER_MS = 60_000;

/**
 * Map an arbitrary thrown value into an {@link AppError}.
 *
 * @param cause - Whatever Axios (or anything else) threw.
 * @param provider - Provider name, so `providerDegraded` identifies which
 *   upstream failed and the circuit breaker knows what to cool down.
 * @param resource - What was being fetched, used in `notFound`.
 */
export function toAppError(
  cause: unknown,
  provider: string,
  resource = provider,
): AppError {
  if (!(cause instanceof AxiosError)) {
    return unknownError(cause);
  }

  // Axios reports both a connect timeout and an aborted request this way.
  if (cause.code === 'ECONNABORTED' || cause.code === 'ETIMEDOUT') {
    const configured = cause.config?.timeout;
    return timeoutError(typeof configured === 'number' ? configured : 0);
  }

  // No response at all: DNS failure, refused connection, airplane mode.
  if (cause.response === undefined) {
    return networkError();
  }

  const { status, headers } = cause.response;

  if (status === 404) {
    return notFoundError(resource);
  }

  if (status === 429) {
    const retryAfter = (headers as Record<string, unknown> | undefined)?.['retry-after'];
    return rateLimitError(parseRetryAfter(retryAfter, DEFAULT_RETRY_AFTER_MS));
  }

  // 5xx and 408 are the upstream's problem and are worth failing over for.
  // Open-Meteo has no free-tier uptime SLA (ADR-0002), so this path is expected
  // rather than exceptional.
  if (status >= 500 || status === 408) {
    return providerDegradedError(provider, status);
  }

  // Remaining 4xx are our own bug (bad params, bad key) — not retryable, and
  // deliberately NOT surfaced as a provider problem.
  return unknownError(cause);
}
