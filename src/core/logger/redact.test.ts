import { redact, redactCoordinate, redactUrl } from './redact';

/**
 * ROADMAP Phase 1 DoD: "Logger redacts coordinates."
 *
 * Coordinates are personal data — a raw position in a log is a record of where a
 * specific person was at a specific time (CLAUDE.md §23). Log sinks are
 * replicated, retained, and searchable, so a leak here is durable.
 */
describe('redact', () => {
  describe('coordinates', () => {
    it('coarsens a coordinate to roughly an 11 km cell', () => {
      expect(redactCoordinate(35.68919)).toBe(35.7);
      expect(redactCoordinate(51.38897)).toBe(51.4);
    });

    it('handles negative coordinates', () => {
      expect(redactCoordinate(-33.86882)).toBe(-33.9);
    });

    it.each(['lat', 'latitude', 'lon', 'lng', 'longitude', 'Latitude', 'LON'])(
      'coarsens the %s key wherever it appears',
      (key) => {
        const output = redact({ [key]: 35.68919 }) as Record<string, number>;
        expect(output[key]).toBe(35.7);
      },
    );

    it('coarsens coordinates nested inside other structures', () => {
      const output = redact({
        request: { coords: { latitude: 35.68919, longitude: 51.38897 } },
      });

      expect(output).toEqual({
        request: { coords: { latitude: 35.7, longitude: 51.4 } },
      });
    });

    it('never emits the original precision anywhere in the payload', () => {
      const output = redact({ location: { latitude: 35.68919, longitude: 51.38897 } });
      expect(JSON.stringify(output)).not.toContain('35.68919');
      expect(JSON.stringify(output)).not.toContain('51.38897');
    });
  });

  describe('secrets', () => {
    it.each([
      'apiKey',
      'api_key',
      'API_KEY',
      'accessToken',
      'access_token',
      'token',
      'secret',
      'password',
      'authorization',
      'openWeatherApiKey',
    ])('replaces the %s key', (key) => {
      const output = redact({ [key]: 'super-secret-value' }) as Record<string, string>;
      expect(output[key]).toBe('[redacted]');
    });

    it('replaces secrets nested inside headers', () => {
      const output = redact({ headers: { Authorization: 'Bearer abc123' } });
      expect(JSON.stringify(output)).not.toContain('abc123');
    });
  });

  describe('urls', () => {
    it('drops the query string, which carries both coordinates and keys', () => {
      expect(
        redactUrl('https://api.open-meteo.com/v1/forecast?latitude=35.7&appid=abc'),
      ).toBe('https://api.open-meteo.com/v1/forecast?[redacted]');
    });

    it('leaves a url without a query string intact', () => {
      expect(redactUrl('https://api.open-meteo.com/v1/forecast')).toBe(
        'https://api.open-meteo.com/v1/forecast',
      );
    });

    it('redacts a url found under a url key', () => {
      const output = redact({ url: 'https://api.test/v1?lat=35.68919&appid=secret' });
      expect(JSON.stringify(output)).not.toContain('35.68919');
      expect(JSON.stringify(output)).not.toContain('secret');
    });
  });

  describe('errors', () => {
    it('reduces an Error to name and message, with the message url-redacted', () => {
      const output = redact({
        cause: new Error('failed https://api.test?lat=35.68919&appid=secret'),
      });

      expect(JSON.stringify(output)).not.toContain('35.68919');
      expect(JSON.stringify(output)).not.toContain('secret');
    });
  });

  describe('passthrough', () => {
    it('leaves non-sensitive values untouched', () => {
      const input = {
        provider: 'open-meteo',
        status: 503,
        retryable: true,
        items: [1, 2],
      };
      expect(redact(input)).toEqual(input);
    });

    it('preserves null and undefined rather than coercing them', () => {
      expect(redact({ a: null, b: undefined })).toEqual({ a: null, b: undefined });
    });

    it('truncates beyond the depth limit instead of recursing without bound', () => {
      // Deeper than MAX_DEPTH (6).
      const deep = { a: { b: { c: { d: { e: { f: { g: { h: 'deep' } } } } } } } };
      expect(JSON.stringify(redact(deep))).toContain('[redacted]');
    });
  });
});
