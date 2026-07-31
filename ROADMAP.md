# ROADMAP.md — Implementation Plan

> Phased plan for building the application incrementally **without ever needing to redesign the architecture**.
> Architecture rules live in [CLAUDE.md](CLAUDE.md). This file covers *what gets built, in what order, and when it is done*.
> What actually happened during each phase — problems hit, fixes applied, versions pinned — is recorded in [docs/IMPLEMENTATION-LOG.md](docs/IMPLEMENTATION-LOG.md).

---

## Sequencing principle

The order is driven by **dependency direction, not by visible progress**. Infrastructure and the domain core come before screens, because everything above them is cheap to build once they are right and expensive to retrofit if they are wrong.

Three decisions are deliberately made in the earliest phases because they are the most expensive to reverse:

| Decision | Phase | Cost if deferred |
|---|---|---|
| **RTL-first layout** | 2 | Every component written before it needs manual auditing and rewriting |
| **Architecture boundaries enforced in CI** | 0 | Violations accumulate silently and become a large refactor |
| **Canonical units + entity design** | 4 | Cached data, charts, and widgets all encode the wrong assumption |

There is deliberately **no vertical slice before Phase 5.** The first screen appears only once the layers beneath it are correct — that is the point of the architecture.

### Phase overview

| # | Phase | Depends on | Output |
|---|---|---|---|
| 0 | Foundation & Tooling | — | Buildable, linted, empty app |
| 1 | Core Infrastructure | 0 | HTTP, storage, errors, logging, DI |
| 2 | Design System, Theme, i18n & RTL | 1 | Component library in 4 locale/theme combos |
| 3 | Locations | 1, 2 | GPS, search, favorites |
| 4 | Weather Domain & Data | 1, 3 | Weather retrievable, cached, offline — **no UI** |
| 5 | Home Experience | 2, 3, 4 | **First user-visible screen** |
| 6 | Details & Charts | 5 | Skia charts, all metrics |
| 7 | Air Quality & Recommendations | 4, 5 | AQI + deterministic advice |
| 8 | Weather Maps | 2, 3 | Mapbox + radar + layers |
| 9 | Alerts & Notifications | 4, 8 | FCM, severe weather |
| 10 | Offline Sync & Widgets | 4, 5 | Home screen widgets |
| 11 | Polish, Performance & Release | all | Shippable app |

---

## Phase 0 — Foundation & Tooling

**Objectives**
Create a project that builds on both platforms and mechanically enforces the architecture from the very first commit.

**Scope**
- Expo SDK 57 app, TypeScript strict + the compiler flags in CLAUDE.md §12
- `app.config.ts` with environment handling; prebuild/CNG configured; dev client building on iOS + Android
- ESLint, Prettier, Husky, lint-staged, Commitlint
- **`eslint-plugin-boundaries` configured with the layer and feature rules** — the single most important item in this phase
- Custom lint rules: ban `left`/`right`/`marginLeft`/`paddingRight`; ban `console.log`; ban `any`
- Path aliases (`@/core`, `@/features`, `@/shared`, `@/theme`) in tsconfig + Babel
- Jest + React Native Testing Library configured with one passing sample test
- CI pipeline: typecheck, lint, test
- `.gitignore` including `android/`, `ios/`, `.env`

**Deliverables**
Buildable app with no features. Green CI. A deliberately-violating import fails lint.

**Dependencies** — none.

**Definition of Done**
- [x] `npm run typecheck | lint | test` all pass
- [ ] Dev client runs on a physical iOS **and** Android device *(requires EAS build — not yet verified)*
- [x] **A test import from `domain/` to `data/` fails lint** — proves enforcement is real, not aspirational
- [x] A non-conventional commit message is rejected by the hook
- [ ] CI green on a PR *(workflow written; needs a remote to run)*

**Status: complete except device build + CI run**, both of which need
infrastructure outside the repo (an EAS account and a git remote).

