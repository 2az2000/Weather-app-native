import axios, {
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';

import { REQUEST_TIMEOUT_MS, RETRY } from '@/core/config';
import { fromPromise, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';

import { toAppError } from './error-mapper';

/**
 * Typed HTTP client, one instance per provider.
 *
 * `axios` is never called directly from anywhere else (CLAUDE.md §9). Every
 * request carries an explicit timeout, and every failure leaves this module as an
 * {@link AppError} — so the layers above are provider-agnostic and status-code
 * agnostic.
 */

export interface HttpClient {
  readonly provider: string;
  get<T>(url: string, config?: AxiosRequestConfig): Promise<Result<T, AppError>>;
}

export interface HttpClientOptions {
  readonly provider: string;
  readonly baseURL: string;
  readonly timeoutMs?: number;
  /** Merged into every request. Use for provider auth headers. */
  readonly headers?: Record<string, string>;
  /** Appended to every request. Use for providers that key by query param. */
  readonly params?: Record<string, string>;
  /**
   * Transport override.
   *
   * Axios resolves this itself in production. Supplying one lets tests drive
   * retry and error-mapping behaviour deterministically without a network or a
   * mocked module, and is the same hook a future offline-queue transport would
   * use.
   */
  readonly adapter?: AxiosAdapter;
}

/** Full jitter exponential backoff, capped. */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(RETRY.baseDelayMs * 2 ** attempt, RETRY.maxDelayMs);
  return Math.random() * exponential;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function createHttpClient(options: HttpClientOptions, logger: Logger): HttpClient {
  const instance: AxiosInstance = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS.default,
    // Spread conditionally: under `exactOptionalPropertyTypes` an explicit
    // `undefined` is not the same as an absent property.
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    ...(options.params === undefined ? {} : { params: options.params }),
    ...(options.adapter === undefined ? {} : { adapter: options.adapter }),
  });

  async function request<T>(
    url: string,
    config: AxiosRequestConfig | undefined,
    attempt: number,
  ): Promise<Result<T, AppError>> {
    const result = await fromPromise(
      instance.get<T>(url, config).then((response) => response.data),
      (cause) => toAppError(cause, options.provider, url),
    );

    if (result.isOk()) return result;

    const error = result.error;

    // The retry decision reads the `retryable` FLAG rather than re-deriving it
    // from the error shape (CLAUDE.md §22). Adding an error kind therefore
    // cannot accidentally change retry behaviour.
    const canRetry = error.retryable && attempt + 1 < RETRY.maxAttempts;

    if (!canRetry) {
      logger.warn('api.request.failed', {
        provider: options.provider,
        url,
        attempt,
        kind: error.kind,
      });
      return result;
    }

    // Honour the server's own backoff instruction when it gave one.
    const delay = error.kind === 'rateLimit' ? error.retryAfterMs : backoffDelay(attempt);

    logger.debug('api.request.retry', {
      provider: options.provider,
      url,
      attempt,
      kind: error.kind,
      delayMs: delay,
    });

    await sleep(delay);
    return request<T>(url, config, attempt + 1);
  }

  return {
    provider: options.provider,
    get: (url, config) => request(url, config, 0),
  };
}
