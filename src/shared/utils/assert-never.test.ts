import { assertNever } from '@/shared/utils';

/**
 * Phase 0 sample test.
 *
 * Beyond exercising `assertNever`, this proves the toolchain is wired end to
 * end: TypeScript strict mode, the `@/shared` path alias resolving through
 * jest's moduleNameMapper, and jest-expo's transform.
 */
describe('assertNever', () => {
  type Weather = { kind: 'sun' } | { kind: 'rain' };

  function describeWeather(weather: Weather): string {
    switch (weather.kind) {
      case 'sun':
        return 'sunny';
      case 'rain':
        return 'rainy';
      default:
        return assertNever(weather);
    }
  }

  it('narrows every member of a union so the default branch is unreachable', () => {
    expect(describeWeather({ kind: 'sun' })).toBe('sunny');
    expect(describeWeather({ kind: 'rain' })).toBe('rainy');
  });

  it('throws with the offending value when an invariant is violated at runtime', () => {
    // Cast is required precisely because the type system forbids this — we are
    // simulating a value arriving from outside the type system's guarantees.
    const impossible = { kind: 'snow' } as unknown as never;

    expect(() => assertNever(impossible)).toThrow(/Unhandled union member/);
    expect(() => assertNever(impossible)).toThrow(/snow/);
  });
});
