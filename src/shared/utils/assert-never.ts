/**
 * Exhaustiveness helper for discriminated unions.
 *
 * CLAUDE.md §12 requires exhaustive switches to end with a `never` check, so
 * that adding a union member becomes a COMPILE error rather than a silent
 * fallthrough. This matters most for the `AppError` union (§22) and for weather
 * condition handling, where a missed case would degrade silently at runtime.
 *
 * @example
 * switch (error.kind) {
 *   case 'network': return t('errors.network');
 *   case 'timeout': return t('errors.timeout');
 *   default: return assertNever(error);   // ← fails to compile if a kind is added
 * }
 *
 * @param value - The value that should be impossible to reach.
 * @throws Always. Reaching this at runtime means an invariant was violated.
 */
export function assertNever(value: never): never {
  throw new Error(
    `Unhandled union member: ${JSON.stringify(value)}. A switch is missing a case.`,
  );
}
