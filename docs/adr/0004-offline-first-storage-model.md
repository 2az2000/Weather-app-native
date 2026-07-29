# ADR-0004 — Two-tier storage: MMKV and SQLite

**Status:** Accepted
**Date:** 2026-07-29

## Context

The app has a hard startup requirement — **weather content visible in under 500 ms from a cold start, before any network call resolves** — and a hard offline requirement: full forecasts, charts, and recommendations readable in airplane mode. Home screen widgets add a third constraint: they must render **without the app process running at all**.

These three requirements pull in different directions:

| Requirement | Implies |
|---|---|
| Render on the first frame | **Synchronous** reads — an `await` before first paint means a blank frame |
| Charts, history, time ranges | **Queryable, structured** storage |
| Widgets render app-not-running | Storage readable from a **separate process / App Group** |

No single storage engine serves all three well. MMKV is synchronous but is a key-value store with no query capability and poor characteristics for bulk data. SQLite is queryable and durable but asynchronous in React Native — unusable before the first frame.

## Decision

**Use both, with strictly separated responsibilities.**

| | **MMKV** | **SQLite** |
|---|---|---|
| Access | **Synchronous** (JSI) | Asynchronous |
| Holds | Settings, Zustand persistence, TanStack Query cache hydration | Forecast snapshots, historical series, chart data, widget source |
| Size profile | Small, hot, read constantly | Large, structured, read selectively |
| Why this tier | Readable on the first frame — this is what makes instant startup possible | Supports time-range queries and durable history that a KV store cannot |

### Read path

```
App launches
  │
  ├─ MMKV hydrates the Query cache SYNCHRONOUSLY  ──►  content renders on frame 1
  │
  ├─ SQLite returns the durable record            ──►  content refines
  │
  └─ if online AND stale: background revalidate   ──►  content updates silently
```

The user never sees a spinner where cached content could have been shown.

## Consequences

**Positive**
- The sub-500 ms startup target becomes achievable, because the first paint depends on a synchronous read.
- Charts and historical comparison get real query capability instead of deserializing a large blob.
- Widgets read the SQLite record (Android) / App Group store (iOS) directly, so they render with the app never launched.
- Failure is graceful: if SQLite is corrupt or migrating, MMKV still yields something to render.

**Negative**
- **Two storage systems to reason about, migrate, and test.** This is real complexity, accepted deliberately.
- Risk of the tiers blurring over time — the mitigation is the explicit rule below.
- Data can transiently exist in both tiers with different freshness; SQLite is the authority for durable data, MMKV for fast-path hydration.

**Rules this creates — the boundary must not blur**
1. **Never put bulk forecast history in MMKV.** It is not designed for large values, and it will degrade startup — the exact thing it exists to protect.
2. **Never put settings in SQLite.** They are needed synchronously on the first frame.
3. **SQLite is the source of truth for durable weather data.** MMKV holds a fast-path copy for hydration, never the authoritative record.
4. **SQLite has a versioned schema with a migration runner from day one** (Phase 1 DoD includes forward migration from empty *and* from a previous version). Retrofitting migrations onto shipped data is painful.
5. **The Query cache has a version key.** Bumping it discards incompatible persisted data on upgrade rather than crashing on a shape mismatch.
6. **Everything a widget needs must be written to SQLite / App Group by the app.** A widget must never need to fetch.

## Alternatives considered

**MMKV only** — fastest startup, but no query capability. Charts and historical comparison would mean deserializing large blobs, and the storage would degrade as history accumulates. Fails the charts and history requirements.

**SQLite only** — clean single-source-of-truth model, but the async read makes the sub-500 ms first paint impossible; the app would show a blank frame or a spinner on every launch. Fails the primary UX goal.

**AsyncStorage** — synchronous-ish API over an async bridge, significantly slower than MMKV, and offers no advantage over either option. No reason to choose it.

**WatermelonDB / Realm** — capable offline-first databases with reactive queries, but heavier dependencies whose sync models solve a problem this app does not have (there is no user-data server to sync with). Weather data is derived and disposable, not user-owned state requiring conflict resolution.
