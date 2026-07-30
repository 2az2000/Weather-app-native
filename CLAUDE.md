# CLAUDE.md — Weather App

> **Single source of truth for this codebase.**
> Read this file completely before writing any code. Every rule here states *what* to do, *why* it exists, and *how it is enforced*. If a rule has no enforcement mechanism listed, it is enforced by code review.
>
> If reality and this document disagree, **that is a bug in one of them** — fix the code or update this file in the same pull request. Never leave them out of sync.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Project Goals](#2-project-goals)
3. [Project Philosophy](#3-project-philosophy)
4. [Architecture Overview](#4-architecture-overview)
5. [Folder Structure](#5-folder-structure)
6. [Clean Architecture Guidelines](#6-clean-architecture-guidelines)
7. [Feature-Based Architecture Rules](#7-feature-based-architecture-rules)
8. [State Management Guidelines](#8-state-management-guidelines)
9. [API Layer Guidelines](#9-api-layer-guidelines)
10. [Repository Pattern Guidelines](#10-repository-pattern-guidelines)
11. [DTO & Mapper Guidelines](#11-dto--mapper-guidelines)
12. [TypeScript Standards](#12-typescript-standards)
13. [Naming Conventions](#13-naming-conventions)
14. [Import Conventions](#14-import-conventions)
15. [Component Design Rules](#15-component-design-rules)
16. [Custom Hook Guidelines](#16-custom-hook-guidelines)
17. [Navigation Guidelines](#17-navigation-guidelines)
18. [Theme Architecture](#18-theme-architecture)
19. [Internationalization & RTL](#19-internationalization--rtl)
20. [Animation Guidelines](#20-animation-guidelines)
21. [Performance Guidelines](#21-performance-guidelines)
22. [Error Handling Strategy](#22-error-handling-strategy)
23. [Logging Strategy](#23-logging-strategy)
24. [Offline-First Strategy](#24-offline-first-strategy)
25. [Caching Strategy](#25-caching-strategy)
26. [Testing Strategy](#26-testing-strategy)
27. [Documentation Standards](#27-documentation-standards)
28. [Code Review Checklist](#28-code-review-checklist)
29. [Pull Request Checklist](#29-pull-request-checklist)
30. [Commit Convention](#30-commit-convention)
31. [Best Practices](#31-best-practices)
32. [Forbidden Patterns](#32-forbidden-patterns)
33. [Guide: Creating a New Feature](#33-guide-creating-a-new-feature)
34. [Guide: Creating a New Component](#34-guide-creating-a-new-component)
35. [Scalability Guidelines](#35-scalability-guidelines)
36. [Maintainability Guidelines](#36-maintainability-guidelines)
37. [Project Workflow](#37-project-workflow)

---

## 1. Project Vision

A production-grade mobile weather application whose user experience stands beside Apple Weather and Today Weather, built on an architecture that would survive a real engineering team and years of feature growth.

The application answers one question exceptionally well — *"what is the weather where I care about, and what should I do about it?"* — through fast, beautiful, offline-capable, fully localized (English + Persian) experiences on iOS and Android.

**This is a portfolio flagship.** Architecture, maintainability, testability, performance, and developer experience outrank delivery speed in every tradeoff. Code that works but violates the architecture is not done.

---

## 2. Project Goals

### Product goals
| Goal | Measure of success |
|---|---|
| Instant perceived startup | Weather content visible < 500 ms from cold start, from cache, before any network call resolves |
| Genuinely useful offline | Full last-known forecast, charts, and recommendations readable with airplane mode on |
| Premium feel | 60 fps scrolling and transitions on a mid-range Android device |
| Truly bilingual | Persian is a first-class locale with correct RTL layout, not a translated afterthought |
| Actionable, not just informational | Deterministic rule-based recommendations (clothing, umbrella, running, cycling, hiking, travel) |

### Engineering goals
- Zero `any` in application code.
- Business logic 100% unit-testable without React, network, or device.
- Architectural violations fail CI, not code review.
- A new engineer ships a correct feature on day one using only this document.
- Adding a weather provider touches exactly one layer.

---

## 3. Project Philosophy

**Dependencies point inward.** UI depends on business logic. Business logic depends on nothing.

**The domain layer is the product.** Screens, HTTP clients, and databases are replaceable details. The domain — what a forecast *is*, what makes air quality *unhealthy*, when you *need an umbrella* — is the asset. Protect it from everything else.

**Make illegal states unrepresentable.** Prefer a discriminated union that cannot express a contradiction over a wide interface plus runtime guards. Push correctness into the type system so tests have less to prove.

**Explicit over clever.** This codebase is read far more than written. A junior engineer should follow any file without a debugger. Cleverness that saves five lines and costs five minutes of comprehension is a net loss.

**Boring where it doesn't matter, excellent where it does.** Standard patterns for plumbing. Craft and invention reserved for the user-facing experience.

**Every rule has a reason.** A convention nobody can justify is cargo cult. If you cannot explain why a rule exists, challenge it in a PR rather than following it blindly.

---

## 4. Architecture Overview

**Feature-first Clean Architecture.** The codebase is sliced primarily by *feature*, and each feature is sliced internally by *layer*.

### The dependency rule

```
┌─────────────────────────────────────────────────┐
│                 PRESENTATION                    │
│   screens · components · hooks · stores         │
│   React, Reanimated, Skia, expo-router          │
└────────────────────┬────────────────────────────┘
                     │ depends on
                     ▼
┌─────────────────────────────────────────────────┐
│                    DOMAIN                        │
│   entities · repository interfaces · use cases   │
│   ★ pure TypeScript — depends on NOTHING ★       │
└────────────────────▲────────────────────────────┘
                     │ implements
                     │
┌────────────────────┴────────────────────────────┐
│                     DATA                         │
│   DTOs · mappers · data sources · repo impls     │
│   Axios, MMKV, SQLite, Zod                       │
└─────────────────────────────────────────────────┘
```

Presentation and Data both depend on Domain. **They never depend on each other.** Domain depends on neither.

This inversion is what makes the app testable: a use case can be tested with a two-line fake repository, and the UI can be tested against fake use cases, with no HTTP, no database, and no device.

### Supporting layers

| Layer | Contains | Depends on |
|---|---|---|
| `core/` | Framework infrastructure: HTTP client, storage drivers, error taxonomy, logger, DI container, i18n bootstrap, config | Nothing in `features/` |
| `shared/` | Cross-feature reusable UI primitives, hooks, utils, types | `core/`, `theme/` |
| `theme/` | Design tokens, light/dark palettes, weather-driven dynamic palettes | Nothing |
| `app/` | expo-router route tree — thin files only | `features/*` public barrels |

**`core/` and `shared/` must never import from `features/`.** They sit below features in the dependency graph. If something in `core/` needs to know about weather, it belongs in a feature, not in `core/`.

### Data flow, end to end

```
User pulls to refresh
        │
        ▼
useCurrentWeather()                      ← presentation/hooks
        │  TanStack Query
        ▼
GetCurrentWeather use case               ← domain (pure)
        │  calls WeatherRepository interface
        ▼
WeatherRepositoryImpl                    ← data
        │
        ├─► LocalWeatherDataSource ──► SQLite  (returns immediately if fresh)
        │
        └─► RemoteWeatherDataSource
                 │
                 ├─► OpenMeteoDataSource   (primary, no API key)
                 └─► OpenWeatherDataSource (fallback + severe alerts)
                          │
                          ▼
                   DTO ──► Zod validate ──► Mapper ──► Domain entity
```

The presentation layer never sees a DTO. The domain layer never sees Axios. That is the whole point.

---

## 5. Folder Structure

```
weather/
├── app/                          # expo-router route tree — THIN FILES ONLY
│   ├── _layout.tsx               #   root providers, i18n + RTL bootstrap
│   ├── (tabs)/                   #   tab navigator group
│   └── ...                       #   each route re-exports a screen from src/
│
├── src/
│   ├── core/                     # Framework infrastructure. Feature-agnostic.
│   │   ├── api/                  #   axios instance, interceptors, HTTP→AppError mapping
│   │   ├── config/               #   env vars, constants, feature flags
│   │   ├── di/                   #   composition root — wires interfaces to impls
│   │   ├── errors/               #   AppError union, Result<T, E>
│   │   ├── i18n/                 #   i18next setup, RTL bootstrap, locale formatters
│   │   ├── logger/               #   logging facade + pluggable sinks
│   │   ├── network/              #   connectivity state, online/offline detection
│   │   ├── query/                #   TanStack client, MMKV persister, cache version
│   │   └── storage/              #   MMKV + SQLite drivers, migrations
│   │
│   ├── features/                 # Feature slices. Each is self-contained.
│   │   ├── weather/
│   │   │   ├── domain/
│   │   │   │   ├── entities/     #     Forecast, CurrentConditions, DailyForecast…
│   │   │   │   ├── repositories/ #     WeatherRepository INTERFACE only
│   │   │   │   ├── services/     #     pure logic (AstronomyCalculator)
│   │   │   │   └── use-cases/    #     GetCurrentWeather, GetHourlyForecast…
│   │   │   ├── data/
│   │   │   │   ├── dto/          #     wire-shaped types + Zod schemas
│   │   │   │   ├── mappers/      #     DTO ⇄ entity
│   │   │   │   ├── datasources/  #     remote (per provider) + local (SQLite)
│   │   │   │   └── repositories/ #     WeatherRepositoryImpl
│   │   │   ├── presentation/
│   │   │   │   ├── screens/      #     full screens, imported by app/ routes
│   │   │   │   ├── components/   #     feature-specific components
│   │   │   │   ├── hooks/        #     useCurrentWeather, useHourlyForecast…
│   │   │   │   └── stores/       #     feature-scoped Zustand slices
│   │   │   └── index.ts          #   ★ THE FEATURE'S ONLY PUBLIC SURFACE ★
│   │   │
│   │   ├── locations/            # GPS, city search, reverse geocode, favorites
│   │   ├── air-quality/          # AQI + 6 pollutants
│   │   ├── maps/                 # Mapbox, RainViewer radar, weather layers
│   │   ├── alerts/               # severe weather alerts, push notifications
│   │   ├── recommendations/      # deterministic rules — NO data/ layer (see §7)
│   │   └── settings/             # units, theme, language, notification prefs
│   │
│   ├── shared/                   # Reusable across features
│   │   ├── ui/                   #   design system primitives (Text, Card, Glass…)
│   │   ├── hooks/                #   useDebounce, useAppState, useHaptics…
│   │   ├── utils/                #   pure helpers
│   │   └── types/                #   cross-cutting types
│   │
│   └── theme/                    # tokens, light/dark, weather-driven palettes
│
├── modules/                      # Local Expo modules (native)
│   └── weather-widget/           #   Android Glance + iOS WidgetKit
│
├── docs/
│   └── adr/                      # Architecture Decision Records
│
├── CLAUDE.md                     # ← you are here
└── ROADMAP.md                    # phased implementation plan
```

### Where does X go? — decision table

| You are writing… | It goes in… |
|---|---|
| A screen the router shows | `features/<f>/presentation/screens/` — `app/` only re-exports it |
| A button used by 3 features | `shared/ui/` |
| A button used by 1 feature | `features/<f>/presentation/components/` |
| A weather-specific calculation with no I/O | `features/weather/domain/services/` |
| A generic date helper | `shared/utils/` |
| The Axios instance | `core/api/` |
| A Zod schema for an API response | `features/<f>/data/dto/` |
| A TanStack Query hook | `features/<f>/presentation/hooks/` |
| A user preference store | `features/settings/presentation/stores/` |
| A colour value | `theme/` — **never** inline in a component |

---

## 6. Clean Architecture Guidelines

### Domain layer — the sacred core

**Allowed imports:** other domain files, and pure utility libraries with no side effects (`dayjs`, `suncalc`).

**Forbidden imports:** `react`, `react-native`, `axios`, `expo-*`, `@tanstack/*`, `zustand`, `zod`, anything from `data/` or `presentation/`.

> **Why:** the moment domain imports React, business logic can no longer be tested in a plain Node process, reasoned about independently, or reused by a widget or background task. This constraint is what makes everything else testable.

Contains:
- **Entities** — immutable, app-shaped models with behaviour. `Temperature`, `Forecast`, `AirQualityReading`.
- **Repository interfaces** — contracts the data layer must satisfy. *Interfaces only, never implementations.*
- **Use cases** — one business operation per class/function, single public method.
- **Domain services** — pure logic spanning multiple entities (e.g. `AstronomyCalculator`, `RecommendationEngine`).

```ts
// domain/repositories/weather-repository.ts
export interface WeatherRepository {
  getCurrent(coords: Coordinates): Promise<Result<CurrentConditions, AppError>>;
  getHourly(coords: Coordinates, hours: number): Promise<Result<HourlyForecast, AppError>>;
}

// domain/use-cases/get-current-weather.ts
export class GetCurrentWeather {
  constructor(private readonly repo: WeatherRepository) {}   // ← interface, not impl

  execute(coords: Coordinates): Promise<Result<CurrentConditions, AppError>> {
    return this.repo.getCurrent(coords);
  }
}
```

A use case that only forwards a call is still worth writing: it is the seam where caching policy, unit conversion, or business rules will land later, and it keeps presentation independent of the repository shape.

### Data layer — the replaceable details

Implements domain interfaces. Owns everything that touches the outside world: HTTP, SQLite, MMKV, third-party SDKs.

**Rule:** DTOs never escape this layer. If a `*Dto` type appears in `presentation/` or `domain/`, the architecture is broken.

### Presentation layer — the surface

React components, hooks, stores, navigation. Consumes use cases, never repositories or data sources directly.

**Rule:** no business logic in components. If a component computes *whether* to show something based on domain rules, that computation belongs in the domain.

---

## 7. Feature-Based Architecture Rules

### Rule 1 — features are islands
A feature may **never** reach into another feature's internals.

```ts
// ❌ FORBIDDEN — reaching into internals
import { WeatherRepositoryImpl } from '@/features/weather/data/repositories/weather-repository-impl';

// ✅ CORRECT — through the public barrel
import { useCurrentWeather } from '@/features/weather';
```

**Enforcement:** `eslint-plugin-boundaries` + `import/no-restricted-paths`. Violations fail CI.

### Rule 2 — every feature has exactly one public surface
`features/<name>/index.ts` is the feature's API. Export only what other features legitimately need — usually a few hooks, entities, and types. Everything else stays private.

Treat the barrel as a published package API: adding an export is a deliberate decision, not a reflex.

### Rule 3 — shared code moves down, never sideways
When two features need the same thing, **promote it** to `shared/` or `core/`. Never import feature A from feature B to reuse a helper.

### Rule 4 — features may omit layers they genuinely do not need
`recommendations/` has **no `data/` layer**, deliberately. It consumes weather entities and applies pure deterministic rules — it has no I/O of its own. Creating an empty `data/` folder for symmetry would be a lie about the design.

Omit a layer when it would be empty. Never create placeholder layers.

### Rule 5 — cross-feature composition happens in presentation
When the home screen needs weather + air quality + recommendations together, that composition happens in a screen or a coordinating hook that imports each feature's public barrel. It does not happen by merging features.

---

## 8. State Management Guidelines

Two tools, one clean split. **Getting this wrong is the most common source of state bugs, so the boundary is absolute.**

| | TanStack Query | Zustand |
|---|---|---|
| Owns | **Server state** — anything that originated remotely | **Client state** — anything the user or device decides |
| Examples | forecasts, AQI, alerts, geocoding results | unit prefs, theme mode, language, selected location id, notification settings |
| Persistence | MMKV persister (cache hydration) | MMKV `persist` middleware |
| Test | *"Could this be stale?"* → Query | *"Is this purely a local decision?"* → Zustand |

**Never copy server data into Zustand.** It immediately becomes a second source of truth that silently goes stale. If you feel the urge, you actually want a Query `select`, or a derived value computed at render.

### TanStack Query rules

- **Query keys are typed and centralized** per feature in `presentation/hooks/query-keys.ts`. Never inline a string array at a call site — that is how cache invalidation silently breaks.
  ```ts
  export const weatherKeys = {
    all: ['weather'] as const,
    current: (geohash: string) => [...weatherKeys.all, 'current', geohash] as const,
    hourly:  (geohash: string) => [...weatherKeys.all, 'hourly',  geohash] as const,
  };
  ```
- **Query keys use quantized coordinates** (geohash), never raw floats. Raw GPS coordinates change on every fix, producing a cache miss every single time — a subtle and expensive bug.
- `staleTime` is set **per data type** from the caching table in §25. Never leave it at the default.
- Hooks call **use cases**, never repositories or Axios.
- Mutations that change user-visible state use optimistic updates with rollback (favorites, settings).

### Zustand rules

- One store per concern, not one global store.
- Stores hold **state and actions only** — no async I/O, no fetching. Async work lives in use cases.
- Always select narrowly: `useSettingsStore(s => s.tempUnit)`, never `useSettingsStore()` — the latter re-renders on every unrelated change.
- Persisted stores declare an explicit `version` and `migrate` function from day one. Retrofitting migrations onto shipped persisted state is painful.

---

## 9. API Layer Guidelines

### Provider map

| Concern | Source | Key required |
|---|---|---|
| Forecast — current, 15-min, hourly, daily (16 d) | Open-Meteo Forecast | **no** |
| Historical weather (1940 →) | Open-Meteo Archive | **no** |
| Air quality — PM2.5, PM10, CO, NO₂, SO₂, O₃, EU/US AQI | Open-Meteo Air Quality | **no** |
| City search | Open-Meteo Geocoding | **no** |
| Reverse geocoding | `expo-location` (OS-native) → Mapbox fallback | no / Mapbox |
| Severe weather alerts | OpenWeather One Call 3.0 | yes |
| Rain radar tiles | RainViewer | **no** |
| Map tiles | Mapbox | yes |
| Sun position, moon phase & illumination | `suncalc`, **computed on-device** | **no** |
| Push delivery | Firebase Cloud Messaging | yes |

See [ADR-0002](docs/adr/0002-open-meteo-as-primary-provider.md) for why Open-Meteo replaced the originally specified Tomorrow.io, and [ADR-0008](docs/adr/0008-local-astronomy-computation.md) for why astronomy is computed rather than fetched.

> **Attribution is mandatory.** Open-Meteo's free tier is CC-BY 4.0. The Settings screen must credit Open-Meteo with a link. This is a licence obligation, not a nicety.

### Client rules

- **One Axios instance per provider**, created in `core/api/`. Never call `axios.get` directly from anywhere else.
- **Interceptors are the only place HTTP errors exist.** A response interceptor maps every failure into a typed `AppError` (§22). Above `core/api/`, no code inspects `error.response.status`.
- **Every response is validated with Zod at the boundary.** External APIs change without warning; an unvalidated response corrupts the cache and crashes a screen far from the cause. Validate once, at the edge, where the error message is still meaningful.
- **Timeouts always.** No request without an explicit timeout.
- **Secrets come from `core/config/env.ts`**, sourced from EAS Secrets / `.env`. Never a literal key in code, never a key committed to git.

### The proxy seam

All remote access flows through `RemoteDataSource` classes behind repository interfaces. Introducing a backend-for-frontend later means changing the `baseURL` and the DTO shape in the data layer only — no domain or presentation code changes. Preserve this seam; do not let provider-specific concepts leak upward. See [ADR-0003](docs/adr/0003-client-direct-api-keys-with-proxy-seam.md).

---

## 10. Repository Pattern Guidelines

The repository is the **only** boundary between business logic and the outside world.

**Interface lives in `domain/repositories/`. Implementation lives in `data/repositories/`.** This is dependency inversion; it is what lets a use case be tested with a fake in two lines.

Rules:
1. Repository methods speak in **domain entities** — never DTOs, never `AxiosResponse`.
2. Repositories return `Result<T, AppError>` — they do not throw across the boundary.
3. Repositories own the **cache-first orchestration**: check local, decide freshness, fetch remote, persist, return. Use cases must not know whether data came from network or disk.
4. One repository per aggregate, not per endpoint. `WeatherRepository`, not `CurrentWeatherRepository` + `HourlyRepository`.
5. Repositories are registered in `core/di/` and injected. Never constructed inside a use case or component.

```ts
// data/repositories/weather-repository-impl.ts
export class WeatherRepositoryImpl implements WeatherRepository {
  constructor(
    private readonly remote: RemoteWeatherDataSource,
    private readonly local: LocalWeatherDataSource,
  ) {}

  async getCurrent(coords: Coordinates): Promise<Result<CurrentConditions, AppError>> {
    const cached = await this.local.getCurrent(coords);
    if (cached && !cached.isStale) return ok(cached.value);

    const result = await this.remote.getCurrent(coords);
    if (result.isOk()) await this.local.saveCurrent(coords, result.value);

    // Offline with stale data beats an error screen.
    if (result.isErr() && cached) return ok(cached.value);
    return result;
  }
}
```

That last branch is the heart of offline-first: **stale data is almost always better than no data**, as long as the UI labels its age.

---

## 11. DTO & Mapper Guidelines

**DTOs mirror the wire. Entities model the domain. They are never the same type.**

| | DTO | Entity |
|---|---|---|
| Shape | Exactly what the API sends — `snake_case`, nullable, provider-specific | What the app needs — `camelCase`, non-null, provider-agnostic |
| Location | `data/dto/` | `domain/entities/` |
| Units | Whatever the provider chose | Canonical (always Celsius, m/s, hPa internally) |
| May be `null` | Yes | **No** — mappers resolve absence explicitly |

> **Why not skip the DTO and use the API shape directly?** Because then a provider changing `temp` to `temperature`, or adding a fallback provider with a different schema, becomes a refactor across every screen. The mapper is a one-file firewall. This pays for itself the first time an upstream API changes.

### Mapper rules

- Mappers are **pure functions**, one direction per function: `toDomain()`, `toDto()`.
- Mappers live in `data/mappers/`, never in components or use cases.
- Mappers **normalize units** to canonical internal form. Display conversion (°C→°F) happens in presentation, driven by user settings. Storing user-preferred units corrupts the cache when the user changes preferences.
- Mappers handle nullability explicitly — a missing field becomes a documented default or an explicit `undefined` on an optional entity field, never a silent `0`. *A dew point of `0°C` and a missing dew point are different facts.*
- Every mapper has a unit test. They are pure, fast, and catch the majority of integration bugs.

```ts
// data/mappers/current-conditions-mapper.ts
export function toCurrentConditions(dto: OpenMeteoCurrentDto): CurrentConditions {
  return {
    temperature:      Temperature.celsius(dto.temperature_2m),
    apparentTemp:     Temperature.celsius(dto.apparent_temperature),
    humidity:         dto.relative_humidity_2m,
    dewPoint:         dto.dew_point_2m != null
                        ? Temperature.celsius(dto.dew_point_2m)
                        : undefined,          // absent ≠ zero
    windSpeed:        Speed.metersPerSecond(dto.wind_speed_10m),
    observedAt:       dayjs(dto.time).toDate(),
  };
}
```

Each provider gets **its own mapper** to the same entity. That is how two providers stay interchangeable.

---

## 12. TypeScript Standards

`strict: true`, plus:

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,     // arr[0] is T | undefined — it really is
  "exactOptionalPropertyTypes": true,   // { a?: string } ≠ { a: string | undefined }
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "verbatimModuleSyntax": true
}
```

Rules:
- **`any` is banned.** Use `unknown` and narrow. Enforced by `@typescript-eslint/no-explicit-any` as an error.
- **No type assertions to silence the compiler.** `as` is acceptable only for genuinely unrepresentable narrowing, with a comment explaining why. `as any` is never acceptable.
- **`as const` for literal data**, so tokens and keys keep narrow types.
- **Discriminated unions over optional-field soup**:
  ```ts
  // ❌ allows the impossible: loading AND error at once
  type State = { loading: boolean; data?: Forecast; error?: Error };

  // ✅ illegal states cannot be expressed
  type State =
    | { status: 'loading' }
    | { status: 'success'; data: Forecast }
    | { status: 'error'; error: AppError };
  ```
- **Branded types for units** — a raw `number` for temperature invites Celsius/Fahrenheit mixups that the compiler cannot catch. `Temperature`, `Speed`, `Pressure` are value objects.
- **`readonly` on entity fields and array props.** Entities are immutable.
- **Exhaustive switches** end with a `never` check so adding a union member becomes a compile error, not a silent fallthrough.
- **No enums** — use `as const` objects with derived union types. TS enums have surprising runtime semantics and poor tree-shaking.
- **Explicit return types on all exported functions.** Inference is fine internally; public surfaces are documentation.

---

## 13. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files & folders | `kebab-case` | `current-conditions-mapper.ts` |
| React components | `PascalCase` file + export | `WeatherCard.tsx` |
| Hooks | `use` + camelCase | `useCurrentWeather.ts` |
| Types & interfaces | `PascalCase`, **no `I` prefix** | `WeatherRepository` |
| Implementations | `<Interface>Impl` | `WeatherRepositoryImpl` |
| Use cases | Verb phrase, `PascalCase` | `GetCurrentWeather` |
| DTOs | `<Name>Dto`, provider-prefixed | `OpenMeteoCurrentDto` |
| Zod schemas | `<name>Schema` | `openMeteoCurrentSchema` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_STALE_TIME_MS` |
| Booleans | `is` / `has` / `should` / `can` | `isStale`, `hasAlerts` |
| Event handlers | `handle` (definition) / `on` (prop) | `handlePress` / `onPress` |
| Test files | `<subject>.test.ts` beside the subject | `get-current-weather.test.ts` |
| Zustand stores | `use<Name>Store` | `useSettingsStore` |

**Say what it is, not what it is made of.** `WeatherCard`, not `WeatherView`. `useCurrentWeather`, not `useWeatherData`.

**No abbreviations** except universally understood domain terms (`AQI`, `UV`, `GPS`, `PM25`).

---

## 14. Import Conventions

### Path aliases — no relative escapes

```ts
// ❌ FORBIDDEN
import { Card } from '../../../../shared/ui/card';

// ✅ CORRECT
import { Card } from '@/shared/ui';
```

Configured aliases: `@/core/*`, `@/features/*`, `@/shared/*`, `@/theme/*`.

Relative imports are allowed **only within the same layer of the same feature** (`./mappers/x`, `../entities/y`). Anything crossing a feature or layer boundary uses an alias, because aliased paths make boundary violations visible in review and lintable in CI.

### Import order

Enforced automatically by `eslint-plugin-import` with `--fix`; never hand-sort.

```ts
// 1. React & React Native
import { useMemo } from 'react';
import { View } from 'react-native';

// 2. External packages
import { useQuery } from '@tanstack/react-query';

// 3. Core
import { logger } from '@/core/logger';

// 4. Shared & theme
import { Card } from '@/shared/ui';
import { spacing } from '@/theme';

// 5. Other features (public barrels only)
import { useSelectedLocation } from '@/features/locations';

// 6. Same feature (relative)
import { WeatherIcon } from './weather-icon';

// 7. Types (separate, with `type` keyword)
import type { CurrentConditions } from '@/features/weather';
```

### Barrel rules
- Every feature exposes `index.ts`. Every `shared/*` folder exposes `index.ts`.
- **Never create a barrel that re-exports the whole app.** A single mega-barrel destroys tree-shaking and creates import cycles.
- Barrels re-export; they never contain logic.

---

## 15. Component Design Rules

1. **One component per file.** The file is named after it.
2. **Presentational by default.** A component receives data through props and renders it. Data fetching lives in a hook, called by a screen or container.
3. **Screens compose; components render.** Screens may call hooks and orchestrate. Leaf components should be trivially testable with plain props.
4. **Props interfaces are explicit and local**, named `<Component>Props`. Never `React.FC` — it adds implicit `children` and weakens inference.
5. **No business logic.** Formatting for display is fine. Deciding *whether it will rain* is domain logic.
6. **No inline styles, no literal colours, no magic numbers.** Every visual value comes from `@/theme`. Enforced by lint.
7. **Memoize deliberately.** `React.memo` on list items and anything under an animated parent. Do not blanket-memoize — misapplied memoization costs more than it saves.
8. **Accessibility is not optional.** Every interactive element has `accessibilityRole` and a translated `accessibilityLabel`. Every non-decorative icon has a label.
9. **Components handle their own loading and empty states** via skeletons, never a bare spinner in place of the layout.
10. **Keep them small.** A component over ~150 lines is a composition opportunity you have not taken yet.

```tsx
interface WeatherCardProps {
  readonly conditions: CurrentConditions;
  readonly onPress?: () => void;
}

export function WeatherCard({ conditions, onPress }: WeatherCardProps) {
  const { colors, spacing } = useTheme();
  // ...
}
```

---

## 16. Custom Hook Guidelines

- **One responsibility per hook.** `useCurrentWeather` fetches weather. It does not also manage the selected location.
- **Hooks call use cases**, never repositories, data sources, or Axios.
- **Name by what it returns**, not how it works: `useCurrentWeather`, not `useWeatherQuery`.
- **Return objects, not positional tuples**, beyond two values — positional returns become unreadable at call sites.
- **Hooks own no UI.** A hook returning JSX is a component wearing a disguise.
- **Rules of Hooks are enforced** by `eslint-plugin-react-hooks` (error, including `exhaustive-deps`).
- **Query hooks live in the feature that owns the data**, and are exported through the feature barrel if other features need them.
- **Every hook with logic worth trusting gets a test** via `renderHook`.

```ts
export function useCurrentWeather(coords: Coordinates) {
  const getCurrentWeather = useGetCurrentWeather();          // from DI
  return useQuery({
    queryKey: weatherKeys.current(geohash(coords)),          // quantized
    queryFn:  () => getCurrentWeather.execute(coords),
    staleTime: STALE_TIME.current,                           // per §25
  });
}
```

---

## 17. Navigation Guidelines

**expo-router, file-based.**

- **`app/` files are thin.** A route file wires params and re-exports a screen. All UI lives in `features/*/presentation/screens/`.
  ```tsx
  // app/(tabs)/index.tsx
  export { HomeScreen as default } from '@/features/weather';
  ```
  > **Why:** this keeps navigation structure independent of UI implementation. Restructuring the router never touches screen code, and screens stay unit-testable without a navigation context.
- **Route params are typed and validated.** Params arrive as strings from a URL; parse them with Zod at the route boundary rather than trusting them.
- **Deep links are designed, not discovered.** Every route that makes sense as an entry point (a saved city, an alert) has a documented URL and is reachable from a notification.
- **Navigation state is not app state.** Do not mirror the current route into Zustand.
- **Shared element transitions** connect list items to detail screens for the weather card → detail flow.
- **Back must always be safe.** No destructive action is reachable without confirmation.

---

## 18. Theme Architecture

**Every visual value is a token. Zero literal colours in components — enforced by lint.**

```
theme/
├── tokens/
│   ├── colors.ts        # raw palette — never used directly by components
│   ├── spacing.ts       # 4pt scale
│   ├── typography.ts    # per-script families (Inter / Vazirmatn), sizes, weights
│   ├── radii.ts
│   └── elevation.ts
├── semantic/
│   ├── light.ts         # raw tokens → meaning: surface, textPrimary, accent…
│   └── dark.ts
├── weather/
│   └── conditions.ts    # condition + time-of-day → gradient set
└── index.ts             # useTheme()
```

### Three layers of tokens

1. **Raw** — `blue500`. Never referenced by a component.
2. **Semantic** — `colors.surface`, `colors.textPrimary`. What components use.
3. **Dynamic weather palette** — `(condition, isDaytime, sunElevation) → gradient`.

> **Why the indirection?** Components bind to *meaning*, not to a colour. Dark mode is then a swap of the semantic layer, and a palette change never touches a component.

### Dynamic weather backgrounds

A pure function `getWeatherPalette(condition, timeOfDay)` in `theme/weather/` returns the gradient set for the current sky. It is pure and unit-tested — the background is a *derivation* of weather state, not ad-hoc styling scattered across screens.

### Rules
- Access theme through `useTheme()`. Never import a palette file into a component.
- Both light and dark must be handled. A component that only looks right in one is unfinished.
- Glassmorphism is a shared `<GlassSurface>` primitive in `shared/ui/`, not repeated blur props.
- Typography is script-aware: Persian text uses Vazirmatn with its own line-height, because Persian glyphs need more vertical room than Latin at the same point size.

---

## 19. Internationalization & RTL

**English and Persian are both first-class. RTL is designed in, never retrofitted.**

> **Why this is a top-level section:** RTL is the single most expensive thing to add late. Every hardcoded `marginLeft` written before RTL support becomes a bug that must be found by hand.

### Rules

1. **No hardcoded user-facing strings.** Every string comes from i18next. Enforced by `eslint-plugin-i18next`.
2. **Logical properties only.** `marginStart` / `paddingEnd` / `start` / `end`. **`left`, `right`, `marginLeft`, `paddingRight` are banned by lint rule** — they silently break Persian layout.
3. **Namespaced translation keys** by feature: `weather:current.feelsLike`. Never a flat global file.
4. **Formatting is locale-aware, always.** Numbers, dates, and units go through `core/i18n/formatters`. Persian uses Persian-Indic digits (۰۱۲۳) and optionally the Jalali calendar via Day.js plugins. Never concatenate a number into a string by hand.
5. **Pluralization via i18next**, never manual `count === 1 ? … : …` — Persian and English have different plural rules.

### ⚠️ Known RTL traps — read before building any chart or gesture

These do **not** flip automatically and cause the most common RTL bugs in this class of app:

| Component | Trap | Required handling |
|---|---|---|
| **Reanimated gestures** | Swipe direction is not mirrored. A "swipe to next day" gesture goes the wrong way in Persian. | Multiply translation by `isRTL ? -1 : 1` |
| **Skia charts** | The canvas has no concept of layout direction. Axes and time series render left-to-right regardless of locale. | Explicitly invert the x-axis scale when `isRTL` |
| **FlashList horizontal** | Initial scroll offset and item order need explicit handling | Set `inverted` / initial offset from `isRTL` |
| **Icons with direction** | Arrows, chevrons, wind direction | Mirror directional icons; **never mirror the compass** — north is north |
| **`I18nManager.forceRTL`** | Requires a full app restart to take effect | Restart flow via `expo-updates.reloadAsync()` after a confirmation dialog |

Read `isRTL` from `core/i18n`, never from `I18nManager` directly in a component.

**Every screen must be reviewed in Persian before its PR merges.** Not a spot check — the whole screen.

---

## 20. Animation Guidelines

- **Reanimated worklets run on the UI thread.** Anything driving a gesture or a continuous animation is a worklet. Animating layout from JS is the primary cause of jank.
- **Never animate `width`/`height`/layout props.** Animate `transform` and `opacity` — they are GPU-composited. Layout animation forces reflow every frame.
- **Skia for anything painterly**: charts, weather particle effects, gradient meshes. Not the RN view system.
- **Lottie for illustrative loops** (sun, rain, snow), preloaded and cached; never fetched at render time.
- **Gesture Handler for all touch.** No `PanResponder`.
- **Respect `prefers-reduced-motion`.** Read accessibility settings and degrade to instant transitions. Animation must never be the only way information is conveyed.
- **Haptics are punctuation, not decoration.** Bind to meaningful state changes (refresh complete, unit toggled), never to scrolling.
- **Every animation has a purpose:** it explains a spatial relationship, gives feedback, or communicates state. "It looks cool" is not a purpose.
- **Budget: 60 fps on a mid-range Android device.** Profile there, not on a flagship iPhone.

---

## 21. Performance Guidelines

### Startup
- Render from **MMKV cache synchronously** on first frame. Never block the first paint on the network or on SQLite.
- Lazy-load heavy routes (maps, charts) with `React.lazy` — Mapbox and Skia are large.
- Defer non-critical work (analytics init, notification registration) until after the first interaction.

### Lists
- **FlashList everywhere**, never `FlatList` or `ScrollView.map()` for dynamic data.
- Provide accurate `estimatedItemSize` — a wrong estimate defeats the point.
- List items are `React.memo` with stable, non-index keys.
- Never create inline objects/arrays/functions in `renderItem` — new identities every frame kill memoization.

### Rendering
- Narrow Zustand selectors (§8).
- `useMemo` for genuinely expensive computation; `useCallback` for callbacks crossing a memo boundary. Not reflexively — both have a cost.
- Colocate state as low as possible. State lifted too high re-renders subtrees that do not care.

### Images & assets
- `expo-image` with explicit `cachePolicy` and `recyclingKey` in lists.
- SVG for icons; raster only for photographic assets.
- Lottie files preloaded, never fetched at render.

### Network
- Cache-first everywhere (§25).
- Request coalescing — concurrent identical requests share one in-flight promise.
- Quantized coordinates so a two-metre GPS drift does not invalidate the cache.

### Budgets — these are gates, not aspirations
| Metric | Budget |
|---|---|
| Cold start to first content | < 500 ms (from cache) |
| Scroll frame rate, mid-range Android | 60 fps, no dropped frames > 2/s |
| Home screen JS bundle | < 2 MB |
| Memory, steady state | < 200 MB |

---

## 22. Error Handling Strategy

**Errors are values, not exceptions, across layer boundaries.**

```ts
export type Result<T, E> = Ok<T, E> | Err<T, E>;
```

> **Why:** a thrown exception is invisible in the type system. `Result` makes every failure path something the compiler forces you to handle. Callers cannot forget an error case they can see in the signature.

### The AppError taxonomy

```ts
export type AppError =
  | { kind: 'network';           retryable: true  }
  | { kind: 'timeout';           retryable: true  }
  | { kind: 'rateLimit';         retryAfterMs: number; retryable: true }
  | { kind: 'providerDegraded';  provider: string; retryable: true }
  | { kind: 'notFound';          resource: string; retryable: false }
  | { kind: 'validation';        issues: string[]; retryable: false }
  | { kind: 'permissionDenied';  permission: 'location' | 'notifications'; retryable: false }
  | { kind: 'unknown';           cause: unknown;   retryable: false };
```

### Rules
1. **Map to `AppError` at the boundary.** The Axios interceptor and Zod parse are the only places raw errors exist. Nothing above `core/api/` inspects a status code.
2. **`retryable` drives retry policy** — TanStack Query reads the flag rather than guessing from the error shape.
3. **Never swallow an error.** Handle it, propagate it, or log it. A bare `catch {}` is a merge blocker.
4. **Every error is user-translatable.** `AppError.kind` maps to a translated message. Never show a raw API message — it is untranslated and often leaks internals.
5. **Error boundaries per route**, with a retry affordance. One screen failing must not blank the app.
6. **Offline is not an error.** Missing connectivity with cached data is a *normal state* showing stale data with its age. Reserve error UI for genuine failure.

---

## 23. Logging Strategy

**Never call `console.log` in committed code.** Enforced by lint (error).

Use the `core/logger` facade, which fans out to a list of **sinks**. Call sites
depend on the `Logger` interface only, so adding a sink is a registration change
in the composition root and touches no calling code.

| Level | Use for | Dev | Prod |
|---|---|---|---|
| `debug` | Local tracing | console | dropped |
| `info` | Lifecycle milestones | console | breadcrumb |
| `warn` | Recoverable degradation (fallback provider engaged) | console | breadcrumb |
| `error` | Failures needing attention | console | **Sentry** |

**Sink status:** the console sink ships in Phase 1. The Sentry sink is registered
in Phase 11, where its DSN, source maps, and release health are configured
together. Reactotron implements the same `LogSink` interface and can be
registered locally by a developer who wants it; it is not a build dependency,
because it requires a running desktop companion app.

Rules:
- **Never log PII or secrets.** Coordinates are personal data — log a geohash at reduced precision, never a raw user position, and never an API key or token.
- **Structured context, not string soup:** `logger.warn('provider.fallback', { from, to, reason })`.
- Log at the point of *handling*, not the point of *throwing*, to avoid duplicate reports of one failure.
- Sentry is production-only, with source maps uploaded during EAS build, and release health enabled.
- Reactotron is development-only and must be tree-shaken out of production builds.

---

## 24. Offline-First Strategy

**The network is an enhancement, not a requirement.** Design every screen assuming it will open in airplane mode.

### Read path
```
Screen mounts
   → MMKV hydrates Query cache synchronously  → content renders on first frame
   → SQLite returns the durable record        → content refines
   → if online AND stale: background revalidate → content updates silently
```

The user never sees a spinner where cached content could be shown.

### Rules
1. **Stale data beats no data**, provided its age is visible. Every cached view shows a "last updated" indicator.
2. **Never block the UI on connectivity.** Connectivity state adjusts *behaviour*, never gates *rendering*.
3. **Writes are optimistic** (favorites, settings) with rollback on failure, and queued for sync if offline.
4. **Sync is automatic** on regaining connectivity and on app foreground — with debouncing, never a tight retry loop.
5. **Everything the widget needs lives in SQLite**, written by the app, so widgets render without launching the app.
6. **Offline is a designed state, not an error screen.** A distinct, calm visual treatment.

### Two storage tiers — distinct jobs, never blurred

| | MMKV | SQLite |
|---|---|---|
| Access | **Synchronous** | Async |
| Use for | Settings, Zustand persistence, Query cache hydration | Forecast snapshots, historical series, chart data, widget source |
| Why | Readable on the first frame — makes instant startup possible | Queryable and durable — supports time-range queries MMKV cannot |
| Size | Small, hot | Large, structured |

Do not put bulk forecast history in MMKV, and do not put settings in SQLite. See [ADR-0004](docs/adr/0004-offline-first-storage-model.md).

---

## 25. Caching Strategy

### Staleness tiers

Different data decays at different rates. A single global `staleTime` either wastes quota or shows stale data.

| Data | `staleTime` | `gcTime` | Rationale |
|---|---|---|---|
| 15-minute precipitation | 5 min | 1 h | Changes fastest, most time-sensitive |
| Current conditions | 10 min | 6 h | Upstream updates ~10–15 min |
| Hourly forecast | 1 h | 24 h | Model runs are hourly at best |
| Air quality | 1 h | 24 h | Hourly upstream resolution |
| Daily forecast | 6 h | 48 h | Model runs ~4×/day |
| Severe alerts | 5 min | 1 h | Safety-critical — freshness matters most |
| Historical | `Infinity` | `Infinity` | The past does not change |
| Geocoding results | 30 days | 90 days | City coordinates are effectively static |

### Cache keys
- **Always quantized coordinates.** Raw GPS floats change on every fix and produce a permanent cache miss — a subtle, expensive bug. Use a geohash at a precision matching weather-grid resolution (~±1 km).
- Keys are built by the centralized key factory (§8), never inline.

### Invalidation
- **Pull-to-refresh** invalidates only the visible screen's keys, not the whole cache.
- **Changing display units invalidates nothing** — units are a presentation concern, and cached data is stored canonically.
- **Adding a location** does not invalidate other locations.
- **Cache version key**: bumping the app's cache schema version discards incompatible persisted data on upgrade rather than crashing on a shape mismatch.

---

## 26. Testing Strategy

**Test where the value density is highest.** This architecture concentrates that in the domain layer.

### The pyramid

| Layer | What | How | Coverage target |
|---|---|---|---|
| **Domain** | Use cases, entities, recommendation rules, astronomy | Plain Jest, zero mocks | **95%+** |
| **Mappers** | DTO → entity, per provider | Plain Jest with fixture JSON | **100%** |
| **Repositories** | Cache-first logic, fallback, staleness | Jest + fake data sources | 80% |
| **Hooks** | Query hooks, state hooks | `renderHook` + fake use cases | 70% |
| **Components** | Rendering, interaction, a11y | React Native Testing Library | Critical paths |
| **E2E** | Core journeys | Maestro | Happy paths only |

### Rules
1. **Domain tests use no mocking framework.** If a use case needs `jest.mock`, its dependencies are wrong — inject a fake implementing the interface.
2. **Mapper tests use real captured API responses** as fixtures, committed in `data/dto/__fixtures__/`. This is how upstream schema changes get caught.
3. **Test behaviour, not implementation.** Query by accessible role and text, never by `testID` where a role exists, and never assert on internal state.
4. **Every bug fix starts with a failing test** that reproduces it.
5. **Network is never real in tests.** MSW at the boundary, or a fake data source.
6. **Both locales tested** for any component with layout direction sensitivity.
7. **Test names read as sentences:** `returns cached data when the network fails and cache exists`.

Rule of thumb: if a test breaks when you rename a private variable, it is testing the wrong thing.

---

## 27. Documentation Standards

- **This file is the entry point** and must stay accurate. A PR changing architecture updates `CLAUDE.md` in the same PR.
- **ADRs for load-bearing decisions** in `docs/adr/`, numbered sequentially, never deleted. A superseded ADR is marked `Superseded by ADR-XXXX` and kept — the reasoning history is the value.
- **Comments explain *why*, never *what*.** The code says what.
  ```ts
  // ❌ increments the retry counter
  // ✅ Open-Meteo has no free-tier uptime SLA, so we fail over rather than retry
  ```
- **TSDoc on every exported domain symbol** — entities, use cases, repository interfaces. These are the API of the product's core.
- **Every feature barrel has a header comment** stating the feature's responsibility and its public surface.
- **Non-obvious formulas cite their source.** Heat index, wind chill, AQI breakpoints, moon phase — link the standard (NOAA, EPA) in a comment. Future readers must be able to verify correctness against an authority.
- **Each layer folder has a `README.md`** stating what belongs there and what does not.

---

## 28. Code Review Checklist

**Architecture**
- [ ] Dependencies point inward; domain imports nothing framework-related
- [ ] No cross-feature imports except through public barrels
- [ ] DTOs do not escape the data layer
- [ ] Business logic is in the domain, not in a component or hook

**Types**
- [ ] No `any`; no assertions used to silence the compiler
- [ ] Illegal states are unrepresentable (unions over optional soup)
- [ ] Exported functions have explicit return types

**State & data**
- [ ] Server state in Query, client state in Zustand — no server data copied into a store
- [ ] Query keys from the key factory, using quantized coordinates
- [ ] `staleTime` set deliberately per §25

**UI**
- [ ] No literal colours, spacing, or magic numbers — tokens only
- [ ] Light and dark both correct
- [ ] **Reviewed in Persian**; logical properties only; charts and gestures direction-correct
- [ ] `accessibilityRole` and translated `accessibilityLabel` on interactive elements
- [ ] Loading uses skeletons; empty and error states exist

**Errors & performance**
- [ ] Failures return `AppError`; no bare `catch {}`; no `console.log`
- [ ] Offline path works with cached data
- [ ] FlashList with accurate `estimatedItemSize`; no inline objects in `renderItem`
- [ ] Animations on `transform`/`opacity`, worklets on the UI thread

**Tests & docs**
- [ ] Domain logic and mappers tested
- [ ] `CLAUDE.md` / ADRs updated if architecture changed

---

## 29. Pull Request Checklist

Before requesting review:

- [ ] Branch named `<type>/<short-description>` (`feat/hourly-forecast-chart`)
- [ ] PR title follows Conventional Commits
- [ ] Description states **what** changed, **why**, and **how it was verified**
- [ ] Screenshots or screen recording for any UI change — **light and dark, English and Persian**
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all pass locally
- [ ] No `.only`, no commented-out code, no debug logging
- [ ] No new dependency without justification in the description
- [ ] No secrets, keys, or `.env` files in the diff
- [ ] Code review checklist (§28) self-applied
- [ ] PR is focused and reviewable — split anything over ~400 changed lines

---

## 30. Commit Convention

**Conventional Commits**, enforced by Commitlint via a Husky `commit-msg` hook.

```
<type>(<scope>): <subject>
```

| Type | Use |
|---|---|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `refactor` | Restructuring with no behaviour change |
| `perf` | Performance improvement |
| `style` | Formatting only |
| `test` | Tests only |
| `docs` | Documentation only |
| `build` | Build system, dependencies, native config |
| `ci` | CI configuration |
| `chore` | Maintenance |

**Scope** is the feature or layer: `weather`, `locations`, `maps`, `core`, `theme`, `i18n`, `widgets`.

```
feat(weather): add 15-minute precipitation chart
fix(i18n): invert Skia chart x-axis under RTL
perf(locations): quantize coordinates in query keys to prevent cache misses
refactor(core): map HTTP failures to AppError in the interceptor
```

Rules: imperative mood ("add", not "added"), no trailing period, subject ≤ 72 chars, body explains *why*. Breaking changes use `!` and a `BREAKING CHANGE:` footer.

---

## 31. Best Practices

- **Make the change easy, then make the easy change.** Refactor first, in its own commit.
- **Prefer composition over inheritance.** No class hierarchies in UI code.
- **Prefer pure functions.** They are trivially testable and impossible to misuse.
- **Immutability by default.** `readonly` entities; never mutate props, state, or arguments.
- **Colocate related code.** Test beside subject, component beside its styles.
- **Delete aggressively.** Dead code is a liability; git remembers it.
- **One reason to change per module** (SRP). A file doing two things is two files.
- **Depend on abstractions** (DIP). Use cases depend on repository interfaces, never implementations.
- **Fail fast and loudly in development**, gracefully and quietly in production.
- **Design for the mid-range Android device**, not your simulator.
- **Optimize only what you measured.** Profile before you tune.
- **When a rule blocks the right outcome, change the rule in a PR** — do not quietly ignore it.

---

## 32. Forbidden Patterns

These fail review. Most fail CI.

### Architecture
- ❌ **Domain importing React, Axios, Expo, or anything from `data/` or `presentation/`** — destroys testability, the foundation of everything else
- ❌ **Importing another feature's internals** instead of its barrel — creates the tangle feature slicing exists to prevent
- ❌ **DTOs in `presentation/` or `domain/`** — couples the UI to a provider's wire format
- ❌ **A component calling Axios, a repository, or a data source directly** — bypasses every layer
- ❌ **Business logic in a component** — untestable and unreusable
- ❌ **`core/` or `shared/` importing from `features/`** — inverts the dependency graph
- ❌ **Empty placeholder layers** created for symmetry

### Types
- ❌ **`any`**, or `as any`
- ❌ **`as` used to silence the compiler**
- ❌ **`@ts-ignore`** — use `@ts-expect-error` with an explanation, or fix it
- ❌ **TS `enum`** — use `as const` objects
- ❌ **Optional-field state soup** where a union belongs

### State
- ❌ **Server data copied into Zustand** — creates a second, silently stale source of truth
- ❌ **Inline query keys** — breaks invalidation in ways that are very hard to debug
- ❌ **Raw float coordinates in query keys** — guarantees a permanent cache miss
- ❌ **Subscribing to a whole Zustand store** — re-renders on every unrelated change
- ❌ **Async I/O inside a Zustand store**

### UI
- ❌ **Literal colours, spacing, or font sizes** in components
- ❌ **`left` / `right` / `marginLeft` / `paddingRight`** — breaks Persian layout
- ❌ **Hardcoded user-facing strings**
- ❌ **`FlatList` or `ScrollView.map()`** for dynamic lists
- ❌ **`React.FC`**
- ❌ **Animating layout props** (`width`, `height`, `top`) instead of `transform`
- ❌ **`PanResponder`** — use Gesture Handler
- ❌ **A bare spinner** where a skeleton belongs

### General
- ❌ **`console.log`** in committed code
- ❌ **Bare `catch {}`** — silently discards failures
- ❌ **Throwing across a layer boundary** — return `Result`
- ❌ **Secrets in code or git**
- ❌ **Logging raw user coordinates** — PII
- ❌ **`index.ts` mega-barrels** re-exporting the app — breaks tree-shaking, creates cycles
- ❌ **Relative imports crossing a feature or layer boundary**
- ❌ **Commented-out code**

---

## 33. Guide: Creating a New Feature

Worked example: adding a **Pollen** feature.

**1. Confirm it is a feature.** A feature owns a distinct user-facing capability with its own data and screens. If it is one card on an existing screen, it belongs to that feature.

**2. Scaffold only the layers you need.**
```
src/features/pollen/
├── domain/
│   ├── entities/pollen-reading.ts
│   ├── repositories/pollen-repository.ts     # interface
│   └── use-cases/get-pollen-forecast.ts
├── data/
│   ├── dto/open-meteo-pollen-dto.ts          # + Zod schema
│   ├── mappers/pollen-mapper.ts
│   ├── datasources/remote-pollen-datasource.ts
│   └── repositories/pollen-repository-impl.ts
├── presentation/
│   ├── screens/pollen-screen.tsx
│   ├── components/pollen-card.tsx
│   └── hooks/use-pollen-forecast.ts
└── index.ts
```

**3. Build domain-first — and write its tests before any UI exists.** Entity → repository interface → use case. All pure, all testable immediately. *If you cannot test it without a mocking framework, the design is wrong.*

**4. Build data.** DTO + Zod schema → mapper (with fixture test) → data source → repository impl.

**5. Register in DI** (`core/di/`) — bind `PollenRepository` to `PollenRepositoryImpl`.

**6. Build presentation.** Query keys → hook → components → screen.

**7. Wire the route.** Add `app/pollen.tsx` re-exporting the screen.

**8. Define the public barrel.** Export only what others need.
```ts
// features/pollen/index.ts
export { PollenScreen } from './presentation/screens/pollen-screen';
export { usePollenForecast } from './presentation/hooks/use-pollen-forecast';
export type { PollenReading } from './domain/entities/pollen-reading';
```

**9. Finish it.** Translations (en + fa), theme tokens, skeleton, empty and error states, `staleTime` entry in §25, accessibility labels, **Persian RTL review**.

---

## 34. Guide: Creating a New Component

**1. Decide where it lives.** Used by 2+ features → `shared/ui/`. One feature → that feature's `presentation/components/`. When unsure, start local — promoting later is easy; un-sharing is not.

**2. Define props first.** Props are the contract; designing them first prevents the component from growing responsibilities.
```tsx
interface PollenCardProps {
  readonly reading: PollenReading;
  readonly onPress?: () => void;
}
```

**3. Keep it presentational.** Data arrives via props. If it needs to fetch, you are building a container — put the hook in the screen and pass results down.

**4. Consume the theme.** `const { colors, spacing } = useTheme();` — no literals.

**5. Handle every state**: content, loading (skeleton matching the real layout), empty, error.

**6. Make it accessible.** `accessibilityRole`, translated `accessibilityLabel`, and a touch target ≥ 44×44 pt.

**7. Verify all four combinations**: light/dark × English/Persian. Not two — four.

**8. Memoize if it renders in a list** or under an animated parent.

**9. Test behaviour** with RNTL — what a user sees and does, not internals.

**10. Export through the barrel** if it is shared.

---

## 35. Scalability Guidelines

**Scaling features**
- The feature slice is the unit of growth. Adding the 20th feature must be as easy as the 2nd — that only holds if barrels and boundaries are respected without exception.
- If two features constantly change together, they are one feature. Merge them.
- If a feature exceeds ~30 files, look for a sub-feature to extract.

**Scaling data sources**
- Adding a provider = one new data source + one new mapper. **Nothing else may change.** If adding a provider requires touching domain or presentation, the abstraction has leaked — fix it rather than working around it.
- Every provider maps into the *same* entities. Divergent entities per provider defeats the abstraction.

**Scaling the team**
- Feature isolation means parallel work without conflicts. Two engineers in different feature folders should never touch the same file.
- `core/` and `shared/` are high-traffic and change-sensitive: modifications there need broader review since they affect everyone.

**Scaling the codebase**
- Path aliases keep imports stable through moves.
- No file over ~300 lines; no function over ~50.
- Lazy-load route bundles so the app's startup cost does not grow linearly with feature count.

**Preparing for authentication** (not built yet, but designed for): the Axios interceptor chain, DI container, and secure storage are already the right seams. Auth slots in as a feature plus one interceptor — no architectural change.

---

## 36. Maintainability Guidelines

- **Optimize for the reader.** Most of this code's life is being read by someone with no context — possibly you in six months.
- **Consistency beats individual preference.** Match surrounding code even where you would write it differently.
- **Every dependency is a liability.** Before adding one: is it maintained, how large, could 30 lines replace it? Justify it in the PR.
- **Keep `CLAUDE.md` and code in sync — same PR, always.** A stale architecture doc is worse than none, because it is trusted.
- **Leave the campsite cleaner.** Small in-scope improvements are welcome; large refactors get their own PR.
- **Prefer deletion to deprecation** in an app with no external API consumers.
- **Name things for what they mean**, and rename the moment a name stops being true.
- **Pin dependency versions**; upgrade deliberately in dedicated PRs, never bundled with features.
- **Any workaround gets a comment** explaining what it works around and what would let it be removed.

---

## 37. Project Workflow

### Environment
- **Expo SDK 57 / React Native 0.86**, TypeScript strict.
- **Prebuild / CNG + dev client.** Expo Go **cannot** run this app — Mapbox, FCM, MMKV, Skia, and native widgets all require custom native code.
- `android/` and `ios/` are **generated and gitignored.** All native configuration is expressed as config plugins in `app.config.ts`. Editing generated native folders is forbidden — the change is lost on the next prebuild.
- Builds via **EAS**; secrets in **EAS Secrets**, never in git.

### Daily loop
```bash
npm start                # dev server (dev client)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint, incl. boundary + RTL rules
npm run format:check     # prettier
npm test                 # jest
npm run test:watch
```

> **Installing dependencies requires `npm install --legacy-peer-deps`.** See the
> pinned-version constraints below — several packages in the Expo SDK 57
> ecosystem have not yet widened their peer ranges.

### Pre-commit
Husky + lint-staged run ESLint and Prettier on staged files; Commitlint validates the message. **Never bypass with `--no-verify`** — if a hook fails, fix the cause.

### Branching
`main` is always releasable. Work happens on `<type>/<description>` branches, merged by PR with review. No direct pushes to `main`.

### CI gates — all required to merge
`typecheck` · `lint` (incl. architecture boundaries) · `test` · build

### ⚠️ Pinned versions — do not upgrade without reading this

Three versions are deliberately held back. Each was verified empirically during
Phase 0; upgrading any of them breaks the build.

| Package | Pinned | Why | Unblock when |
|---|---|---|---|
| **TypeScript** | `6.0.3` | `typescript-eslint` **hard-errors** on TS 7 — it does not merely warn. Since the entire architecture enforcement (§32, ADR-0007) runs through typescript-eslint, lint outranks having the newest compiler. | `typescript-eslint` ships TS 7 support ([issue #10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)) |
| **Jest** | `29.x` | `jest-expo@57` is built against Jest 29. With Jest 30, `jest-environment-node@29` creates a v29 `ModuleMocker` that `jest-runtime@30` cannot use — every suite fails with `clearMocksOnScope is not a function`. | `jest-expo` targets Jest 30 |
| **react-dom** | `19.2.3` | Must match `react` exactly. npm otherwise resolves the latest, which demands a newer React than Expo SDK 57 pins. | React version changes with the SDK |

`npm install` therefore requires `--legacy-peer-deps`. This is recorded in CI.

**New Architecture note:** Fabric/TurboModules is the *only* architecture in
SDK 57 / RN 0.86 — `newArchEnabled` no longer exists as a config option. Every
native dependency must be New Architecture compatible; there is no fallback.

### Adding a dependency
1. Justify it in the PR description
2. Check maintenance status and bundle size
3. Confirm New Architecture (Fabric/TurboModules) compatibility
4. If it needs native code, confirm a config plugin exists
5. Pin the exact version
6. Run `npx expo install --check` to confirm SDK alignment

---

*This document is the single source of truth. If code and this file disagree, one of them is a bug — fix it in the same PR.*
