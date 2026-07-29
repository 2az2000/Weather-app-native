# `core/` — Framework infrastructure

Feature-agnostic plumbing that every feature depends on. If two features would otherwise each invent their own version of something technical, it belongs here.

## Belongs here

| Folder | Contents |
|---|---|
| `api/` | Per-provider Axios instances, interceptors, HTTP → `AppError` mapping, Zod validation at the boundary |
| `config/` | Typed env access (validated at startup), constants, feature flags |
| `di/` | Composition root — binds domain interfaces to data implementations |
| `errors/` | `Result<T, E>`, the `AppError` union, helpers |
| `i18n/` | i18next setup, `isRTL` accessor, RTL bootstrap, locale-aware formatters |
| `logger/` | Logging facade with Reactotron (dev) and Sentry (prod) sinks |
| `network/` | Connectivity state, online/offline observable |
| `storage/` | MMKV driver, SQLite driver, migration runner |

## Does NOT belong here

- ❌ **Anything weather-specific.** If it knows what a forecast is, it is a feature, not infrastructure.
- ❌ **UI components** — those are `shared/ui/`.
- ❌ **Business rules** — those are a feature's `domain/`.

## Hard rule

> **`core/` must never import from `features/`.**

`core/` sits *below* features in the dependency graph. An import from `core/` into a feature inverts the graph and is a lint error.

If something in `core/` seems to need feature knowledge, the abstraction is wrong — the feature should depend on a generic `core/` capability, not the other way round.

See [CLAUDE.md §4](../../CLAUDE.md#4-architecture-overview).
