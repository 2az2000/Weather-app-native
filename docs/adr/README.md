# Architecture Decision Records

Each ADR records **one load-bearing decision**: the context that forced it, the decision, the consequences, and the alternatives rejected.

## Rules

- **Numbered sequentially, never renumbered.**
- **Never deleted.** A decision that gets reversed is marked `Superseded by ADR-XXXX` and kept — the reasoning history is the value, not just the current answer.
- Written when a decision is **hard to reverse** or when a future reader would reasonably ask *"why on earth is it done this way?"*
- Not for routine choices. A library pick with an obvious answer does not need an ADR.

## Status values

`Proposed` · `Accepted` · `Deprecated` · `Superseded by ADR-XXXX`

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-expo-prebuild-and-dev-client.md) | Expo prebuild and dev client over Expo Go | Accepted |
| [0002](0002-open-meteo-as-primary-provider.md) | Open-Meteo as primary weather provider | Accepted |
| [0003](0003-client-direct-api-keys-with-proxy-seam.md) | Client-direct API keys with a proxy seam | Accepted |
| [0004](0004-offline-first-storage-model.md) | Two-tier storage — MMKV and SQLite | Accepted |
| [0005](0005-state-management-split.md) | TanStack Query for server state, Zustand for client state | Accepted |
| [0006](0006-rtl-first-layout-strategy.md) | RTL-first layout from day one | Accepted |
| [0007](0007-clean-architecture-layer-boundaries.md) | Clean Architecture boundaries enforced in CI | Accepted |
| [0008](0008-local-astronomy-computation.md) | Compute astronomy on-device rather than fetching it | Accepted |
