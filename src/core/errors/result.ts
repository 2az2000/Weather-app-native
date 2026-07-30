/**
 * `Result<T, E>` — errors as values.
 *
 * Across every layer boundary in this codebase, failures are RETURNED, never
 * thrown (CLAUDE.md §22). A thrown exception is invisible in the type system;
 * `Result` makes each failure path something the compiler forces the caller to
 * handle, so an error case cannot be silently forgotten.
 *
 * Hand-rolled rather than taking a dependency: the whole abstraction is ~100
 * lines, and CLAUDE.md §36 asks whether 30 lines could replace a library before
 * adding one.
 */

/** Successful outcome carrying a value. */
export class Ok<T, E> {
  constructor(readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  /** Transform the success value, leaving an error untouched. */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  /** Transform the error, leaving a success untouched. */
  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new Ok(this.value);
  }

  /** Chain another fallible operation. */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /** Extract the value, or a fallback if this is an error. */
  unwrapOr(_fallback: T): T {
    return this.value;
  }

  /** Exhaustively handle both branches. */
  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.ok(this.value);
  }
}

/** Failed outcome carrying an error. */
export class Err<T, E> {
  constructor(readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error));
  }

  andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Err(this.error);
  }

  unwrapOr(fallback: T): T {
    return fallback;
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.err(this.error);
  }
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

/** Wrap a value as a successful `Result`. */
export function ok<T, E = never>(value: T): Result<T, E> {
  return new Ok(value);
}

/** Wrap an error as a failed `Result`. */
export function err<E, T = never>(error: E): Result<T, E> {
  return new Err(error);
}

/**
 * Convert a throwing async operation into a `Result`.
 *
 * This is the ONLY sanctioned place for a try/catch around foreign code — at
 * the boundary where a third-party API that throws is adapted into a value.
 * Above that boundary, nothing throws.
 */
export async function fromPromise<T, E>(
  promise: Promise<T>,
  mapError: (cause: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(mapError(cause));
  }
}

/** Synchronous counterpart to {@link fromPromise}. */
export function fromThrowable<T, E>(
  fn: () => T,
  mapError: (cause: unknown) => E,
): Result<T, E> {
  try {
    return ok(fn());
  } catch (cause) {
    return err(mapError(cause));
  }
}
