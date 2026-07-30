import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';

import { RETRY } from '@/core/config';
import { noopLogger } from '@/core/logger';

import { createHttpClient } from './http-client';

/**
 * Driven through a stub transport adapter rather than a mocked module, so the
 * retry loop and error mapping are exercised for real (CLAUDE.md §26).
 */

function successResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
}

function httpError(status: number, headers: Record<string, string> = {}): AxiosError {
  const error = new AxiosError(`status ${status}`);
  error.response = {
    status,
    statusText: '',
    data: undefined,
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return error;
}

/** An adapter that replays a queued script of outcomes, one per attempt. */
function scriptedAdapter(outcomes: readonly (AxiosResponse | AxiosError)[]): {
  adapter: AxiosAdapter;
  callCount: () => number;
} {
  let call = 0;

  const adapter: AxiosAdapter = async () => {
    const outcome = outcomes[Math.min(call, outcomes.length - 1)];
    call += 1;
    if (outcome instanceof AxiosError) throw outcome;
    if (outcome === undefined) throw new AxiosError('no scripted outcome');
    return outcome;
  };

  return { adapter, callCount: () => call };
}

function client(outcomes: readonly (AxiosResponse | AxiosError)[]) {
  const { adapter, callCount } = scriptedAdapter(outcomes);
  return {
    http: createHttpClient(
      { provider: 'open-meteo', baseURL: 'https://example.test', adapter },
      noopLogger,
    ),
    callCount,
  };
}

describe('createHttpClient', () => {
  it('exposes the provider name, which the circuit breaker keys on', () => {
    const { http } = client([successResponse({})]);
    expect(http.provider).toBe('open-meteo');
  });

  describe('success', () => {
    it('unwraps the response body into an Ok result', async () => {
      const { http } = client([successResponse({ temperature: 21 })]);

      const result = await http.get<{ temperature: number }>('/forecast');

      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr({ temperature: 0 })).toEqual({ temperature: 21 });
    });

    it('does not retry a successful request', async () => {
      const { http, callCount } = client([successResponse({})]);
      await http.get('/forecast');

      expect(callCount()).toBe(1);
    });
  });

  describe('retry policy', () => {
    it('retries a retryable failure and returns the eventual success', async () => {
      const { http, callCount } = client([httpError(503), successResponse({ ok: true })]);

      const result = await http.get<{ ok: boolean }>('/forecast');

      expect(result.isOk()).toBe(true);
      expect(callCount()).toBe(2);
    });

    it('gives up after the configured attempt budget', async () => {
      const { http, callCount } = client([httpError(503)]);

      const result = await http.get('/forecast');

      expect(result.isErr()).toBe(true);
      expect(callCount()).toBe(RETRY.maxAttempts);
    });

    it('does NOT retry a non-retryable failure', async () => {
      // 404 is not retryable — retrying cannot change the answer.
      const { http, callCount } = client([httpError(404)]);

      const result = await http.get('/forecast');

      expect(result.isErr() && result.error.kind).toBe('notFound');
      expect(callCount()).toBe(1);
    });

    it('does not retry a 400, since a bad request stays bad', async () => {
      const { http, callCount } = client([httpError(400)]);

      await http.get('/forecast');

      expect(callCount()).toBe(1);
    });

    it('honours Retry-After rather than its own backoff on a 429', async () => {
      const { http, callCount } = client([
        httpError(429, { 'retry-after': '0' }),
        successResponse({ ok: true }),
      ]);

      const result = await http.get('/forecast');

      expect(result.isOk()).toBe(true);
      expect(callCount()).toBe(2);
    });
  });

  describe('error mapping', () => {
    it('returns a typed AppError instead of throwing', async () => {
      const { http } = client([httpError(404)]);

      const result = await http.get('/forecast');

      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error).toMatchObject({
        kind: 'notFound',
        retryable: false,
      });
    });

    it('names the failing provider on a degraded upstream', async () => {
      const { http } = client([httpError(503)]);

      const result = await http.get('/forecast');

      expect(result.isErr() && result.error).toMatchObject({
        kind: 'providerDegraded',
        provider: 'open-meteo',
      });
    });

    it('records the requested path as the missing resource', async () => {
      const { http } = client([httpError(404)]);

      const result = await http.get('/forecast');

      expect(result.isErr() && result.error).toMatchObject({ resource: '/forecast' });
    });
  });

  it('logs a final failure once, after retries are exhausted', async () => {
    const warn = jest.fn();
    const { adapter } = scriptedAdapter([httpError(404)]);

    const http = createHttpClient(
      { provider: 'open-meteo', baseURL: 'https://example.test', adapter },
      { ...noopLogger, warn },
    );

    await http.get('/forecast');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'api.request.failed',
      expect.objectContaining({
        provider: 'open-meteo',
        kind: 'notFound',
      }),
    );
  });
});
