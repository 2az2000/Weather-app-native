# Implementation Log

> **What actually happened, phase by phase.**
>
> 🌐 نسخهٔ فارسی: [IMPLEMENTATION-LOG.fa.md](IMPLEMENTATION-LOG.fa.md)
>
> [CLAUDE.md](../CLAUDE.md) says how the code *should* be written. [ROADMAP.md](../ROADMAP.md) says what gets built and in what order. **This file records what was built, what broke, and why each decision went the way it did.**
>
> It exists because the most expensive knowledge on a project is the kind that gets rediscovered: a version that cannot be upgraded, a lint rule that silently does nothing, a test that passes for the wrong reason. Each of those below cost real time to find. None of them should cost that time twice.

---

## How to maintain this file

- **Append a section per phase**, using the template at the bottom.
- **Record every problem that cost more than a few minutes**, even if the fix was one line. The fix is rarely the valuable part — the *symptom* and the *diagnosis* are, because that is what a future reader will search for.
- **Record deliberate scope changes with their reasoning**, so "why isn't X done yet?" has an answer.
- **Write it as the phase happens**, not afterwards. Reconstructed logs lose exactly the detail that makes them useful.
- **Update both language versions together**, so they cannot drift apart.

---

## Project status

| | |
|---|---|
| **Phases complete** | 0 (Foundation), 1 (Core), 2 (Design System & RTL), 3 (Locations), 4 (Weather Domain & Data), 5 (Home Experience) |
| **Next phase** | 6 — Details & Charts |
| **Source files** | 136 (excluding tests) |
| **Test files** | 51 · 950 tests |
| **Coverage** | `core/` 98.6% · weather mappers 100% functions · locations domain 100% |
| **CI gates** | typecheck · lint · format · test — all green locally |

### Commits

```
9eec05c  feat(core): build the infrastructure layer every feature depends on
65c3cad  build(deps): align eslint-config-expo with the SDK version line
0030fec  docs(core): align docs with the toolchain Phase 0 actually produced
2ad7185  build(core): scaffold Expo SDK 57 foundation with enforced architecture
```

---

## ⚠️ Toolchain constraints — read before upgrading anything

Four versions are **deliberately held back**. Each was discovered empirically by something breaking. Upgrading any of them without addressing the cause will break the build again.

| Package | Pinned | What breaks if upgraded | Unblock when |
|---|---|---|---|
| **typescript** | `6.0.3` | `typescript-eslint` **hard-errors** on TS 7 — it refuses to load, taking the entire lint run with it. Since all architecture enforcement (ADR-0007) runs through typescript-eslint, lint outranks having the newest compiler. | [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) ships TS 7 support |
| **jest** | `29.x` | `jest-expo@57` depends on Jest 29 internals. Under Jest 30, `jest-environment-node@29` creates a v29 `ModuleMocker` that `jest-runtime@30` cannot drive — **every suite** fails with `clearMocksOnScope is not a function`. | `jest-expo` targets Jest 30 |
| **react-dom** | `19.2.3` | Must match `react` exactly. npm otherwise resolves the newest react-dom, which demands a React newer than Expo SDK 57 pins, and the install aborts. | React version changes with the SDK |
| **eslint-config-expo** | `~57.0.0` | Versioned in lockstep with the SDK, not independently. The `10.x` line looks newer but is unrelated; `expo install --check` reports drift. | Follows the SDK |

**`npm install` requires `--legacy-peer-deps`** as a consequence. This is encoded in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### Platform facts worth knowing

- **The New Architecture is the only architecture** in SDK 57 / RN 0.86. `newArchEnabled` no longer exists as a config option — it is not a default, it is the only path. Every native dependency must be Fabric/TurboModule compatible; there is no fallback.
- **TypeScript 7 removed `baseUrl`.** Path aliases must be relative with an explicit `./` prefix. (Recorded here even though TS is pinned to 6 — it will matter on upgrade.)
- **TypeScript 7 no longer auto-includes `node_modules/@types`.** Ambient globals need an explicit `types` array.

---

## Phase 0 — Foundation & Tooling

**Commits:** `2ad7185`, `0030fec`, `65c3cad`
**Objective:** a buildable app that mechanically enforces the architecture from the first commit.

### Delivered

