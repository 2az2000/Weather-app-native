# `features/` — Feature slices

Each folder here is a self-contained vertical slice owning a distinct user-facing capability, sliced internally by layer.

## Internal structure

```
<feature>/
├── domain/          # entities, repository INTERFACES, use cases, pure services
├── data/            # DTOs, mappers, data sources, repository IMPLEMENTATIONS
├── presentation/    # screens, components, hooks, stores
└── index.ts         # ★ the feature's ONLY public surface ★
```

## The dependency rule

```
presentation  ──►  domain  ◄──  data
                     ▲
                  (imports nothing framework-related)
```

`domain/` is pure TypeScript. No React, no Axios, no Expo, no Zod. This is what makes business logic testable in plain Node with zero mocks — and it is enforced by lint, not by convention.

## Hard rules

1. **Features are islands.** Never import another feature's internals — only its `index.ts` barrel.
   ```ts
   // ❌ import { WeatherRepositoryImpl } from '@/features/weather/data/repositories/…';
   // ✅ import { useCurrentWeather } from '@/features/weather';
   ```
2. **The barrel is a published API.** Export only what other features legitimately need. Adding an export is a deliberate decision.
3. **Shared code moves down, never sideways.** When two features need the same thing, promote it to `shared/` or `core/`.
4. **Omit layers you genuinely do not need.** `recommendations/` has **no `data/` layer** because it is pure deterministic rules with no I/O. Never create an empty layer for symmetry — it lies about the design.
5. **DTOs never leave `data/`.** A `*Dto` type in `domain/` or `presentation/` means the architecture is broken.

## Current features

| Feature | Owns | Note |
|---|---|---|
| `weather/` | Forecasts, conditions, astronomy | The core domain |
| `locations/` | GPS, search, reverse geocode, favorites | Everything else is parameterized by this |
| `air-quality/` | AQI + 6 pollutants | |
| `maps/` | Mapbox, radar, weather layers | Lazy-loaded route |
| `alerts/` | Severe alerts, push notifications | |
| `recommendations/` | Deterministic rule engine | **No `data/` layer — no I/O** |
| `settings/` | Units, theme, language, notification prefs | |

See [CLAUDE.md §7](../../CLAUDE.md#7-feature-based-architecture-rules) and the [new feature guide](../../CLAUDE.md#33-guide-creating-a-new-feature).
