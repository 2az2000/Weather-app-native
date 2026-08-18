import Constants from 'expo-constants';

import { EnvironmentError, loadEnv } from './env';

/**
 * ROADMAP Phase 1 DoD: "Missing required env var fails AT STARTUP with a clear
 * message, not at first use."
 *
 * `expo-constants` is a native module read at import time, so it is stubbed
 * here. This is one of the few places module mocking is justified — there is no
 * seam to inject through, because the value originates from the build system.
 */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

const constants = Constants as unknown as {
  expoConfig: { extra: Record<string, unknown> } | null;
};

function setExtra(extra: Record<string, unknown> | null): void {
  constants.expoConfig = extra === null ? null : { extra };
}

describe('loadEnv', () => {
  afterEach(() => {
    setExtra({});
  });

  it('returns typed values when they are present', () => {
    setExtra({ openWeatherApiKey: 'ow-key', mapboxAccessToken: 'mb-token' });

    expect(loadEnv()).toEqual({
      openWeatherApiKey: 'ow-key',
      mapboxAccessToken: 'mb-token',
    });
  });

  it('boots with no secrets configured, since Open-Meteo needs no key (ADR-0002)', () => {
    setExtra({});

    // Phase 1 has no screen that needs a credential. The app must start.
    expect(() => loadEnv()).not.toThrow();
  });

  it('tolerates a missing expoConfig rather than crashing on a null read', () => {
    setExtra(null);
    expect(() => loadEnv()).not.toThrow();
  });

  it('defaults absent keys to empty strings rather than undefined', () => {
    setExtra({});
    expect(loadEnv()).toEqual({ openWeatherApiKey: '', mapboxAccessToken: '' });
  });

  describe('absent versus empty — the distinction a fallback default destroys', () => {
    it('starts when a key is ABSENT, since REQUIRED_KEYS is empty', () => {
      setExtra({});
      expect(() => loadEnv()).not.toThrow();
    });

    it('REJECTS a key that is present but EMPTY', () => {
      // This is the asymmetry that broke a real build. `app.config.ts` used
      // `process.env.X ?? ''`, so an unset variable became a PRESENT empty
      // string. `.partial()` permits absence but not an empty value, so every
      // unset key failed validation at startup and the app refused to launch
      // with "Environment configuration is invalid" — for keys that are not
      // required at all.
      //
      // The fix is in app.config.ts: omit the key entirely when unset. This
      // test pins the behaviour that made the bug possible, so a future
      // fallback reintroducing it fails here.
      setExtra({ openWeatherApiKey: '' });
      expect(() => loadEnv()).toThrow(EnvironmentError);
    });

    it('accepts a key that is present and non-empty', () => {
      setExtra({ openWeatherApiKey: 'ow-key' });
      expect(loadEnv().openWeatherApiKey).toBe('ow-key');
    });
  });

  describe('when a value is present but malformed', () => {
    it('throws an EnvironmentError naming the offending variable', () => {
      setExtra({ openWeatherApiKey: 12345 });

      expect(() => loadEnv()).toThrow(EnvironmentError);
      expect(() => loadEnv()).toThrow(/openWeatherApiKey/);
    });

    it('explains how to fix it, rather than only stating the failure', () => {
      setExtra({ mapboxAccessToken: { nested: true } });

      expect(() => loadEnv()).toThrow(/\.env\.example/);
      expect(() => loadEnv()).toThrow(/EAS Secrets/);
    });

    it('reports every problem at once, not just the first', () => {
      setExtra({ openWeatherApiKey: 1, mapboxAccessToken: 2 });

      try {
        loadEnv();
        throw new Error('expected loadEnv to throw');
      } catch (cause) {
        const message = (cause as Error).message;
        expect(message).toContain('openWeatherApiKey');
        expect(message).toContain('mapboxAccessToken');
      }
    });

    it('rejects an empty string for a value that is present', () => {
      setExtra({ openWeatherApiKey: '' });

      expect(() => loadEnv()).toThrow(EnvironmentError);
    });
  });
});
