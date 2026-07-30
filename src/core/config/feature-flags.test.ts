import { FEATURE_FLAGS, isEnabled } from './feature-flags';

describe('feature flags', () => {
  it('reports the configured value for a flag', () => {
    expect(isEnabled('providerFallback')).toBe(FEATURE_FLAGS.providerFallback);
    expect(isEnabled('persistQueryCache')).toBe(FEATURE_FLAGS.persistQueryCache);
  });

  it('exposes provider fallback, which ADR-0002 depends on for resilience', () => {
    // Open-Meteo has no free-tier uptime SLA, so failover must be available.
    expect(isEnabled('providerFallback')).toBe(true);
  });

  it('exposes query cache persistence, which the instant cold start depends on', () => {
    expect(isEnabled('persistQueryCache')).toBe(true);
  });

  it('returns a boolean for every declared flag', () => {
    for (const flag of Object.keys(FEATURE_FLAGS) as (keyof typeof FEATURE_FLAGS)[]) {
      expect(typeof isEnabled(flag)).toBe('boolean');
    }
  });
});
