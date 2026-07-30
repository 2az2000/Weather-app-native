import { createLogger, noopLogger } from './logger';
import type { LogLevel, LogRecord, LogSink } from './types';

function createRecordingSink(minLevel: LogLevel = 'debug'): LogSink & {
  readonly records: LogRecord[];
} {
  const records: LogRecord[] = [];
  return {
    name: 'recording',
    minLevel,
    records,
    write: (record) => {
      records.push(record);
    },
  };
}

describe('createLogger', () => {
  it('delivers a record to every registered sink', () => {
    const a = createRecordingSink();
    const b = createRecordingSink();

    createLogger([a, b]).info('app.started');

    expect(a.records).toHaveLength(1);
    expect(b.records).toHaveLength(1);
  });

  it('records the level and event name', () => {
    const sink = createRecordingSink();
    createLogger([sink]).warn('provider.fallback', {
      from: 'open-meteo',
      to: 'openweather',
    });

    expect(sink.records[0]).toMatchObject({
      level: 'warn',
      event: 'provider.fallback',
      context: { from: 'open-meteo', to: 'openweather' },
    });
  });

  describe('level filtering', () => {
    it('drops records below a sink’s minimum level', () => {
      const sink = createRecordingSink('warn');
      const logger = createLogger([sink]);

      logger.debug('a');
      logger.info('b');
      logger.warn('c');
      logger.error('d');

      expect(sink.records.map((r) => r.event)).toEqual(['c', 'd']);
    });

    it('routes each level independently per sink', () => {
      const verbose = createRecordingSink('debug');
      const quiet = createRecordingSink('error');

      createLogger([verbose, quiet]).warn('degraded');

      expect(verbose.records).toHaveLength(1);
      expect(quiet.records).toHaveLength(0);
    });
  });

  describe('redaction', () => {
    it('redacts BEFORE any sink sees the payload', () => {
      const sink = createRecordingSink();

      createLogger([sink]).info('location.resolved', {
        latitude: 35.68919,
        longitude: 51.38897,
        apiKey: 'secret-value',
      });

      const serialised = JSON.stringify(sink.records[0]?.context);
      expect(serialised).not.toContain('35.68919');
      expect(serialised).not.toContain('secret-value');
      expect(sink.records[0]?.context).toMatchObject({
        latitude: 35.7,
        apiKey: '[redacted]',
      });
    });

    it('leaves an absent context undefined rather than inventing an object', () => {
      const sink = createRecordingSink();
      createLogger([sink]).info('app.started');

      expect(sink.records[0]?.context).toBeUndefined();
    });
  });

  describe('sink resilience', () => {
    it('does not let a throwing sink break the caller', () => {
      const exploding: LogSink = {
        name: 'exploding',
        minLevel: 'debug',
        write: () => {
          throw new Error('sink is broken');
        },
      };

      expect(() => createLogger([exploding]).error('boom')).not.toThrow();
    });

    it('still delivers to healthy sinks when one throws', () => {
      const exploding: LogSink = {
        name: 'exploding',
        minLevel: 'debug',
        write: () => {
          throw new Error('sink is broken');
        },
      };
      const healthy = createRecordingSink();

      createLogger([exploding, healthy]).error('boom');

      expect(healthy.records).toHaveLength(1);
    });
  });

  it('noopLogger accepts every level without throwing', () => {
    expect(() => {
      noopLogger.debug('a');
      noopLogger.info('b');
      noopLogger.warn('c');
      noopLogger.error('d');
    }).not.toThrow();
  });
});
