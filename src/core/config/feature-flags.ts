/**
 * Feature flags.
 *
 * Flags exist to decouple *merging* from *releasing*, letting an unfinished
 * feature land behind a flag rather than living on a long branch.
 *
 * Every flag is a liability: it doubles the number of states to reason about and
 * to test. Delete a flag as soon as its feature ships (CLAUDE.md §31 — delete
 * aggressively).
 */
export const FEATURE_FLAGS = {
  /** Fail over to OpenWeather when Open-Meteo is degraded (ADR-0002). */
  providerFallback: true,

  /** Persist the TanStack Query cache to MMKV for instant cold start (§24). */
  persistQueryCache: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
