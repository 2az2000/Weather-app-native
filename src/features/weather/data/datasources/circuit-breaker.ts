import { PROVIDER_COOLDOWN_MS } from '@/core/config';
import type { AppError } from '@/core/errors';
import type { Logger } from '@/core/logger';

/**
 * Circuit breaker for weather providers.
 *
 * **Open-Meteo offers no uptime SLA on its free tier** (ADR-0002), so a degraded
 * upstream is an expected condition rather than an exceptional one. Retrying
 * into a provider that is already failing wastes time the user is waiting and
 * adds load to something already struggling.
 *
 * The breaker records a failure, opens for a cooldown, and routes to the
 * fallback provider for that window.
 *
 * ## Which failures open the circuit
 *
 * Only `rateLimit` and `providerDegraded` — the errors that mean *this provider*
 * is unwell. Deliberately NOT opened by:
 *
 * - `network` / `timeout` — the DEVICE is offline. Failing over would just fail
 *   again, and would wrongly blame a provider that is fine.
 * - `validation` — a schema change. The fallback has a different schema, so it
 *   would not help, and marking the provider down would hide a real bug.
 * - `notFound` — the request was wrong, not the provider.
 */
export class CircuitBreaker {
  /** Provider name → the timestamp at which it may be tried again. */
  private readonly openUntil = new Map<string, number>();

  constructor(
    private readonly logger: Logger,
    private readonly cooldownMs: number = PROVIDER_COOLDOWN_MS,
  ) {}

  /** Whether a provider may be called right now. */
  isAvailable(provider: string, now: number = Date.now()): boolean {
    const until = this.openUntil.get(provider);
    if (until === undefined) return true;

    if (now >= until) {
      // Cooldown elapsed — close the circuit and let the next call probe it.
      this.openUntil.delete(provider);
      this.logger.info('weather.circuit.closed', { provider });
      return true;
    }

    return false;
  }

  /**
   * Record a failure, opening the circuit if the error indicates a sick provider.
   *
   * @returns Whether the circuit was opened by this failure.
   */
  recordFailure(provider: string, error: AppError, now: number = Date.now()): boolean {
    if (!opensCircuit(error)) return false;

    // A rate limit tells us exactly how long to wait; honouring it beats
    // guessing with a fixed cooldown.
    const cooldown =
      error.kind === 'rateLimit' ? Math.max(error.retryAfterMs, 0) : this.cooldownMs;

    this.openUntil.set(provider, now + cooldown);

    this.logger.warn('weather.circuit.opened', {
      provider,
      kind: error.kind,
      cooldownMs: cooldown,
    });

    return true;
  }

  /** Record a success, closing the circuit early if it was open. */
  recordSuccess(provider: string): void {
    if (this.openUntil.delete(provider)) {
      this.logger.info('weather.circuit.recovered', { provider });
    }
  }

  /** Remaining cooldown in milliseconds, or 0 if the provider is available. */
  cooldownRemaining(provider: string, now: number = Date.now()): number {
    const until = this.openUntil.get(provider);
    return until === undefined ? 0 : Math.max(0, until - now);
  }

  /** Test helper: forget all recorded state. */
  reset(): void {
    this.openUntil.clear();
  }
}

function opensCircuit(error: AppError): boolean {
  return error.kind === 'rateLimit' || error.kind === 'providerDegraded';
}