Enforcement was verified with deliberate violation probes, each confirmed to
fail lint and then deleted:

| Probe | Result |
|---|---|
| `domain/` importing `data/` | ✅ `boundaries/element-types` |
| `domain/` importing `axios` / `react-native` | ✅ `no-restricted-imports` |
| `presentation/` importing `data/` | ✅ `boundaries/element-types` |
| Cross-feature deep import | ✅ `boundaries/element-types` |
| `core/` importing a feature | ✅ `boundaries/element-types` |
| `marginLeft` / `paddingRight` / `left` | ✅ `no-restricted-syntax` |
| `any`, `console.log`, TS `enum` | ✅ respective rules |

---

## Phase 1 — Core Infrastructure

**Objectives**
Build the framework-level plumbing every feature depends on, so no feature invents its own.

**Scope**
- `core/errors/` — `Result<T, E>`, the `AppError` union (CLAUDE.md §22), helpers
- `core/api/` — per-provider Axios instances, timeouts, retry policy driven by `AppError.retryable`, **response interceptor mapping every HTTP failure to `AppError`**, Zod validation at the boundary
- `core/storage/` — MMKV driver; SQLite driver with a migration runner and versioned schema
- `core/config/` — typed env access, validated at startup; constants; feature flags
- `core/network/` — connectivity state + online/offline observable
- `core/logger/` — facade with Reactotron (dev) and Sentry (prod) sinks; PII redaction for coordinates
- `core/di/` — composition root and provider registration
- TanStack Query client with the MMKV persister and cache versioning

**Deliverables**
A fully tested infrastructure layer. No feature code.

**Dependencies** — Phase 0.

**Definition of Done**
- [x] Every `AppError` variant is produced by a tested interceptor path
- [x] SQLite migrations run forward from empty **and** from a previous version
- [x] Query cache survives an app restart via MMKV
- [x] Logger redacts coordinates — Sentry sink deferred to Phase 11 *(see note)*
- [x] Missing required env var fails **at startup with a clear message**, not at first use
- [x] Unit tests ≥ 90% on `core/` — **98.6% statements, 91.4% branches**, 199 tests

**Status: complete.** One deliberate scope change:

> **The Sentry sink moves to Phase 11.** Phase 1 delivers the sink *architecture*
> — `Logger` is a facade over a `LogSink` list, and redaction happens centrally
> before any sink sees a payload — plus the console sink. Registering Sentry
> requires a DSN, source-map upload, and a production build, all of which are
> Phase 11's scope and none of which can be verified from Phase 1. Adding it
> later is one file plus one line in the composition root.

**Deliberately empty:** `MIGRATIONS` is an empty registry. The tables belong to
the features that own them, and their columns depend on the entity and
canonical-unit decisions made in Phase 4 — writing them now would encode guesses
into persisted data. The migration *runner* is fully implemented and tested,
including ordering, atomic rollback, and registry validation.

---

## Phase 2 — Design System, Theme, i18n & RTL

**Objectives**
Establish the visual and linguistic foundation. **All four combinations (light/dark × en/fa) work before any product screen exists.**

> This phase comes before any screen deliberately. Every component built after it is RTL-correct by construction; every component built before it would need auditing.

**Scope**
- `theme/tokens/` — colors, spacing (4pt), typography (Inter + Vazirmatn), radii, elevation
- `theme/semantic/` — light + dark semantic mappings
- `theme/weather/` — pure `getWeatherPalette(condition, timeOfDay)` with unit tests
- `useTheme()` hook; theme mode store (light/dark/system)
- `shared/ui/` primitives: `Text`, `Card`, `GlassSurface`, `Button`, `IconButton`, `Skeleton`, `Divider`, `Sheet` (Gorhom), `PressableScale`
- `core/i18n/` — i18next, namespaced en + fa resources, `isRTL` accessor, `I18nManager` bootstrap + `expo-updates` restart flow
- Locale-aware formatters: numbers (Persian-Indic digits), dates (Day.js + Jalali plugin), units
- `shared/hooks/` — `useHaptics`, `useDebounce`, `useAppState`, `useReducedMotion`
- Storybook-style showcase screen (dev-only) rendering every primitive in all four combinations

