import { redact } from './redact';
import {
  LOG_LEVEL_WEIGHT,
  type LogLevel,
  type LogRecord,
  type LogSink,
  type Logger,
} from './types';

/**
 * Create a logger that fans out to the given sinks.
 *
 * Redaction happens HERE, once, before any sink sees the payload (CLAUDE.md
 * §23). Doing it per-sink would mean a newly added sink could leak PII simply by
 * forgetting to redact.
 *
 * A sink that throws must never take down the caller — logging is diagnostic
 * infrastructure, not application logic, so a broken sink is swallowed
 * deliberately (the one sanctioned exception to the no-silent-failure rule, and
 * the reason it is commented here).
 */
export function createLogger(sinks: readonly LogSink[]): Logger {
  function emit(level: LogLevel, event: string, context?: Record<string, unknown>): void {
    const record: LogRecord = {
      level,
      event,
      context:
        context === undefined ? undefined : (redact(context) as Record<string, unknown>),
      timestamp: new Date(),
    };

    for (const sink of sinks) {
      if (LOG_LEVEL_WEIGHT[level] < LOG_LEVEL_WEIGHT[sink.minLevel]) continue;

      try {
        sink.write(record);
      } catch {
        // Intentionally swallowed: a failing sink must not break the app or
        // recurse by logging its own failure.
      }
    }
  }

  return {
    debug: (event, context) => emit('debug', event, context),
    info: (event, context) => emit('info', event, context),
    warn: (event, context) => emit('warn', event, context),
    error: (event, context) => emit('error', event, context),
  };
}

/**
 * A logger that discards everything.
 *
 * Used in tests and as a safe default before the container is constructed, so
 * no call site needs a null check.
 */
export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
