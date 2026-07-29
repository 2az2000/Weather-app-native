# `app/` — expo-router route tree

File-based routing. **These files are thin by design.**

## The rule

A route file wires params and re-exports a screen. **All UI lives in `features/*/presentation/screens/`.**

```tsx
// app/(tabs)/index.tsx
export { HomeScreen as default } from '@/features/weather';
```

**Why:** this keeps navigation structure independent of UI implementation. Restructuring the router never touches screen code, and screens stay unit-testable without a navigation context.

## Belongs here

- `_layout.tsx` files — navigators, providers, i18n + RTL bootstrap
- Route files re-exporting screens
- Route param parsing and validation (with Zod — params arrive as strings from a URL and must not be trusted)

## Does NOT belong here

- ❌ **Screen implementations** — those are `features/<f>/presentation/screens/`
- ❌ **Components**
- ❌ **Data fetching**
- ❌ **Business logic**

If a file in `app/` is longer than ~20 lines, something has leaked in from a feature.

## Rules

1. **Route params are typed and validated at the boundary.**
2. **Deep links are designed, not discovered.** Every route that makes sense as an entry point (a saved city, an alert) has a documented URL and is reachable from a notification.
3. **Navigation state is not app state.** Never mirror the current route into Zustand.
4. **Heavy routes are lazy-loaded.** Maps and charts must not affect cold start.
5. **Back must always be safe.** No destructive action reachable without confirmation.

See [CLAUDE.md §17](../CLAUDE.md#17-navigation-guidelines).