| Area | What |
|---|---|
| Runtime | Expo SDK **57.0.8** / React Native **0.86.0** / React **19.2.3**, prebuild + CNG (ADR-0001) |
| TypeScript | `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `verbatimModuleSyntax` |
| Architecture enforcement | `eslint-plugin-boundaries` encoding the dependency rule; domain-purity import bans; relative-escape ban |
| RTL enforcement | Physical layout properties banned by AST selector (ADR-0006) |
| Code quality | `no-explicit-any`, `no-console`, no TS `enum`, no bare `catch {}`, `@ts-ignore` banned |
| Formatting & hooks | Prettier, Husky, lint-staged, Commitlint with feature/layer scope enum |
| Testing | Jest 29 + jest-expo + React Native Testing Library, path aliases wired through tsc **and** babel **and** jest |
| CI | GitHub Actions: typecheck · lint · format · test |
| Config | `app.config.ts`, `.env.example`, `.gitignore` (native folders excluded per ADR-0001) |

### Problems encountered

#### 1. `corepack enable pnpm` failed with EPERM
**Symptom:** `EPERM: operation not permitted, open 'C:\...\nvm\v22.14.0\pnpx'`
**Cause:** corepack writes shims into the Node installation directory, which needs elevation under nvm-windows.
**Resolution:** switched to **npm**, and updated CLAUDE.md and ROADMAP.md to match.
**Why not force it:** a global toolchain install is a change to the developer's machine, not to the project. npm was already present and sufficient.

#### 2. `prepare: husky` ran before husky was installed
**Symptom:** `'husky' is not recognized` aborting every `npm install`.
**Cause:** npm runs `prepare` on install; the script existed before its dependency did.
**Resolution:** removed the script, installed, ran `husky init`, restored the script.

#### 3. react-dom version conflict aborted the install
**Symptom:** `ERESOLVE` — `react-dom@19.2.8` required `react@19.2.8`, root had `19.2.3`.
**Cause:** expo-router declares react-dom as an optional peer; npm resolved the newest available rather than the SDK-aligned one.
**Resolution:** pinned `react-dom@19.2.3` exactly.

#### 4. 🔴 typescript-eslint refuses to run on TypeScript 7
**Symptom:** lint aborted entirely — `typescript-eslint does not support TS 7.0`.
**Cause:** `expo install` selected TypeScript 7.0.2 (SDK-aligned). typescript-eslint's peer range stops at `<6.1.0`, and unlike most peer mismatches this is a **hard runtime error, not a warning**.
**Why this mattered:** `--legacy-peer-deps` had suppressed the install-time warning, so the incompatibility only surfaced when lint was actually executed. **A peer warning silenced is a problem deferred, not avoided.**
**Resolution:** pinned **TypeScript 6.0.3**.
**Reasoning:** the entire point of Phase 0 is mechanical architecture enforcement, and that runs through typescript-eslint. A newer compiler is worth less than working enforcement.

#### 5. TypeScript 7 removed `baseUrl`
**Symptom:** `TS5102: Option 'baseUrl' has been removed` plus `TS5090: Non-relative paths are not allowed`.
**Resolution:** rewrote `paths` as relative (`./src/core/*`). Kept after the TS 6 downgrade since the form is valid in both.

#### 6. TypeScript 7 stopped auto-including `@types`
**Symptom:** `Cannot find name 'describe'` despite `@types/jest` being installed.
**Resolution:** explicit `"types": ["jest", "node"]` in tsconfig.

#### 7. Removed Expo config options
**Symptom:** `'edgeToEdgeEnabled' does not exist in type 'Android'`, then `'newArchEnabled' does not exist in type 'ExpoConfig'`.
**Cause:** both were removed in SDK 57 — edge-to-edge is now standard, and the New Architecture is the only architecture.
**Resolution:** deleted both, and documented the New Architecture consequence for future native dependencies.

#### 8. jest-expo's React Native preset moved packages
**Symptom:** `The React Native Jest preset that jest-expo relies on has moved to a separate package.`
**Resolution:** installed `@react-native/jest-preset@0.86.0`.

#### 9. 🔴 Jest 30 is incompatible with jest-expo 57
**Symptom:** every suite failed to run — `TypeError: this._moduleMocker.clearMocksOnScope is not a function`.
**Diagnosis:** inspecting the installed tree showed `jest-runtime@30.4.2` alongside `jest-environment-node@29.7.0`. jest-expo's dependencies are all `^29.2.1`, so the hoisted environment was v29 while the runtime was v30, and the ModuleMocker API differs between them.
**Resolution:** downgraded to **Jest 29**.
**Lesson:** when every suite fails identically, suspect **version skew inside the test framework** before suspecting the tests.

#### 10. 🔴 The RTL lint rule was silently doing nothing
**Symptom:** a deliberate violation probe containing `{ marginLeft: 8, paddingRight: 4, left: 0 }` produced **no lint error**, while `any` and `console.log` in the same file were caught.
**Cause:** the rule was written with `no-restricted-properties`, which matches **member access** (`styles.marginLeft`) — not **object literal keys**, which is how every style in React Native is actually written.
**Resolution:** rewrote using `no-restricted-syntax` with AST selectors, covering both bare and quoted keys:
```js
`Property[key.name="${physical}"]`
`Property[key.value="${physical}"]`   // catches { 'marginRight': 2 }
```
**Why this is the most important entry in this log:** ADR-0006's entire argument is that a lint rule cannot be violated the way a convention can. A rule that never fires provides *negative* value — it creates confidence that is not earned. **This was only found because enforcement was tested with a deliberate violation rather than assumed to work.**

#### 11. 🔴 Flat config replaces rule options, it does not merge them
**Symptom:** caught by reading, not by failure — two config blocks both set `no-restricted-imports`, one for relative-escape bans across `src/**`, one for domain purity in `src/features/*/domain/**`.
**Cause:** in ESLint flat config, a later block that configures the same rule **replaces** the earlier options entirely. Since domain files also match `src/**`, the general block would have nullified the domain-purity rule.
**Resolution:** ordered the general block first, and **restated** the shared pattern inside the domain block. Same treatment applied to `no-restricted-syntax`, which had the identical hazard between the TS-enum ban and the RTL rules.
**Note:** this class of bug is invisible in review and produces no error — the rule simply stops applying. Both sites now carry a comment explaining why the duplication is deliberate.

#### 12. PowerShell here-string syntax in the Bash tool
**Symptom:** commitlint rejected a correctly-formed message with `type may not be empty`.
**Cause:** `@'...'@` is PowerShell syntax; in Bash it produced a leading empty line, so commitlint read an empty header.
**Resolution:** used `git commit -F <file>` with a heredoc.

### Verification — enforcement proven, not assumed

Every architecture rule was tested with a deliberate violation, confirmed to fail lint, then deleted. This is the Phase 0 Definition of Done item that matters most.

| Probe | Rule that fired |
|---|---|
| `domain/` importing `data/` | `boundaries/element-types` |
| `domain/` importing `axios` / `react-native` | `no-restricted-imports` |
| `presentation/` importing `data/` | `boundaries/element-types` |
| Cross-feature deep import | `boundaries/element-types` |
| `core/` importing a feature | `boundaries/element-types` |
| `marginLeft` / `paddingRight` / `left` | `no-restricted-syntax` |
| `any`, `console.log`, TS `enum` | respective rules |
| Non-conventional commit message | commitlint `commit-msg` hook |

> **A subtlety worth recording:** the first `domain/ → data/` probe reported only `import/no-unresolved`, because the target file did not exist. The boundaries rule had not actually been exercised. Creating a *real* file at the target path was required to prove it fires. **A probe that fails for the wrong reason proves nothing.**

### Open items

| Item | Blocker |
|---|---|
| Dev client on physical iOS + Android | Requires an EAS build |
| CI green on a PR | Workflow written; needs a git remote |

---

## Phase 1 — Core Infrastructure

**Commit:** `9eec05c`
**Objective:** the framework plumbing every feature depends on, so no feature invents its own.

### Delivered

| Module | Contents |
|---|---|
| `core/errors/` | `Result<T, E>` (hand-rolled, ~130 lines — CLAUDE.md §36 asks whether a library is needed before adding one), the 9-variant `AppError` union with constructors that keep `retryable` correct by construction, `errorMessageKey`, `describeError` |
| `core/api/` | Per-provider HTTP clients, `toAppError` boundary mapper, Zod `validateResponse`, retry driven by the `retryable` **flag** rather than re-derived from error shapes, full-jitter exponential backoff honouring `Retry-After` |
| `core/storage/` | MMKV adapter (synchronous tier), SQLite driver with WAL + foreign keys, versioned migration runner with per-migration transactions and registry validation |
| `core/logger/` | Sink facade, central PII redaction, console sink |
| `core/config/` | Env validated at startup, staleness tiers from CLAUDE.md §25, feature flags |
| `core/network/` | Connectivity monitor with an optimistic initial state |
| `core/query/` | TanStack client, MMKV persister, cache-version buster |
| `core/di/` | Composition root + React provider + `useContainer` |

**Provider clients wired** (note how few need a credential — ADR-0002): Open-Meteo forecast / archive / air-quality / geocoding (no key), OpenWeather (key), RainViewer (no key).

### Problems encountered

#### 1. `exactOptionalPropertyTypes` rejected several idiomatic patterns
This flag distinguishes "property absent" from "property present and `undefined`". Three separate failures:

| Site | Fix |
|---|---|
| Axios config with possibly-undefined `headers` / `params` | Conditional spread: `...(x === undefined ? {} : { headers: x })` |
| Zod `.partial()` output assigned to `Partial<Env>` | Explicit `type PartialEnv = { [K in keyof Env]?: Env[K] \| undefined }` |
| `error.response = undefined` in a test | Simply omitted the assignment — an `AxiosError` with no response *is* the network-failure case |

**Verdict:** the flag paid for itself immediately. Each rejection was a real distinction being flattened.

#### 2. `Err<T, E>` is not assignable across different `T`
**Symptom:** `Type 'Err<SQLiteDatabase, AppError>' is not assignable to type 'Err<Database, AppError>'`.
**Cause:** `Err` carries no `T` value, but `T` appears in `map`'s **parameter** position, which makes the type contravariant in `T`. Structural compatibility does not apply.
**Resolution:** re-wrap when crossing result types — `return err(opened.error)` rather than `return opened`. Commented at both sites.

#### 3. expo-sqlite discards the transaction callback's return value
**Symptom:** `withTransactionAsync` types its callback as `() => Promise<void>`, incompatible with a generic `withTransaction<T>`.
**Resolution:** a `runInTransaction` helper that boxes the captured value in a tuple:
```ts
let captured: readonly [T] | undefined;
await db.withTransactionAsync(async () => { captured = [await fn()]; });
if (captured === undefined) throw new Error('Transaction callback did not run');
return captured[0];
```
**Why the tuple:** it keeps "ran and returned `undefined`" distinguishable from "never ran", without a non-null assertion (banned by CLAUDE.md §12). Both cases are covered by tests.

#### 4. react-native-mmkv v4 changed its API
**Symptom:** `'MMKV' only refers to a type, but is being used as a value`.
**Cause:** v4 replaced the `new MMKV()` constructor with a `createMMKV()` factory, and renamed `delete` to `remove`.
**Resolution:** both differences are absorbed in the adapter, so no caller sees them.

#### 5. MMKV v4 cannot load in Jest
**Symptom:** `Cannot find module 'react-native-nitro-modules'`, then after installing that peer, a further native-binding failure.
**Cause:** MMKV v4 is backed by Nitro Modules — a native binary with no Node fallback.
**Resolution:** `__mocks__/react-native-mmkv.js`.
**The distinction that matters:** the module double exists only so that *importing* it does not crash a suite. Storage **behaviour** is tested by injecting `createInMemoryKeyValueStorage()` through the `KeyValueStorage` interface, per CLAUDE.md §26. Module mocking is the fallback for things with no seam, never the default.

#### 6. `persistQueryClient` hung the test suite
**Symptom:** the query suite exceeded a 5-minute timeout.
**Cause:** `persistQueryClient` installs cache subscriptions and throttle timers that keep the event loop alive.
**Resolution:** switched to the one-shot `persistQueryClientSave` / `persistQueryClientRestore` primitives. Save-then-restore-into-a-new-client is a *more faithful* model of a cold start anyway, and it is deterministic.

#### 7. The persister throttles writes
**Symptom:** `storage.contains(...)` was `false` immediately after an awaited save.
**Cause:** `createSyncStoragePersister` throttles at 1000 ms by default; `persistClient` schedules the write rather than performing it.
**Resolution:** added a `throttleTime` parameter (production default 1000 ms, tests pass `0`) plus a macrotask flush in the test. The parameter is a legitimate production knob, not a test-only hook.

#### 8. 🔴 A test passed for entirely the wrong reason
**Symptom:** none — the test was green.
**What was actually happening:** `persistQueryClientSave` was called **without `buster`**, so it wrote with the default `''`. Restore then compared against `'v1'`, found a mismatch, and discarded everything. The test *"discards persisted data when the cache version changes"* therefore passed — but it would have passed identically if version busting were completely broken, because **nothing was ever being restored**.
**How it surfaced:** the companion test — *"restores cached data into a fresh client"* — failed. One test failing exposed that its sibling had never been meaningful.
**Resolution:** pass `buster` on save. Both paths now genuinely exercise their claim, and a `maxAge` expiry test was added alongside.
**Lesson:** a green test asserting that something is **absent** is worth double-checking. It passes both when the mechanism works and when the setup never ran.

#### 9. `restoreMocks: true` defeated spies created in a `describe` body
**Symptom:** console spies recorded zero calls despite the sink demonstrably writing.
**Cause:** `jest.config.js` sets `restoreMocks: true`, which restores original implementations **before each test** — undoing any spy created once during describe-body evaluation.
**Resolution:** create spies in `beforeEach`.

#### 10. `react-hooks/globals` rejected the test's capture pattern
**Symptom:** `Cannot reassign variables declared outside of the component/hook`.
**Cause:** tests captured a hook's return value by assigning to an outer variable during render — a genuine side effect during render, correctly flagged.
**Resolution:** rewrote to assert through **rendered output** (`useContainer() === container ? 'same' : 'different'`).
**Bonus:** this is the better test anyway — it asserts on what a user of the component observes rather than on captured internals (CLAUDE.md §26 rule 3).

#### 11. `import/no-named-as-default-member` false positive on `axios.create`
**Cause:** axios exposes both a default object and matching named exports; the rule's suggested `import { create }` is not a valid alternative.
**Resolution:** disabled the rule project-wide with a justification comment. An inline `eslint-disable-next-line` was tried first and **silently applied to the wrong line**, because the multi-line explanation pushed the target away — worth knowing, since the directive then reports as unused while the real warning persists.

### Coverage — how 90% was reached

The DoD required ≥ 90% on `core/`. Progress was iterative:

| Stage | Statements | What closed the gap |
|---|---|---|
| Initial | 70.9% | Domain-shaped modules tested first (errors, logger, migrations) |
| +http-client, +console sink, +DI provider | 80.1% | Added an **`adapter` seam** to `HttpClient` so retry and error mapping are driven by a stub transport — no network, no module mocking |
| +expo-network double, +database, +clients, +flags | 96.0% | Native modules doubled only where no seam exists |
| +container | **98.6%** | Composition root covered, including the degraded-database path |

**Final: 98.6% statements, 91.4% branches, 199 tests.**

A **coverage ratchet** was then added to `jest.config.js` (`./src/core/`: 95% statements, 90% branches) so a regression fails CI rather than being noticed later.

> The `adapter` seam is worth calling out as a pattern: rather than mocking axios, `HttpClientOptions` accepts a transport. Tests supply a scripted adapter that replays outcomes per attempt, which makes the retry loop, the attempt budget, and `Retry-After` handling all directly observable. It is also the hook a future offline-queue transport would use — a test seam that is not *only* a test seam.

### Deliberate scope decisions

#### Sentry moved to Phase 11
Phase 1's scope named "Reactotron (dev) and Sentry (prod) sinks". **The sink architecture shipped; the Sentry registration did not.**

**Reasoning:** registering Sentry requires a DSN, source-map upload during EAS build, and a production build to verify — all of which are Phase 11's scope, and none of which could be verified from Phase 1. Shipping unverifiable configuration would have produced a DoD checkbox with nothing behind it.

**What makes this safe:** `Logger` is a facade over a `LogSink` list, and redaction happens centrally *before* any sink sees a payload. Adding Sentry is one new file plus one line in the composition root, and it cannot forget to redact.

**Reactotron** likewise implements `LogSink` and can be registered locally by a developer who wants it. It is not a build dependency because it requires a running desktop companion app.

#### `MIGRATIONS` ships as an empty registry
The migration **runner** is fully implemented and tested — ordering, per-migration transactions, rollback on failure, and registry validation. The **registry** is empty.

**Reasoning:** tables belong to the features that own them, and their columns depend on entity and canonical-unit decisions made in Phase 4. Writing them now would encode guesses into persisted data — precisely the failure mode ROADMAP Phase 4 warns about ("entity and unit decisions made here propagate into the cache, charts, and widgets").

Phases 3, 4, and 10 add `001_locations`, `002_forecast_snapshots`, and the widget projection.

### Documentation kept in sync

Per CLAUDE.md §36, docs changed in the same commits as the code:
- **CLAUDE.md §5** — added `core/query/` to the folder tree
- **CLAUDE.md §23** — logger table rewritten around pluggable sinks, with sink status per phase
- **CLAUDE.md §37** — pinned-version table with the failure each pin prevents
- **`src/core/README.md`** — added `query/`, marked `i18n/` as Phase 2
- **ROADMAP.md** — Phase 0 and Phase 1 DoD marked with verification evidence

---

## Phase 2 — Design System, Theme, i18n & RTL

**Commit:** `<pending>`
**Objective:** the visual and linguistic foundation, complete in all four locale x theme combinations *before any product screen exists*.

### Delivered

| Area | Contents |
|---|---|
| `theme/tokens/` | Colours (raw palette), 4pt spacing, script-aware typography, radii, per-platform elevation |
| `theme/semantic/` | Light and dark mappings behind one `SemanticColors` interface, so a token cannot be added to one theme and forgotten in the other |
| `theme/weather/` | `getWeatherPalette(condition, timeOfDay)` — pure, 10 conditions x 4 time bands |
| `theme/` | `createTheme`, `ThemeProvider`, `useTheme` — imports nothing, takes its inputs as props |
| `core/i18n/` | i18next with three namespaces x two locales, `Locale` metadata, RTL helpers, `Intl`-based formatters |
| `shared/hooks/` | `useDebounce`, `useDebouncedCallback`, `useAppState`, `useOnForeground`, `useReducedMotion`, `useMotionDuration`, `useHaptics` |
| `shared/ui/` | `Text`, `Card`, `GlassSurface`, `Button`, `IconButton`, `Skeleton`, `SkeletonText`, `Divider`, `PressableScale`, `Sheet` |
| `features/settings/` | Preferences store (theme mode, locale, units, pending locale) persisted to MMKV with a version and migration |
| `app/showcase.tsx` | Development-only gallery, redirected away in production |

**518 tests, 95.9% statements overall.** Coverage ratchets added for `theme/` and `shared/`.

### Problems encountered

#### 1. Reanimated 4 needs a separate worklets package
**Symptom:** peer dependency on `react-native-worklets@0.10.x`, absent after installing Reanimated.
**Cause:** Reanimated 4 moved its worklet runtime into a standalone package. The Babel plugin moved with it — `react-native-reanimated/plugin` no longer exists.
**Resolution:** installed `react-native-worklets` and pointed `babel.config.js` at `react-native-worklets/plugin`, still last in the plugin list.

#### 2. Reanimated crashed every component test
**Symptom:** `TypeError: Cannot read properties of undefined (reading 'loadUnpackers')` on any import of a component using `useSharedValue`.
**Cause:** the `.native` entry points of `react-native-worklets` require a JSI binding that does not exist in Node.
**Resolution:** `resolver: 'react-native-worklets/jest/resolver'` in `jest.config.js` — an official resolver that strips the `.native` extension so the plain JS implementation is used.

#### 3. A dark-mode contrast failure, found by a test rather than by eye
**Symptom:** a test asserting that light and dark differ for every colour token failed, listing `textTertiary` as identical.
**Investigation:** both themes used `grey400` (`#667085`). Against the dark background (`grey950`) that is **4.03:1** — below the 4.5:1 WCAG AA floor for body text. Against the light background it is fine, which is exactly why it survived being written.
**Resolution:** dark text steps re-derived against the dark background — `textSecondary` to `grey200`, `textTertiary` to `grey300` (7.78:1).
**Lesson:** **dark mode is not an inversion of light mode.** A token that is correct in one theme carries no guarantee in the other, and "it looks fine" is not a contrast measurement. The parity test now exempts exactly two tokens (`textOnAccent`, `textOnWeather`) and fails on any other match.

#### 4. `Intl` made the Jalali dependency unnecessary
**Symptom:** `jalaliday` publishes only `dist/index.mjs`; Jest could not parse it, and extending `transformIgnorePatterns` did not help because the pattern does not cover `.mjs`.
**Investigation before fighting the config:** does the platform already do this? It does. `Intl.DateTimeFormat('fa-IR')` **resolves to the Persian calendar by default** and returns Persian-Indic digits — `۹ مرداد` for 31 July 2026, correct without a plugin.
**Resolution:** removed `jalaliday`, rewrote the formatters on `Intl`. `Intl.NumberFormat`, `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` together cover numbers, dates, weekdays, times and relative time in both locales.
**Lesson:** a build-tooling problem is sometimes a signal to re-examine the requirement. CLAUDE.md section 36 asks whether a dependency is needed *before* adding one; the question is worth asking again when one starts causing trouble.
**Residual risk:** this relies on the JS engine having full ICU. Hermes provides it on both platforms, but the Jalali output must be confirmed on a real device — Node and Hermes do not always ship identical ICU data.

#### 5. Static Inter font files were not obtainable
**Symptom:** three sources returned either a variable font under four static names, or a `.woff2` renamed to `.ttf`. All four files were byte-identical — every weight would have rendered the same.
**Resolution:** **Latin now uses the system font** (SF Pro / Roboto). This is the better choice regardless: it is what Apple Weather uses, it participates in Dynamic Type, and it removes ~3.5 MB from the bundle. Persian still bundles Vazirmatn, because Arabic-script coverage in system fonts varies by OS version and the metrics are not tuned for Persian at UI sizes.
**Consequence:** `resolveFont(script, weight)` returns `{ fontFamily, fontWeight }` rather than a family string — Latin carries a numeric weight with no family, Persian a family with no weight. Setting both would double-bold a face that is already bold.

#### 6. Bare path aliases did not resolve
**Symptom:** `Cannot find module '@/theme'`, while `@/theme/tokens/radii` resolved fine.
**Cause:** `tsconfig` mapped only `@/theme/*`. Phase 1 code always used subpaths, so the gap went unnoticed until a barrel import appeared.
**Resolution:** both forms mapped in `tsconfig.json` and `jest.config.js`. Babel's `module-resolver` already matched prefixes, so it needed no change — which is precisely why the failure showed up in the type checker rather than at runtime.

#### 7. `exactOptionalPropertyTypes` again, twice
i18next's `missingKeyHandler` and Gorhom's `onClose` both reject an explicit `undefined`. Both resolved with a conditional spread, the same pattern used three times in Phase 1.

#### 8. A test caught a null-safety bug in `useOnForeground`
**Symptom:** `TypeError: previous.match is not a function`.
**Cause:** the hook called `.match()` on `AppState.currentState`, which is `undefined` in the test environment — and can be `null` on Android at startup. In production this would have crashed the first time the app was backgrounded on such a device.
**Resolution:** replaced the regex with explicit equality checks. Simpler *and* safe.

#### 9. `react-hooks/purity` rejected `Date.now()` during render
Caught in the showcase screen. Hoisted to a module constant. The rule is right: a value that changes every render makes output unstable.

### Verification

| DoD item | How it was proven |
|---|---|
| Four locale x theme combinations | `THEME_COMBINATIONS` drives `describe.each` over every primitive |
| RTL restart flow | `needsRestartForLocale` tested in both directions and for the no-change case |
| Persian numerals and Jalali dates | Asserts the Persian output contains **no** ASCII digits, and that the Jalali day number differs from the Gregorian one |
| Zero literal colours | Lint (`no-restricted-syntax`), plus every primitive reading `useTheme()` |
| `getWeatherPalette` | All 40 combinations, plus override, night-tint and contrast rules |
| Reduced motion | `useMotionDuration` collapses to 0; `Skeleton` holds a static opacity |
| `accessibilityRole` | Every control queried by role and accessible name, never by `testID` |

### Deliberate scope decisions

- **The showcase is development-only** and redirects away in production. It is a developer tool; shipping it would be needless surface.
- **`useHaptics` is iOS-only.** Android's haptic support through this API is inconsistent across OEMs and often feels like a dull buzz. No haptic is better than a bad one.
- **Blur degrades to a solid fill on Android.** `expo-blur` is expensive and inconsistent there; the intent — a legible panel over the weather gradient — survives either way.

### Documentation kept in sync

- **CLAUDE.md section 18** — typography rewritten around the system-font decision
- **ROADMAP.md** — Phase 2 DoD marked with evidence and the three findings

### Open items

| Item | Blocker |
|---|---|
| On-device screen-reader pass | Requires a running dev client |
| Visual four-combination review | `/showcase` exists for it; needs a device |
| Jalali output confirmed under Hermes | Node ICU is not Hermes ICU; must be checked on device |

---

## Phase 3 — Locations

**Commit:** `<pending>`
**Objective:** the location capability every weather query is parameterized by.

### Delivered

| Layer | Contents |
|---|---|
| `domain/` | `Coordinates`, `Place`, `LocationSearchResult`, `SavedLocation`; `LocationRepository` interface; five use cases carrying real rules (minimum query length, duplicate detection, the saved-list cap, permutation validation) |
| `data/` | Open-Meteo geocoding source with Zod-validated DTOs, `expo-location` GPS + OS reverse geocoding, SQLite store, repository impl, migration `001_locations` |
| `presentation/` | Query-key factory, eight hooks (three with optimistic updates), permission prompt, location row, search row, list and search screens |
| `shared/utils/` | **Geohash quantization** — the utility every cache key in the app depends on |
| `core/i18n/` | `locations` namespace in English and Persian |

**623 tests.** Locations domain and mappers both at **100%**, ratcheted in `jest.config.js`.

### Problems encountered

#### 1. The boundaries rule rejected the migration registry — correctly
**Symptom:** `core is not allowed to import feature-data`, on a `MIGRATIONS` list in `core/storage` that imported the locations migration.
**Cause:** SQLite has ONE schema, so its version history must be one ordered list — and I put that list in `core/`, which made `core/` depend on `features/`.
**First instinct, rejected:** a comment calling it "a deliberate exception". That was a rationalization; the rule exists precisely to prevent this.
**Resolution:** inverted the dependency. `openDatabase` now RECEIVES its migration list, each feature exports its own migration through its barrel, and the composition root assembles the order. `core/storage` no longer knows any feature exists.
**Lesson:** when an enforced rule blocks you, the first question is whether the CODE is wrong — not the rule. Here it was.

#### 2. The composition root genuinely does need to see everything
**Symptom:** with the registry moved, `core/di/container.ts` now imported `@/features/locations` — same rule, same failure.
**Cause:** binding a domain interface to a data implementation requires seeing both. That is what composition means, and every DI container has this property.
**Resolution:** `core/di` became its own element type, allowed to import feature BARRELS and nothing deeper. Documented in the config and in CLAUDE.md §5.
**Why this one IS a legitimate carve-out, unlike #1:** the alternative is scattering construction across the app, which is strictly worse; and access stays limited to public barrels, so feature internals remain private.

#### 3. A lint rule was itself wrong
**Symptom:** `feature-domain is not allowed to import core`, on every use case and the repository interface.
**Investigation:** they import `Result` and `AppError` from `core/errors`. But CLAUDE.md §6 and §22 BOTH show a domain repository interface returning `Result<T, AppError>` — so the rule contradicted the documented architecture it was supposed to enforce.
**Resolution:** `core/errors` is now a distinct `core-errors` element type that `feature-domain` may import. Nothing else in `core/` is reachable from domain. CLAUDE.md §6 now states the exception and why.
**Lesson:** CLAUDE.md §31 says to change a rule in a PR when it blocks the right outcome. Distinguishing that case from #1 is the actual skill — the question is whether the rule or the code better matches the documented intent.

#### 4. A reference-value test caught a geohash edge case
**Symptom:** `geohash({ latitude: 90, longitude: 180 })` returned `bpbpb`, not the standard's `zzzzz`.
**Cause:** the longitude normaliser wrapped unconditionally, and `((180 + 180) % 360 + 360) % 360 - 180` is `-180`. The same meridian geographically, but the opposite end of the geohash range.
**Resolution:** values already inside `[-180, 180]` are returned untouched; only genuinely out-of-range values wrap.
**Why it was caught:** the test compares against PUBLISHED reference values rather than against this implementation's own output. A self-consistency test would have passed happily.

#### 5. FlashList v2 removed `estimatedItemSize`
**Symptom:** `Property 'estimatedItemSize' does not exist` on both list screens.
**Cause:** v2 measures items automatically; the prop was removed rather than deprecated.
**Resolution:** removed from both screens, and CLAUDE.md §21 corrected — it previously mandated "an accurate `estimatedItemSize`", which is now impossible to supply.

#### 6. A hand-written container literal broke when the container grew
**Symptom:** `container-provider.test.tsx` failed to compile after three members were added to `Container`.
**Resolution:** extracted `createFakeContainer()` into `core/di/__tests__/`, with per-member overrides. One place to update instead of every suite that renders a subtree.
**Lesson worth generalising:** a test double for a growing interface belongs in one shared place from the start, not copied per file.

#### 7. `distanceKm` replaced a geohash call in the domain
**Symptom:** `feature-domain is not allowed to import shared`, from `SaveLocation` using `isSameCell` for duplicate detection.
**Resolution:** switched to `distanceKm`, which already exists in the domain, with an explicit 5 km threshold.
**Why this is better than loosening the rule:** "the same city" is a domain judgement, and a distance threshold says that plainly. Reaching for a cache-key utility described the intent less honestly and would have coupled the domain to `shared/`.

### Verification

| DoD item | How it was proven |
|---|---|
| GPS resolves to a readable place name | Repository test covers the success path and the degraded path where reverse geocoding fails but coordinates survive |
| Denied vs permanently denied | `PermissionPrompt` renders a Settings link for `blocked` and a retry for `denied`, because requesting again when the OS will not prompt is a button that visibly does nothing |
| Search debounced, cached 30 days, Persian | 350 ms debounce at the input; `STALE_TIME.geocoding`; locale is part of the query key, so switching language cannot serve cached English names |
| Reorder optimistic with rollback | Mutation snapshots the list, applies the new order immediately, and restores the exact previous array on failure |
| **Geohash quantization** | Four simulated drifting GPS fixes produce ONE key; a test also demonstrates that raw floats would produce two |
| Domain + mapper coverage >= 95% | Both 100%, with ratchets so a regression fails CI |

### Deliberate scope decisions

- **Reordering is up/down buttons, not drag-only.** A drag gesture is invisible to a screen reader and hard to perform with a motor impairment. The same operation stays available to everyone.
- **A corrupt database costs persistence, not the app.** `createUnavailableLocationStore` fails writes EXPLICITLY — silently accepting a save the user would never get back is worse than saying it failed — while degrading optional reads to empty. Search and GPS keep working.
- **Mapbox reverse geocoding is deferred to Phase 8**, when its key and the map integration land. The OS geocoder needs no key, works offline, and already returns names in the device language.

### Documentation kept in sync

- **CLAUDE.md §6** — the `core/errors` exception to domain purity, and why
- **CLAUDE.md §5** — `core/di` marked as the one module allowed to import features
- **CLAUDE.md §21** — FlashList v2 correction
- **ROADMAP.md** — Phase 3 DoD with evidence and the two architectural corrections

### Open items

| Item | Blocker |
|---|---|
| Persian RTL review of both screens | Requires a running dev client |
| GPS and permission flows on a real device | Simulator permission behaviour differs from a device |
| Mapbox reverse-geocoding fallback | Phase 8, when the key exists |

---

## Phase 4 — Weather Domain & Data

**Commit:** `<pending>`
**Objective:** the heart of the product — entities, providers, mapping, caching and offline behaviour, with **no UI at all**.

### Delivered

| Layer | Contents |
|---|---|
| `domain/entities/` | Branded unit types (`Celsius`, `MetersPerSecond`, `Hectopascals`, `Meters`, `Degrees`, `Percent`, `Millimeters`), the shared `WeatherCondition` vocabulary, `SevereAlert`, and the five forecast entities |
| `domain/services/` | `AstronomyCalculator` — sun times, position, time-of-day band, moon phase and illumination, computed on-device |
| `domain/use-cases/` | `GetForecast`, `RefreshForecast`, `GetHourlyForecast`, `GetDailyForecast`, `GetMinutelyForecast`, `GetHistoricalWeather`, `GetSevereAlerts` |
| `data/` | Zod-validated DTOs for both providers, one mapper each into the same entities, circuit breaker, SQLite store, migration `002_forecast_snapshots`, cache-first repository |
| `shared/utils/` | `RequestCoalescer` |
| `shared/types/` | `Coordinates`, promoted from the locations feature |

**888 tests.** Mappers 99.1% statements / 100% functions; repositories 96.8%.

### Problems encountered

#### 1. suncalc returns DEGREES, not radians
**Symptom:** a test asserting the geometric bound `-90 <= elevation <= 90` failed with **-758.98**.
**Investigation:** suncalc's widely-cited documentation describes radians with a south-based azimuth. Probing the raw output against known positions showed otherwise — at solar noon in Tehran the azimuth reads exactly `180.00` and the altitude `77.75`. Both are only correct as DEGREES with a north-based bearing.
**Resolution:** removed both conversions; the values are used as returned. The method now carries an explicit warning not to re-add a radian conversion.
**Why it was caught:** the test compares against PUBLISHED astronomical facts — solar noon is due south, sunrise in June is north-east — rather than against this implementation's own output. A self-consistency test would have passed happily with a 758° sun.

#### 2. The two providers anchored a "day" differently
**Symptom:** the equivalence test reported `daily` differing between providers.
**Cause:** Open-Meteo stamps a daily entry at local MIDNIGHT; OpenWeather stamps it at roughly local NOON.
**Consequence if shipped:** the same calendar day would carry two different `date` values, so a day-grouped list or a chart x-axis would shift the moment failover happened — precisely when the user should notice nothing.
**Resolution:** `toLocalMidnight` normalises OpenWeather's `dt` using the response's own `timezone_offset`.

#### 3. `Coordinates` was a sideways dependency
**Symptom:** `feature-domain is not allowed to import feature-barrel`, on every weather use case.
**Cause:** the weather domain imported `Coordinates` from `@/features/locations`. Two features, one shared two-field record — CLAUDE.md §7 rule 3 says a shared concept moves DOWN, not sideways.
**Resolution:** promoted to `shared/types`, which became a distinct `shared-types` element type the domain may import.
**The principle that decided it:** **types are shareable, behaviour is not.** `shared/types` declares shapes with no runtime code and nothing to mock — architecturally inert, the same argument that lets `core/errors` reach the domain. `shared/utils` stays out of the domain's reach, which is why Phase 3 moved a geohash call in `SaveLocation` to the domain's own `distanceKm`.

#### 4. A domain test reached into the data layer
**Symptom:** `feature-domain is not allowed to import feature-data`, from the use-case tests importing DTO fixtures.
**Resolution:** added `domain/__fixtures__/forecast.ts`, which builds ENTITIES directly rather than mapping from a wire shape.
**Why the rule was right:** a use case's behaviour has nothing to do with a provider's wire format. The coupled test would have failed whenever a provider changed something the use case never sees — and it also forced `as never` casts to fabricate branded values, which the fixture builders now make unnecessary.

#### 5. `exactOptionalPropertyTypes` again
An optional property is not assignable to a parameter that merely allows absence. The precipitation helper needed `rain?: { '1h': number } | undefined` explicitly. Fifth occurrence across the project; the pattern is now familiar.

#### 6. Two heredocs truncated silently
Two multi-file `cat <<'EOF'` blocks ended early, leaving one file missing and another cut mid-statement. The tests still reported PASS because the truncated file contained no complete test. **Verified file listings rather than trusting the exit code**, and switched to the file-writing tool for large content.

### Verification

| DoD item | How it was proven |
|---|---|
| Every metric retrievable | The data source test asserts every field is present in the request, since omitting one silently drops it from the response |
| Identical entity shapes | Key sets compared across current, hourly, daily and minutely; scalar fields compared directly; only `provider` may differ |
| Circuit breaker | Forced degradation routes to the fallback, SKIPS the primary on the next call, and recovers after an injected clock passes the cooldown |
| Stale data when offline | Network failure with a six-hour-old cache returns the cache, not an error |
| Request coalescing | Ten concurrent calls issue ONE request; a separate test proves drifting GPS fixes share the same cell key |
| Astronomy offline | The whole suite runs with `fetch` throwing; polar day, polar night, and a full lunar cycle all validated against known values |
| Historical weather | Fetched, cached, and served from cache when the range is fully covered |
| Coverage | Mappers 100% functions; domain and repositories ratcheted in `jest.config.js` |

### Deliberate scope decisions

- **The circuit breaker ignores `network` and `timeout`.** Those mean the DEVICE is offline; failing over would hit the same wall and make the user wait through a second timeout. It also ignores `validation`, since a schema change would not be fixed by a provider with a different schema — and marking the provider down would hide a real bug.
- **Forecasts are stored as a JSON blob.** A forecast is read and written whole; no query asks for "hour 7 of yesterday's response". The queryable parts — cell, kind, timestamp — are real indexed columns.
- **The unavailable-store fallback silently succeeds on writes here**, unlike locations. A dropped cache entry costs a refetch; a dropped saved location loses something the user created.

### Documentation kept in sync

- **ROADMAP.md** — Phase 4 DoD marked with evidence, plus the two reference-value bugs and the `Coordinates` promotion
- **eslint.config.js** — `shared-types` element type, with the types-versus-behaviour reasoning inline

### Open items

| Item | Blocker |
|---|---|
| Real provider responses as fixtures | Fixtures are hand-built to the documented schema; capturing live responses needs network access |
| `local-weather-datasource` coverage | Thin SQLite wrapper; the risky logic (JSON revival, staleness) is covered, the delegation is not |
| Hermes ICU confirmation for Jalali output | Carried over from Phase 2 — still needs a device |

---

## Phase 5 — Home Experience

**Commit:** `<pending>`
**Objective:** the first user-visible screen, and proof the architecture delivers a premium experience.

### Delivered

| Area | Contents |
|---|---|
| `presentation/hooks/` | `weatherKeys` factory (geohash-quantized), six query hooks, `useWeatherAppearance` deriving the sky from astronomy |
| `presentation/components/` | Dynamic gradient background, current-conditions hero, RTL-aware hourly strip, daily list with a shared temperature scale, metric grid, sun/moon card, skeleton, data-age banner, error state |
| `presentation/screens/` | `HomeScreen` — composition only |
| `locations/` | `useSelectedLocationStore` — which place is showing, persisted to MMKV |
| `core/i18n/` | `weather` namespace, English and Persian |
| `core/errors/` | `asAppError` narrowing, needed at every query boundary |

**950 tests.** Every component asserted in all four locale × theme combinations.

### Problems encountered

#### 1. 🔴 ADR-0006's FlashList fix no longer exists
**Symptom:** `Property 'inverted' does not exist on type FlashListProps`.
**Cause:** ADR-0006 prescribed setting `inverted` from `isRTL` for a horizontal list. **FlashList v2 removed the prop.**
**Resolution:** rely on the platform — React Native mirrors a horizontal scroll view natively when `I18nManager.isRTL` is set, so the first item lands on the right and the initial offset is already correct. Inverting on top of that would DOUBLE-flip.
**What was corrected:** the ADR and CLAUDE.md §19 both carried the dead instruction. Leaving them would have sent a future reader after an API that does not exist, so both were revised and the ADR now records the revision.
**Still open:** this is the one part a unit test cannot prove. It needs an on-device check in Persian.

#### 2. Polar day/night was being inferred by a component
**Symptom:** none — caught while writing the sun/moon card, whose own comment admitted it was guessing.
**Cause:** the card inferred polar day from the ABSENCE of a sunrise time, then tried to distinguish it from polar night using the dawn/dusk pair. That is wrong in the southern hemisphere, where the seasons are reversed.
**Resolution:** `AstronomyCalculator` now returns an explicit `polarState`, decided from the sun's elevation at solar noon — which always exists.
**The principle:** whether the sun crosses the horizon is an astronomical fact, so the domain answers it. A component inferring domain facts from missing data is business logic in the wrong layer (CLAUDE.md §15 rule 5).

#### 3. The coverage ratchet caught an untested addition
**Symptom:** `coverage threshold for branches (90%) not met: 86.57%` on `./src/core/`, with every test passing.
**Cause:** `asAppError` was added to `core/errors` without tests.
**Resolution:** tested it, including every shape that must be REJECTED — an object with an unknown `kind`, a valid kind with no `retryable` flag, a non-boolean `retryable`.
**Why it matters:** this is exactly the regression the ratchet was installed for in Phase 1. It failed the build rather than letting coverage quietly erode.

#### 4. `as AppError` would have silenced a real gap
**Symptom:** TanStack types `error` as `Error`; the screen needed an `AppError`.
**The tempting fix:** `forecast.error as AppError`. TypeScript accepts it and nothing checks anything — banned by CLAUDE.md §12.
**Resolution:** `asAppError` VERIFIES the shape and wraps whatever does not match. A genuinely unexpected throw now surfaces as `unknown` rather than reaching a screen that assumed a `kind` field and crashing on `error.kind`.

#### 5. `getByRole` cannot see a non-accessible container
**Symptom:** `Unable to find an element with role: list`, on a `View` that visibly had `accessibilityRole="list"`.
**Cause:** RNTL only matches elements marked `accessible`. Adding that to a list container would be WRONG — it collapses the list into one accessibility element and hides every child from a screen reader.
**Resolution:** assert on visible content instead (`Now`, `Today`, `Humidity` / `اکنون`, `امروز`, `رطوبت`).
**Bonus:** this is the better test. A container role is an implementation choice; the label a user hears is the experience (CLAUDE.md §26 rule 3).

#### 6. `shared-types` was granted to only one layer
**Symptom:** `feature-presentation is not allowed to import shared-types`.
**Cause:** Phase 4 split `shared/types` into its own element type but added it only to the domain's allow list. Everything else had reached it through the broader `shared` type, which no longer matched.
**Resolution:** granted `shared-types` everywhere `shared` is already allowed.

### Verification

| DoD item | How it was proven |
|---|---|
| All four locale × theme combinations | Every component rendered under all four; assertions in both languages |
| Airplane mode with a data-age indicator | Banner tested for presence when offline, ABSENCE when online, and for carrying the age |
| Background transitions on condition change | `useWeatherAppearance` tested across conditions and times of day, including the severe-weather override |
| Skeleton matches the real layout | Built block-for-block against each component's dimensions |
| Zero business logic in components | The screen calls hooks and arranges output; the one inference found (polar state) was moved to the domain |
| Cold start, frame rate, screen reader | **Not verified** — all three need a running dev client |

### Deliberate scope decisions

- **Lottie weather animations deferred.** The scope listed them, but they are decoration on a screen whose structure and correctness are what Phase 5 exists to establish. Adding an asset pipeline for animations that cannot be reviewed on a device would have been motion nobody can see.
- **The location switcher sheet is not built.** `useSelectedLocationStore` and the Phase 3 location screens already let a user change location; the bottom-sheet shortcut is a convenience that belongs with the polish pass.
- **The daily list uses `map`, not FlashList.** CLAUDE.md §21 mandates FlashList for DYNAMIC lists; seven fixed rows inside a scroll view is not one, and virtualising it would nest a scroll container for no gain.

### Documentation kept in sync

- **ADR-0006** — FlashList row corrected, with a dated revision note explaining what changed and why the decision itself stands
- **CLAUDE.md §19** — the same corrected row
- **ROADMAP.md** — Phase 5 DoD split into what is proven and what needs a device

### Open items

| Item | Blocker |
|---|---|
| Cold-start budget, 60 fps, screen-reader pass | A running dev client — carried since Phase 0 |
| Hourly strip direction in Persian | Same; the platform-mirroring assumption needs confirming |
| Lottie animations, location-switcher sheet | Deferred to the polish pass |

---

## Cross-cutting lessons

Themes that recurred across both phases, worth carrying into Phase 2 and beyond.

### 1. Enforcement that is not tested does not exist
The RTL lint rule (Phase 0 #10) was configured, reviewed, and completely inert. It was caught only by writing a deliberate violation. **Every mechanical guarantee this project claims should be proven by a probe that fails, then deleted** — the same discipline the Phase 0 DoD applies to layer boundaries.

### 2. A silenced warning is a deferred failure
`--legacy-peer-deps` hid the typescript-eslint/TS 7 incompatibility until lint was actually run. Suppressing a peer warning does not resolve it; it moves the discovery to a less convenient moment.

### 3. Green tests deserve scrutiny when they assert absence
The cache-buster test (Phase 1 #8) passed while proving nothing. Any test whose assertion is "X is not there" can pass because the mechanism works *or* because the setup never happened.

### 4. Prefer a seam over a mock; use a mock only where no seam exists
`Result`, `KeyValueStorage`, `MigrationTarget`, `NetworkMonitor`, `Logger`, and `HttpClient`'s adapter are all injectable, and their tests use fakes. Only three things are module-mocked — `react-native-mmkv`, `expo-network`, `expo-sqlite`, and `expo-constants` — every one a native binding or build-time value with no construction-time seam.

### 5. Fix the documentation in the same commit
Every deviation from plan (npm over pnpm, TS 6 over TS 7, Sentry deferred, `core/query/` added) was written into CLAUDE.md or ROADMAP.md in the commit that caused it. A stale architecture doc is worse than none, because it is trusted.

---

## Template for future phases

```markdown
## Phase N — <Name>

**Commit(s):** `<sha>`
**Objective:** <one line from ROADMAP>

### Delivered
<table: area → what>

### Problems encountered
#### N. <short symptom-first title>
**Symptom:** what was actually observed
**Cause:** the underlying reason
**Resolution:** what was changed
**Lesson:** (only when it generalises)

### Verification
<how each DoD item was proven — evidence, not assertion>

### Deliberate scope decisions
<what was moved or omitted, and why>

### Documentation kept in sync
<which docs changed alongside>

### Open items
<table: item → blocker>
```
