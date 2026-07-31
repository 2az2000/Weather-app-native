/**
 * Request coalescing — concurrent identical requests share one in-flight promise.
 *
 * Without this, a screen that mounts three components each asking for the same
 * forecast issues three identical HTTP requests. They race, they each pay full
 * latency, and they each consume quota for an answer the others already have
 * (CLAUDE.md §21).
 *
 * The window is genuinely narrow — a few hundred milliseconds — which is why the
 * TanStack Query cache does not cover it: the cache only helps once a response
 * has ARRIVED. This covers the gap while it is still in flight.
 *
 * Deliberately NOT a cache: entries are removed the moment they settle, so this
 * never returns a stale value. Freshness is the repository's job.
 */
export class RequestCoalescer {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /**
   * Run `operation`, or join an identical one already running.
   *
   * @param key - Identifies the request. Must include everything that changes
   *   the answer — for weather, the geohash cell and the data type.
   * @param operation - Invoked only when nothing matching is in flight.
   */
  async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      // Typed by the caller: a given key always maps to the same result type,
      // which the key construction guarantees.
      return existing as Promise<T>;
    }

    const promise = operation().finally(() => {
      // Removed on settle, success or failure. A failed request must not be
      // replayed to every later caller — that would turn one transient error
      // into a permanent one.
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);

    return promise as Promise<T>;
  }

  /** How many requests are currently in flight. For tests and diagnostics. */
  get pendingCount(): number {
    return this.inFlight.size;
  }

  /** Whether a specific key is in flight. */
  isPending(key: string): boolean {
    return this.inFlight.has(key);
  }
}
