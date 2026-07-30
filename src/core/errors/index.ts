export { Ok, Err, ok, err, fromPromise, fromThrowable } from './result';
export type { Result } from './result';

export {
  APP_ERROR_KINDS,
  networkError,
  timeoutError,
  rateLimitError,
  providerDegradedError,
  notFoundError,
  validationError,
  permissionDeniedError,
  storageError,
  unknownError,
  errorMessageKey,
  describeError,
} from './app-error';
export type { AppError, AppErrorKind, PermissionKind } from './app-error';
