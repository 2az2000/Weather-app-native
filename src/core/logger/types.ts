/**
 * Logger contracts.
 *
 * The logger is a FACADE over a list of sinks (CLAUDE.md §23). Call sites depend
 * on {@link Logger} only, so adding Sentry, Reactotron, or a file sink is a
 * registration change in the composition root and touches no calling code.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Numeric ordering, so a sink can filter by minimum level. */
export const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * A single log record.
 *
 * `event` is a stable dot-separated identifier (`provider.fallback`), never an
 * interpolated sentence — structured context, not string soup (CLAUDE.md §23).
 * Stable event names are what make logs aggregatable.
 */
export interface LogRecord {
  readonly level: LogLevel;
  readonly event: string;
  readonly context: Record<string, unknown> | undefined;
  readonly timestamp: Date;
}

/** A destination for log records. Receives ALREADY-REDACTED context. */
export interface LogSink {
  readonly name: string;
  /** Lowest level this sink accepts. Records below it are not delivered. */
  readonly minLevel: LogLevel;
  write(record: LogRecord): void;
}

export interface Logger {
  debug(event: string, context?: Record<string, unknown>): void;
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
}
