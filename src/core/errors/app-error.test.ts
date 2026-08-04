import {
  APP_ERROR_KINDS,
  asAppError,
  describeError,
  errorMessageKey,
  networkError,
  notFoundError,
  permissionDeniedError,
  providerDegradedError,
  rateLimitError,
  storageError,
  timeoutError,
  unknownError,
  validationError,
  type AppError,
} from './app-error';

/** One representative error per kind, so every branch below is exercised. */
const SAMPLES: Record<AppError['kind'], AppError> = {
  network: networkError(),
  timeout: timeoutError(10_000),
  rateLimit: rateLimitError(60_000),
  providerDegraded: providerDegradedError('open-meteo', 503),
  notFound: notFoundError('city'),
  validation: validationError(['temperature_2m: expected number']),
  permissionDenied: permissionDeniedError('location'),
  storage: storageError('open database'),
  unknown: unknownError(new Error('surprise')),
};

describe('AppError', () => {
  it('covers every declared kind in APP_ERROR_KINDS', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...APP_ERROR_KINDS].sort());
  });

  describe('retryability', () => {
    it.each([
      ['network', true],
      ['timeout', true],
      ['rateLimit', true],
      ['providerDegraded', true],
      ['notFound', false],
      ['validation', false],
      ['permissionDenied', false],
      ['storage', false],
      ['unknown', false],
    ] as const)('marks %s as retryable=%s', (kind, expected) => {
      expect(SAMPLES[kind].retryable).toBe(expected);
    });
  });

  describe('errorMessageKey', () => {
    it('produces a namespaced translation key for every kind', () => {
      for (const kind of APP_ERROR_KINDS) {
        expect(errorMessageKey(SAMPLES[kind])).toBe(`errors:${kind}`);
      }
    });
  });

  describe('describeError', () => {
    it('returns structured context for every kind', () => {
      for (const kind of APP_ERROR_KINDS) {
        expect(describeError(SAMPLES[kind])).toMatchObject({ kind });
      }
    });

    it('includes the details needed to diagnose a degraded provider', () => {
      expect(describeError(providerDegradedError('open-meteo', 503))).toEqual({
        kind: 'providerDegraded',
        provider: 'open-meteo',
        status: 503,
      });
    });

    it('reports only the count of validation issues, not their content', () => {
      const described = describeError(validationError(['a: bad', 'b: bad']));
      expect(described).toEqual({ kind: 'validation', issueCount: 2 });
    });

    it('omits the cause of an unknown error, which may carry a URL with PII', () => {
      const described = describeError(
        unknownError(new Error('https://api?lat=35.7&lon=51.4')),
      );
      expect(described).toEqual({ kind: 'unknown' });
      expect(JSON.stringify(described)).not.toContain('35.7');
    });
  });
});

describe('asAppError', () => {
  it('passes a genuine AppError through unchanged', () => {
    for (const kind of APP_ERROR_KINDS) {
      const original = SAMPLES[kind];
      expect(asAppError(original)).toBe(original);
    }
  });

  describe('wrapping what is not an AppError', () => {
    it('wraps a plain Error', () => {
      const cause = new Error('boom');
      expect(asAppError(cause)).toEqual({ kind: 'unknown', cause, retryable: false });
    });

    it.each([null, undefined, 'a string', 42, true])('wraps %p', (value) => {
      expect(asAppError(value)).toMatchObject({ kind: 'unknown', retryable: false });
    });

    it('wraps an object with an UNKNOWN kind', () => {
      // A shape that looks close enough to slip past a cast, which is exactly
      // why this narrows rather than asserting (CLAUDE.md §12).
      const impostor = { kind: 'somethingElse', retryable: true };
      expect(asAppError(impostor)).toMatchObject({ kind: 'unknown' });
    });

    it('wraps an object with a valid kind but no retryable flag', () => {
      // `retryable` drives the retry policy, so a partial object must not be
      // trusted — a missing flag would read as `undefined` and never retry.
      expect(asAppError({ kind: 'network' })).toMatchObject({ kind: 'unknown' });
    });

    it('wraps an object whose retryable is not a boolean', () => {
      expect(asAppError({ kind: 'network', retryable: 'yes' })).toMatchObject({
        kind: 'unknown',
      });
    });
  });

  it('always returns something errorMessageKey can translate', () => {
    for (const value of [null, new Error('x'), { kind: 'nope' }, SAMPLES.network]) {
      expect(errorMessageKey(asAppError(value))).toMatch(/^errors:/);
    }
  });
});
