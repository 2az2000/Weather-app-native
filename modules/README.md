# `modules/` — Local Expo modules

Native code owned by this project, written as local Expo modules rather than patched into generated native folders.

## Why this exists

`android/` and `ios/` are **generated artifacts and gitignored** ([ADR-0001](../docs/adr/0001-expo-prebuild-and-dev-client.md)). Editing them directly means the change is silently destroyed on the next `prebuild`.

Native code therefore lives in one of two places:
- A **config plugin** in `app.config.ts` — for configuring an existing native dependency
- A **local Expo module here** — for native code we author ourselves

## Planned

| Module | Contents |
|---|---|
| `weather-widget/` | Android home screen widget (Kotlin + Glance) and iOS WidgetKit extension (Swift), with App Group shared storage on iOS |

## Widget rules

1. **Widgets read from SQLite / App Group storage written by the app.** They must render correctly with the app never launched since boot — a Phase 10 Definition-of-Done item.
2. **A widget never fetches.** Network access from a widget process is unreliable and battery-hostile.
3. **Widgets respect user preferences** — units, theme, and language, including **Persian RTL layout**.
4. **Refresh scheduling stays within platform budgets.** Both platforms throttle aggressively; exceeding the budget means the widget stops updating entirely.
5. **Tapping a widget deep-links** to the matching location in the app.

See [CLAUDE.md §37](../CLAUDE.md#37-project-workflow) and [ROADMAP Phase 10](../ROADMAP.md#phase-10--offline-sync--widgets).
