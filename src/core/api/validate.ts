import type { ZodType } from 'zod';

import { err, ok, validationError, type AppError, type Result } from '@/core/errors';
import type { Logger } from '@/core/logger';

/**
 * Zod validation at the network boundary.
 *
 * External APIs change without warning. An unvalidated response corrupts the
 * cache and then crashes a screen far from the cause, at which point the stack
 * trace points at the symptom rather than the source. Validating once, at the
 * edge, keeps the error message meaningful (CLAUDE.md §9).
 *
 * This is also the firewall that makes the DTO/entity split worth having: a
 * schema change is caught here, in one file, instead of propagating.
 */
export function validateResponse<T>(
  schema: ZodType<T>,
  payload: unknown,
  context: { readonly provider: string; readonly endpoint: string },
  logger: Logger,
): Result<T, AppError> {
  const parsed = schema.safeParse(payload);

  if (parsed.success) {
    return ok(parsed.data);
  }

  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
  );

  // Logged at `error` because an upstream contract change needs attention even
  // though the app degrades gracefully — this is how a silent provider change
  // becomes visible before users report it.
  logger.error('api.validation.failed', {
    provider: context.provider,
    endpoint: context.endpoint,
    issueCount: issues.length,
    issues: issues.slice(0, 5),
  });

  return err(validationError(issues));
}