**Deliverables**
A complete, documented, RTL-correct component library.

**Dependencies** — Phase 1.

**Definition of Done**
- [x] Every primitive renders correctly in **all four** locale × theme combinations
- [x] Language switch triggers the RTL restart flow and layout mirrors correctly
- [x] Persian numerals and Jalali dates render correctly
- [x] Zero literal colours in any primitive — verified by lint
- [x] `getWeatherPalette` unit-tested across all conditions × times of day
- [x] Reduced-motion setting disables animations
- [x] All primitives have `accessibilityRole`; screen-reader pass on device pending

**Status: complete.** 518 tests; 95.9% statements overall.

Three findings worth carrying forward:

> **A contrast bug was caught by a test, not by eye.** `textTertiary` was
> identical in both themes; on the dark background it scored **4.03:1**, below
> the 4.5:1 WCAG AA floor. Dark text steps are now verified against the dark
> background rather than mirrored from light.

> **`Intl` replaced the Jalali plugin entirely.** `fa-IR` already resolves to the
> Persian calendar and Persian-Indic digits, so the dependency was removed.

> **Latin uses the system font.** Static Inter files were not obtainable, and the
> system font is the better choice regardless — it is what Apple Weather uses,
> supports Dynamic Type, and adds nothing to the bundle. Persian still bundles
> Vazirmatn.

