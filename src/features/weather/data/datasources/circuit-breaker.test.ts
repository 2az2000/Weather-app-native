import {
  networkError,
  notFoundError,
  providerDegradedError,
  rateLimitError,
  timeoutError,
  validationError,
} from '@/core/errors';
import { noopLogger } from '@/core/logger';

import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  const COOLDOWN = 60_000;
  const T0 = 1_000_000;

  const build = () => new CircuitBreaker(noopLogger, COOLDOWN);

  it('starts with every provider available', () => {
    expect(build().isAvailable('open-meteo', T0)).toBe(true);
  });

  describe('failures that OPEN the circuit', () => {
    it.each([
      ['providerDegraded', providerDegradedError('open-meteo', 503)],
      ['rateLimit', rateLimitError(30_000)],
    ])('opens on %s — the provider itself is unwell', (_label, error) => {
      const breaker = build();

      expect(breaker.recordFailure('open-meteo', error, T0)).toBe(true);
      expect(breaker.isAvailable('open-meteo', T0)).toBe(false);
    });
  });

  describe('failures that do NOT open the circuit', () => {
    it.each([
      ['network', networkError()],
      ['timeout', timeoutError(10_000)],
    ])('ignores %s — the DEVICE is offline, not the provider', (_label, error) => {
      const breaker = build();

      // Blaming the provider would suppress a healthy primary for the whole
      // cooldown, on every device that happens to be offline.
      expect(breaker.recordFailure('open-meteo', error, T0)).toBe(false);
      expect(breaker.isAvailable('open-meteo', T0)).toBe(true);
    });

    it('ignores validation — a schema change the fallback cannot fix', () => {
      const breaker = build();

      // The fallback has a different schema, so failing over would not help,
      // and marking the provider down would hide a real bug.
      expect(breaker.recordFailure('open-meteo', validationError(['bad']), T0)).toBe(
        false,
      );
      expect(breaker.isAvailable('open-meteo', T0)).toBe(true);
    });

    it('ignores notFound — the request was wrong, not the provider', () => {
      const breaker = build();

      expect(breaker.recordFailure('open-meteo', notFoundError('/forecast'), T0)).toBe(
        false,
      );
    });
  });

  describe('cooldown', () => {
    it('stays open for the configured window', () => {
      const breaker = build();
      breaker.recordFailure('open-meteo', providerDegradedError('open-meteo', 503), T0);

      expect(breaker.isAvailable('open-meteo', T0 + COOLDOWN - 1)).toBe(false);
    });

    it('closes once the window elapses', () => {
      const breaker = build();
      breaker.recordFailure('open-meteo', providerDegradedError('open-meteo', 503), T0);

      expect(breaker.isAvailable('open-meteo', T0 + COOLDOWN)).toBe(true);
    });

    it('HONOURS Retry-After instead of guessing', () => {
      const breaker = build();
      // The server told us exactly how long to wait; guessing with a fixed
      // cooldown would either waste availability or retry too early.
      breaker.recordFailure('open-meteo', rateLimitError(5 * COOLDOWN), T0);

      expect(breaker.isAvailable('open-meteo', T0 + COOLDOWN)).toBe(false);
      expect(breaker.isAvailable('open-meteo', T0 + 5 * COOLDOWN)).toBe(true);
    });

    it('reports the remaining cooldown', () => {
      const breaker = build();
      breaker.recordFailure('open-meteo', providerDegradedError('open-meteo', 503), T0);

      expect(breaker.cooldownRemaining('open-meteo', T0 + 20_000)).toBe(
        COOLDOWN - 20_000,
      );
    });

    it('reports zero remaining for an available provider', () => {
      expect(build().cooldownRemaining('open-meteo', T0)).toBe(0);
    });
  });

  describe('isolation between providers', () => {
    it('opening one leaves the other available', () => {
      const breaker = build();
      breaker.recordFailure('open-meteo', providerDegradedError('open-meteo', 503), T0);

      // The entire point of failover: the fallback must stay reachable.
      expect(breaker.isAvailable('open-meteo', T0)).toBe(false);
      expect(breaker.isAvailable('openweather', T0)).toBe(true);
    });
  });

  describe('recovery', () => {
    it('closes the circuit early on a success', () => {
      const breaker = build();
      breaker.recordFailure('open-meteo', providerDegradedError('open-meteo', 503), T0);

      breaker.recordSuccess('open-meteo');

      expect(breaker.isAvailable('open-meteo', T0)).toBe(true);
    });

    it('tolerates a success for a provider that was never failing', () => {
      expect(() => build().recordSuccess('open-meteo')).not.toThrow();
    });
  });

  it('reset clears all recorded state', () => {
    const breaker = build();
    breaker.recordFailure('open-meteo', providerDegradedError('open-meteo', 503), T0);

    breaker.reset();

    expect(breaker.isAvailable('open-meteo', T0)).toBe(true);
  });
});
