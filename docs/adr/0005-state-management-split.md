# ADR-0005 — TanStack Query for server state, Zustand for client state

**Status:** Accepted
**Date:** 2026-07-29

## Context

The application has two categories of state with genuinely different semantics:

**Server state** — forecasts, air quality, alerts, geocoding results. It originates elsewhere, we hold only a *copy*, and that copy **can become stale without anything in the app changing it**. It needs caching, staleness tracking, background revalidation, retry policy, and request deduplication.

**Client state** — unit preferences, theme mode, language, selected location, notification settings. The user or device owns it, it is authoritative locally, and it is never stale.

Using one tool for both is the most common source of state bugs in apps of this kind. Putting server data in a general-purpose store means hand-rolling caching, staleness, and refetching — badly. Putting client preferences in a query cache means modelling a value that cannot become stale as if it could.

## Decision

**A strict split, with an absolute boundary.**

| | **TanStack Query** | **Zustand** |
|---|---|---|
| Owns | Server state — anything that originated remotely | Client state — anything the user or device decides |
| Examples | forecasts, AQI, alerts, geocoding | unit prefs, theme, language, selected location id, notification settings |
| Persistence | MMKV persister (cache hydration) | MMKV `persist` middleware |
| Deciding test | *"Could this be stale?"* | *"Is this purely a local decision?"* |

**The rule that matters most: server data is never copied into Zustand.**

## Consequences

**Positive**
- Caching, deduplication, retry, background revalidation, and staleness come from a library built for exactly that, rather than from bespoke code.
- Offline-first behaviour composes naturally — the Query persister plus the repository's cache-first logic gives instant startup with no custom orchestration.
- Zustand stays small and synchronous, which is what makes it fast on the render path.
- The boundary is easy to review: seeing a forecast inside a Zustand store is an immediate, obvious red flag.

**Negative**
- Two state libraries to learn. Mitigated by how sharply the boundary is drawn — the deciding test above resolves nearly every case.
- The temptation to copy query data into a store for convenience is real and recurring. It must be caught in review every time.

**Rules this creates**
1. **Never copy server data into Zustand.** It becomes a second source of truth that silently goes stale. If you feel the need, you actually want a Query `select`, or a value derived at render time.
2. **Query keys are typed and centralized** per feature in a key factory. Inline key arrays break invalidation in ways that are very hard to debug.
3. **Query keys use quantized coordinates (geohash), never raw floats.** Raw GPS coordinates change on every fix, producing a permanent cache miss — a subtle and expensive bug this rule exists specifically to prevent.
4. **`staleTime` is set deliberately per data type**, never left at the default. Minute-cast and daily forecasts decay at completely different rates (CLAUDE.md §25).
5. **Zustand stores contain state and actions only — no async I/O.** Async work belongs in use cases. A store that fetches has become a repository with worse ergonomics.
6. **Always select narrowly:** `useSettingsStore(s => s.tempUnit)`, never `useSettingsStore()`. The latter re-renders on every unrelated change.
7. **Persisted stores declare `version` and `migrate` from day one.** Retrofitting migrations onto shipped persisted state is painful.

## Alternatives considered

**Redux Toolkit + RTK Query** — capable and would cover both halves coherently. Rejected for the boilerplate weight relative to team size, and because RTK Query's offline persistence story is less mature than TanStack Query's persister for this use case.

**Zustand for everything** — would mean hand-writing caching, staleness, deduplication, and retry. That is precisely the code most likely to be subtly wrong, and precisely what TanStack Query has already solved well.

**TanStack Query for everything** — modelling a user's temperature-unit preference as a cacheable, staleable server resource is a category error that produces confusing code.

**React Context for client state** — insufficient. Context re-renders every consumer on any change, which is unacceptable for values read on the render path of animated screens.