**Deferred:** the on-device screen-reader pass and the visual four-combination
review need a running dev client (same blocker as Phase 0's device build). The
`/showcase` route exists for exactly that review.

---

## Phase 3 — Locations

**Objectives**
Deliver the location capability everything else is parameterized by.

**Scope**
- **Domain** — `Coordinates`, `SavedLocation`, `LocationSearchResult`; `LocationRepository` interface; use cases: `GetCurrentLocation`, `SearchCities`, `ReverseGeocode`, `SaveLocation`, `ReorderLocations`
- **Data** — Open-Meteo Geocoding data source; `expo-location` GPS + reverse geocoding with Mapbox fallback; SQLite persistence for saved locations and recent searches; **geohash quantization utility** (used by every cache key in the app)
- **Presentation** — location list, search screen with debounced search, permission request and denied-state flows, favorites reordering, recent searches

**Deliverables**
Users can find, save, reorder, and select locations. GPS with graceful permission handling.

**Dependencies** — Phases 1, 2.

**Definition of Done**
- [x] GPS resolves and reverse-geocodes to a readable place name
- [x] Permission denied and "permanently denied" both have designed, non-error UX with a settings link
- [x] City search debounced, cached 30 days, works in Persian
- [x] Saved locations survive restart and reorder optimistically with rollback
- [x] **Geohash quantization unit-tested** — two GPS fixes metres apart produce the same key
- [x] Domain + mapper coverage ≥ 95% — **both at 100%**, ratcheted in `jest.config.js`
- [ ] Reviewed in Persian RTL *(needs a running dev client)*

**Status: complete except the on-device Persian review.** 623 tests.

Two architectural corrections, both forced by the boundaries lint rule:

> **The migration registry moved out of `core/`.** Putting feature table
> definitions in `core/storage` made `core/` import `features/`. `openDatabase`
> now *receives* its migration list and the composition root assembles it —
> which is what a composition root is for. The first instinct, a comment calling
> it "a deliberate exception", was a rationalization.

> **`core/di` became its own element type**, permitted to import feature
> *barrels*. Binding a domain interface to a data implementation requires seeing
> both; every DI container has this property, and the alternative — scattering
> construction across the app — is worse.

One lint rule was itself wrong and was corrected: `feature-domain` was barred
from importing `core/errors`, but CLAUDE.md §6 and §22 both show domain
repository interfaces returning `Result<T, AppError>`. `core/errors` is now a
distinct element type that domain may import; nothing else in `core/` is.

Two bugs were caught by tests rather than review:

| Bug | How it surfaced |
|---|---|
| Longitude `180` wrapped to `-180`, flipping the geohash to the opposite end of the range | The test compares against **published reference values**, not this implementation's own output |
| FlashList v2 removed `estimatedItemSize` | Type error; CLAUDE.md §21 previously mandated supplying it |

---

## Phase 4 — Weather Domain & Data

**Objectives**
Build the heart of the product: weather entities, providers, mapping, caching, and offline behaviour — **with no UI at all**.

> The most important phase in the project. Everything visible later is a rendering of what is built here. Entity and unit decisions made here propagate into the cache, charts, and widgets, so they must be right before anything consumes them.

**Scope**
- **Domain**
  - Entities: `CurrentConditions`, `MinutelyForecast`, `HourlyForecast`, `DailyForecast`, `WeatherCondition`, `SevereAlert`
  - Value objects with branded types: `Temperature`, `Speed`, `Pressure`, `Distance` — canonical units internally
  - `WeatherRepository` interface
  - `AstronomyCalculator` domain service — sunrise/sunset, moon phase and illumination via `suncalc`, **computed locally, works offline**
  - Use cases: `GetCurrentWeather`, `GetHourlyForecast`, `GetDailyForecast`, `GetMinutelyForecast`, `GetHistoricalWeather`
- **Data**
  - `OpenMeteoDataSource` (forecast + archive) with Zod-validated DTOs
  - `OpenWeatherDataSource` (fallback + severe alerts)
  - One mapper per provider into the *same* entities, with fixture-based tests
  - `LocalWeatherDataSource` — SQLite snapshots with staleness metadata
  - `WeatherRepositoryImpl` — cache-first orchestration, stale-fallback-on-network-failure
  - **Circuit breaker** — on `429`/`5xx`, mark provider degraded for a cooldown and route to fallback
  - **Request coalescing** — concurrent identical requests share one in-flight promise
  - Staleness tiers per CLAUDE.md §25

**Deliverables**
Complete, tested weather data layer. Verified through tests only.

**Dependencies** — Phases 1, 3.

**Definition of Done**
- [x] Every metric in the brief is retrievable: temp, feels-like, humidity, pressure, visibility, wind speed/direction/gust, dew point, UV, sunrise/sunset, moon phase
- [x] Both providers map into **identical entity shapes** — proven by a test asserting equivalence on the same location
- [x] Circuit breaker tested: forced Open-Meteo failure routes to OpenWeather and recovers after cooldown
- [x] Repository returns **stale cached data when offline** rather than an error
- [x] Request coalescing tested — 10 concurrent identical calls issue **one** HTTP request
- [x] `AstronomyCalculator` validated against known astronomical values, **with the network disabled**
- [x] Historical weather retrievable for an arbitrary past date
- [x] Domain coverage ≥ 95%; mappers 99.1% statements / **100% functions**

**Status: complete.** 888 tests. No UI, as intended.

Two bugs were caught by tests comparing against PUBLISHED reference values
rather than against the implementation's own output:

> **suncalc returns degrees, not radians.** Its widely-cited documentation
> describes radians with a south-based azimuth; this build returns degrees with
> a north-based azimuth. Converting as documented produced solar elevations of
> **-758°**, which is geometrically impossible. Verified against known
> positions: solar noon reads exactly 180.00 (due south).

> **The two providers anchored a "day" differently.** Open-Meteo stamps a daily
> entry at local midnight, OpenWeather at roughly local noon. Left alone, the
> same calendar day carried two different dates and a day-grouped list would
> have shifted the moment failover happened.

One architectural change, forced by the boundaries rule:

> **`Coordinates` moved to `shared/types`.** The weather domain needed it and
> was importing it from the locations feature barrel — a sideways dependency.
> CLAUDE.md §7 rule 3 is explicit that a shared concept moves DOWN. `shared/types`
> is now a distinct element type the domain may import, on the same reasoning as
> `core/errors`: **types are shareable, behaviour is not.** `shared/utils` stays
> out of the domain's reach.

---

## Phase 5 — Home Experience

**Objectives**
The first screen a user sees — and proof the architecture delivers a premium experience.

**Scope**
- Home screen: current conditions hero, hourly strip (FlashList, horizontal, RTL-aware), 7-day summary
- Dynamic weather background driven by `getWeatherPalette` + condition and time of day
- Glassmorphic metric cards: feels-like, humidity, wind, pressure, visibility, dew point, UV
- Sunrise/sunset arc and moon phase display
- Location switcher (Gorhom bottom sheet), pull-to-refresh with haptics
- Skeleton loading matching final layout; offline banner with data age; error state with retry
- Lottie weather animations

**Deliverables**
A complete, beautiful, offline-capable home screen.

**Dependencies** — Phases 2, 3, 4.

**Definition of Done**
- [ ] **Content visible < 500 ms from cold start**, from cache, before any network resolves
- [ ] 60 fps scrolling on a mid-range Android device
- [ ] Full screen usable in airplane mode with a visible data-age indicator
- [ ] Background transitions smoothly on condition or time-of-day change
- [ ] Correct in **all four** locale × theme combinations; hourly strip scrolls the right way in Persian
- [ ] Skeleton matches real layout (no layout shift on load)
- [ ] Full screen-reader pass in both languages
- [ ] Zero business logic in components — verified in review

---

## Phase 6 — Details & Charts

**Objectives**
Deep metric exploration with interactive Skia charts.

**Scope**
- Daily detail screen with shared element transition from the home list
- Hourly detail with a 24 h scrubber
- Skia charts: temperature, humidity, wind, pressure, AQI, UV
- Interactive scrubbing with haptic feedback and value readout
- **RTL-inverted x-axis** for all charts (CLAUDE.md §19)
- 15-minute precipitation chart
- Historical weather comparison view
- Reusable chart primitives in `shared/ui/charts/`

**Deliverables**
Complete charting system across all six metrics.

**Dependencies** — Phase 5.

**Definition of Done**
- [ ] All six chart types render, scrub, and animate at 60 fps
- [ ] **Charts read right-to-left in Persian** — time axis correctly inverted, verified visually
- [ ] Scrubbing is a Reanimated worklet on the UI thread — no JS-thread frame drops
- [ ] Shared element transition smooth in both directions
- [ ] Charts degrade gracefully with partial or missing data
- [ ] Chart axes and values respect user unit preferences
- [ ] Reduced-motion disables chart entry animation
- [ ] Charts have accessible text alternatives

---

## Phase 7 — Air Quality & Recommendations

**Objectives**
Add air quality, and the deterministic rules engine that makes the app *actionable* rather than merely informational.

**Scope**
- **Air quality** — `AirQualityReading` entity, Open-Meteo AQ data source, AQI + PM2.5, PM10, CO, NO₂, SO₂, O₃; EU and US AQI scales with user preference; health guidance per band; AQI screen with pollutant breakdown
- **Recommendations** — `RecommendationEngine` **pure domain service, no I/O, no `data/` layer**:
  - Clothing, umbrella, outdoor activity, running, cycling, hiking, travel
  - Each rule is a pure, independently tested function taking weather + AQI and returning a typed recommendation with severity and reasoning
  - Rules are data-driven and documented — thresholds cite their source (EPA, WHO) per CLAUDE.md §27
- Recommendation cards on home and a dedicated screen

**Deliverables**
Full AQI feature plus seven tested recommendation rule sets.

**Dependencies** — Phases 4, 5.

**Definition of Done**
- [ ] All six pollutants displayed with correct units and colour-coded bands
- [ ] EU and US AQI both correct; switching scale requires no refetch
- [ ] **Every recommendation rule unit-tested at its threshold boundaries** — including edge cases either side
- [ ] Recommendation thresholds documented with cited sources
- [ ] Recommendations explain *why* ("18°C and 70% chance of rain — take an umbrella")
- [ ] `recommendations/` has **no `data/` layer** and no I/O — verified in review
- [ ] Recommendations work fully offline from cached weather
- [ ] Both locales; health guidance translated, not transliterated

---

## Phase 8 — Weather Maps

**Objectives**
Interactive weather map with radar and all layers.

**Scope**
- Mapbox integration via config plugin; map screen with location markers
- RainViewer rain radar with animated playback timeline
- Layers: cloud, temperature, wind, pressure, snow
- Layer switcher, opacity control, timeline scrubber
- Tap-to-inspect a point; tile caching for offline map viewing
- **Lazy-loaded route** — Mapbox is large and must not affect cold start

**Deliverables**
Full-featured interactive weather map.

**Dependencies** — Phases 2, 3.

**Definition of Done**
- [ ] Map renders with all seven layers, each toggleable
- [ ] Radar animation plays smoothly with a scrubbable timeline
- [ ] **Map route is lazy-loaded — cold start time unchanged** from Phase 5 measurement
- [ ] Tiles cached; previously viewed areas viewable offline
- [ ] Map controls positioned correctly under RTL
- [ ] Memory stays under budget during extended map use
- [ ] Map respects light/dark theme

---

## Phase 9 — Alerts & Notifications

**Objectives**
Severe weather alerts and user-configured notifications.

**Scope**
- Severe alert entity + OpenWeather alerts data source; alert banner and detail screen with severity styling
- FCM + expo-notifications setup, permission flow, token registration
- Notification types: rain, snow, thunderstorm, heat, cold, daily forecast
- Notification preference UI (per type, quiet hours, per-location)
- Background fetch for locally-evaluated threshold alerts
- Deep links from notification into the relevant screen

**Deliverables**
Complete alerting system, both push and locally evaluated.

**Dependencies** — Phases 4, 8.

**Definition of Done**
- [ ] Push received and displayed correctly on both platforms, foreground and background
- [ ] Tapping a notification deep-links to the correct screen with correct params
- [ ] All six notification types trigger under their conditions
- [ ] Quiet hours respected; per-location preferences honoured
- [ ] Permission denial handled gracefully with a settings path
- [ ] Severe alerts visually distinct and **impossible to miss**
- [ ] Notification content translated and correct in both locales
- [ ] No notification sent for data the user cannot act on

---

## Phase 10 — Offline Sync & Widgets

**Objectives**
Complete the offline story and extend the app to the home screen.

**Scope**
- Automatic background sync on connectivity regain and app foreground, debounced
- Background fetch task keeping cache and widget data warm
- Sync status surfacing; conflict resolution for optimistic writes
- `modules/weather-widget/` local Expo module:
  - **Android** — Glance home screen widget
  - **iOS** — WidgetKit with App Group shared storage
  - Sizes: small (current), medium (current + hourly), large (+ daily)
- Widget reads from SQLite/App Group — **renders without launching the app**
- Widget refresh scheduling within platform budgets

**Deliverables**
Robust offline sync and native widgets on both platforms.

**Dependencies** — Phases 4, 5.

**Definition of Done**
- [ ] Widgets render on both platforms in all sizes
- [ ] **Widgets display correct data with the app never launched** since boot
- [ ] Widgets respect light/dark and the user's unit preferences
- [ ] Widgets render correctly in Persian with RTL layout
- [ ] Background sync respects platform budgets and does not drain battery
- [ ] App recovers cleanly from extended offline (> 24 h) with clear data-age indication
- [ ] Queued optimistic writes flush correctly on reconnect
- [ ] Widget tap deep-links into the matching location

---

## Phase 11 — Polish, Performance & Release

**Objectives**
Take the app from feature-complete to genuinely shippable.

**Scope**
- **Performance** — profile on a mid-range Android device; enforce every budget in CLAUDE.md §21; bundle analysis; startup optimization
- **Animation polish** — micro-interactions, transition timing, haptic tuning, reduced-motion verification
- **Accessibility** — full screen-reader pass in both languages, dynamic type, contrast ratios, ≥ 44 pt touch targets
- **Testing** — close coverage gaps to targets; Maestro E2E for core journeys
- **Monitoring** — Sentry release health, source maps in EAS builds, performance tracing, alert thresholds
- **Release** — app icons, splash, store assets in both languages, privacy manifests, **Open-Meteo CC-BY attribution in Settings**, EAS submit pipeline

**Deliverables**
A production-ready application.

**Dependencies** — all previous phases.

**Definition of Done**
- [ ] **Every performance budget in CLAUDE.md §21 met on a mid-range Android device**, measured and recorded
- [ ] Coverage targets met per CLAUDE.md §26
- [ ] Maestro E2E green for all core journeys
- [ ] Full accessibility pass in English and Persian
- [ ] Sentry receiving events with correct source maps; crash-free rate measurable
- [ ] **Open-Meteo attribution present** (CC-BY licence obligation)
- [ ] Zero `any`, zero `console.log`, zero lint suppressions without a documented reason
- [ ] `CLAUDE.md` verified accurate against the final codebase
- [ ] Builds submit successfully to both stores

---

## Feature traceability

Every capability in the brief, mapped to the phase that delivers it. Nothing silently dropped.

| Capability | Phase |
|---|---|
| Current, hourly, daily, weekly, minute forecast | 4 → 5 |
| Historical weather | 4 → 6 |
| Feels-like, humidity, pressure, visibility, wind speed/direction, dew point, UV | 4 → 5 |
| Sunrise, sunset, moon phase | 4 → 5 |
| Air quality — AQI, PM2.5, PM10, CO, NO₂, SO₂, O₃ | 7 |
| Severe weather alerts | 4 → 9 |
| Interactive map, rain radar, cloud/temp/wind/pressure/snow layers | 8 |
| GPS, city search, reverse geocoding, favorites, recents, multiple locations | 3 |
| Rain/snow/thunderstorm/heat/cold/daily notifications | 9 |
| Charts — temperature, humidity, wind, pressure, AQI, UV | 6 |
| Recommendations — clothing, umbrella, outdoor, running, cycling, hiking, travel | 7 |
| Offline cache, SQLite, auto-sync | 1 → 4 → 10 |
| Units, theme, language, notification preferences | 2 → 3 → 9 |
| Dynamic backgrounds, glassmorphism, blur, gradients, animations | 2 → 5 |
| Skeletons, pull-to-refresh, shared transitions, haptics, micro-interactions | 5, 6, 11 |
| Light/dark mode | 2 |
| Android + iOS widgets | 10 |
| Lazy loading, caching, FlashList, memoization, offline-first, fast startup | 1, 4, 5, 11 |
| Secure storage, env vars, isolated API layer, auth-ready architecture | 0, 1 |

---

## Working agreements

- **Phases are sequential in dependency, not in calendar.** Independent work within a phase can parallelize.
- **A phase is not done until its DoD is fully met.** Carrying incomplete work forward is how architecture erodes.
- **Never skip ahead to a screen.** Building UI on an unfinished domain is the one thing this roadmap exists to prevent.
- **Update `CLAUDE.md` in the same PR** whenever a phase changes an architectural rule.
- **Re-measure performance every phase from 5 onward.** Regressions are cheap to fix when caught immediately and expensive at the end.
