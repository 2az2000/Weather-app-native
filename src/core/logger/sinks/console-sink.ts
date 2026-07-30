/* eslint-disable no-console -- This sink IS the sanctioned console boundary. */
import type { LogLevel, LogRecord, LogSink } from '../types';

/**
 * Development console sink.
 *
 * `no-console` is banned everywhere else (CLAUDE.md §23) precisely so that all
 * console output funnels through this one file, where it can be formatted,
 * filtered, and switched off in production.
 *
 * Reactotron plugs in as an additional sink implementing the same interface; it
 * requires a running desktop companion app, so it is registered locally by a
 * developer who wants it rather than being a hard dependency of the build.
 */
export function createConsoleSink(minLevel: LogLevel = 'debug'): LogSink {
  return {
    name: 'console',
    minLevel,
    write(record: LogRecord): void {
      const prefix = `[${record.level}] ${record.event}`;

      switch (record.level) {
        case 'error':
          console.error(prefix, record.context ?? '');
          break;
        case 'warn':
          console.warn(prefix, record.context ?? '');
          break;
        default:
          console.log(prefix, record.context ?? '');
      }
    },
  };
}
