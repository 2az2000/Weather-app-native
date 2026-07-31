/**
 * Query keys for the locations feature.
 *
 * Centralised, never inlined at a call site — an inline key array is how cache
 * invalidation silently breaks, and the breakage is very hard to trace back
 * (CLAUDE.md §8, §32).
 *
 * The hierarchy is deliberate: invalidating `locationKeys.all` invalidates
 * everything beneath it, so a single call refreshes the whole feature.
 */
export const locationKeys = {
  all: ['locations'] as const,

  saved: () => [...locationKeys.all, 'saved'] as const,
  current: () => [...locationKeys.all, 'current'] as const,
  permission: () => [...locationKeys.all, 'permission'] as const,

  searches: () => [...locationKeys.all, 'search'] as const,
  /** Query text and locale both change the result, so both are in the key. */
  search: (query: string, locale: string) =>
    [...locationKeys.searches(), query, locale] as const,

  recentSearches: () => [...locationKeys.all, 'recent'] as const,
} as const;
