# ADR-0001 — Expo prebuild and dev client over Expo Go

**Status:** Accepted
**Date:** 2026-07-29

## Context

The application requires several libraries that ship custom native code:

| Library | Native requirement |
|---|---|
| `@rnmapbox/maps` | Mapbox native SDK |
| `react-native-mmkv` | JSI / native storage |
| `@shopify/react-native-skia` | Native graphics |
| `@react-native-firebase/messaging` | FCM native SDK |
| Home screen widgets | Kotlin (Glance) + Swift (WidgetKit) |

Expo Go ships a fixed, prebuilt binary containing a curated set of native modules. It cannot load arbitrary native code. **None of the libraries above can run in Expo Go.**

The choice was therefore between the Expo managed workflow with prebuild (Continuous Native Generation), and a bare React Native project.

## Decision

Use **Expo SDK 57 with prebuild / CNG plus a custom development client, built via EAS.**

- `android/` and `ios/` are **generated artifacts** and are gitignored.
- All native configuration is expressed declaratively as **config plugins** in `app.config.ts`.
- Development uses a custom dev client, not Expo Go.
- Builds and submissions go through EAS; secrets live in EAS Secrets.

## Consequences

**Positive**
- Full access to any native module while keeping Expo's tooling, OTA updates, and upgrade path.
- Native configuration is version-controlled, reviewable, and reproducible — a config plugin diff is readable in a PR, unlike a mutated Xcode project.
- SDK upgrades regenerate native projects cleanly instead of requiring manual merge of native changes.
- No `.xcodeproj` or Gradle merge conflicts, because those files are not in git.

**Negative**
- Onboarding requires an EAS build; a new contributor cannot simply scan a QR code.
- Iteration on native changes is slower — a prebuild plus rebuild rather than a hot reload.
- A library without a config plugin requires writing one, or authoring a local Expo module.

**Rules this creates**
- **Never edit `android/` or `ios/` directly.** Changes are silently destroyed on the next prebuild. Every native change goes through a config plugin or a local module in `modules/`.
- Any new dependency with native code must be checked for config plugin availability before adoption (CLAUDE.md §37).

## Alternatives considered

**Bare React Native workflow** — full native control, but forfeits Expo's module ecosystem, upgrade tooling, and EAS integration, and puts native project files back into git where they generate constant conflicts. The control gained is control we do not need.

**Expo Go with reduced scope** — would require dropping Mapbox, Skia, MMKV, FCM, and widgets. That is most of the product. Rejected outright.
