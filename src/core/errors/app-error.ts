/**
 * `AppError` — the single error taxonomy for the whole application.
 *
 * Raw errors (AxiosError, ZodError, native exceptions) exist ONLY inside
 * `core/api` and at other adapter boundaries. Everything above maps to this
 * union, so no code outside the boundary inspects an HTTP status code
 * (CLAUDE.md §22).
 *
 * `retryable` is part of the data rather than something callers infer, so the
 * retry policy in `core/api` and TanStack Query read a flag instead of
 * pattern-matching on error shapes.
 */

/** Permissions the app requests, and can therefore be denied. */
export type PermissionKind = 'location' | 'notifications';

export type AppError =
  | { readonly kind: 'network'; readonly retryable: true }
  | { readonly kind: 'timeout'; readonly timeoutMs: number; readonly retryable: true }
  | {
      readonly kind: 'rateLimit';
      readonly retryAfterMs: number;
      readonly retryable: true;
    }
  | {
      readonly kind: 'providerDegraded';
      readonly provider: string;
      readonly status: number;
      readonly retryable: true;
    }
  | { readonly kind: 'notFound'; readonly resource: string; readonly retryable: false }
  | {
      readonly kind: 'validation';
      readonly issues: readonly string[];
      readonly retryable: false;
    }
  | {
      readonly kind: 'permissionDenied';
      readonly permission: PermissionKind;
      readonly retryable: false;
    }
  | { readonly kind: 'storage'; readonly operation: string; readonly retryable: false }
  | { readonly kind: 'unknown'; readonly cause: unknown; readonly retryable: false };

/** Every `AppError.kind`, for exhaustiveness tests and mapping tables. */
export const APP_ERROR_KINDS = [
  'network',
  'timeout',
  'rateLimit',
  'providerDegraded',
  'notFound',
  'validation',
  'permissionDenied',
  'storage',
  'unknown',
] as const satisfies readonly AppError['kind'][];

export type AppErrorKind = (typeof APP_ERROR_KINDS)[number];

// ── Constructors ─────────────────────────────────────────────────────────────
// Named constructors keep `retryable` correct by construction — a caller cannot
// accidentally build a `network` error that claims to be non-retryable.

export const networkError = (): AppError => ({ kind: 'network', retryable: true });

export const timeoutError = (timeoutMs: number): AppError => ({
  kind: 'timeout',
  timeoutMs,
  retryable: true,
});

export const rateLimitError = (retryAfterMs: number): AppError => ({
  kind: 'rateLimit',
  retryAfterMs,
  retryable: true,
});

export const providerDegradedError = (provider: string, status: number): AppError => ({
  kind: 'providerDegraded',
  provider,
  status,
  retryable: true,
});

export const notFoundError = (resource: string): AppError => ({
  kind: 'notFound',
  resource,
  retryable: false,
});

export const validationError = (issues: readonly string[]): AppError => ({
  kind: 'validation',
  issues,
  retryable: false,
});

export const permissionDeniedError = (permission: PermissionKind): AppError => ({
  kind: 'permissionDenied',
  permission,
  retryable: false,
});

export const storageError = (operation: string): AppError => ({
  kind: 'storage',
  operation,
  retryable: false,
});

export const unknownError = (cause: unknown): AppError => ({
  kind: 'unknown',
  cause,
  retryable: false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Translation key for an error, so no raw provider message ever reaches a user
 * (CLAUDE.md §22 rule 4 — raw messages are untranslated and leak internals).
 *
 * Returns a key into the `errors` i18n namespace, wired up in Phase 2.
 */
export function errorMessageKey(error: AppError): string {
  return `errors:${error.kind}`;
}

/**
 * Structured, PII-free context for logging an error.
 *
 * Deliberately omits `unknown.cause`, which may carry a request URL containing
 * user coordinates — those are redacted by the logger (CLAUDE.md §23).
 */
export function describeError(error: AppError): Record<string, unknown> {
  switch (error.kind) {
    case 'network':
      return { kind: error.kind };
    case 'timeout':
      return { kind: error.kind, timeoutMs: error.timeoutMs };
    case 'rateLimit':
      return { kind: error.kind, retryAfterMs: error.retryAfterMs };
    case 'providerDegraded':
      return { kind: error.kind, provider: error.provider, status: error.status };
    case 'notFound':
      return { kind: error.kind, resource: error.resource };
    case 'validation':
      return { kind: error.kind, issueCount: error.issues.length };
    case 'permissionDenied':
      return { kind: error.kind, permission: error.permission };
    case 'storage':
      return { kind: error.kind, operation: error.operation };
    case 'unknown':
      return { kind: error.kind };
  }
}
