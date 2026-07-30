import type { LogRecord } from '../types';

import { createConsoleSink } from './console-sink';

function record(overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    level: 'info',
    event: 'app.started',
    context: undefined,
    timestamp: new Date('2026-07-29T10:00:00Z'),
    ...overrides,
  };
}

describe('createConsoleSink', () => {
  // Spies are installed per-test: jest.config sets `restoreMocks: true`, which
  // would undo any spy created once in the describe body before the first test
  // even ran.
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('defaults to accepting every level', () => {
    expect(createConsoleSink().minLevel).toBe('debug');
  });

  it('reports its name, which identifies it in sink lists', () => {
    expect(createConsoleSink().name).toBe('console');
  });

  it('respects an explicitly configured minimum level', () => {
    expect(createConsoleSink('warn').minLevel).toBe('warn');
  });

  describe('console routing', () => {
    it('routes errors to console.error', () => {
      createConsoleSink().write(record({ level: 'error', event: 'boom' }));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0]?.[0]).toContain('boom');
    });

    it('routes warnings to console.warn', () => {
      createConsoleSink().write(record({ level: 'warn' }));

      expect(warn).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
    });

    it('routes info and debug to console.log', () => {
      const sink = createConsoleSink();
      sink.write(record({ level: 'info' }));
      sink.write(record({ level: 'debug' }));

      expect(log).toHaveBeenCalledTimes(2);
    });
  });

  it('includes the level and event in the prefix', () => {
    createConsoleSink().write(record({ level: 'info', event: 'provider.fallback' }));

    expect(log.mock.calls[0]?.[0]).toBe('[info] provider.fallback');
  });

  it('passes context through when present', () => {
    createConsoleSink().write(record({ context: { provider: 'open-meteo' } }));

    expect(log).toHaveBeenCalledWith('[info] app.started', { provider: 'open-meteo' });
  });

  it('substitutes an empty string when there is no context', () => {
    createConsoleSink().write(record({ context: undefined }));

    expect(log).toHaveBeenCalledWith('[info] app.started', '');
  });
});
