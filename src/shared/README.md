# `shared/` — Cross-feature reusable code

Code used by **two or more features**, with no knowledge of any specific feature's domain.

## Belongs here

| Folder | Contents |
|---|---|
| `ui/` | Design system primitives — `Text`, `Card`, `GlassSurface`, `Button`, `Skeleton`, `Sheet`, chart primitives |
| `hooks/` | Generic hooks — `useDebounce`, `useAppState`, `useHaptics`, `useReducedMotion` |
| `utils/` | Pure helpers with no domain knowledge |
| `types/` | Cross-cutting types |

## Does NOT belong here

- ❌ **Anything that knows about weather, AQI, or locations.** A `<WeatherCard>` belongs to the weather feature, however reusable it looks.
- ❌ **Anything used by exactly one feature.** Keep it local; promote it when a second feature genuinely needs it.
- ❌ **Business logic** — that is a feature's `domain/`.
- ❌ **Colour, spacing, or typography values** — those are `theme/`.

## Hard rules

> **`shared/` must never import from `features/`.**

It sits below features in the dependency graph. This is a lint error.

**Prefer local, promote later.** Un-sharing something is much harder than sharing it — premature promotion creates coupling between features that have no real relationship. When in doubt, start in the feature.

## Component requirements

Everything in `ui/` must:
- Consume `useTheme()` — **zero literal colours or magic numbers**
- Work in **all four** combinations: light/dark × English/Persian
- Use logical properties (`marginStart`, not `marginLeft`) — enforced by lint
- Have `accessibilityRole` and a translated `accessibilityLabel`
- Export through `shared/ui/index.ts`

See [CLAUDE.md §15](../../CLAUDE.md#15-component-design-rules) and the [new component guide](../../CLAUDE.md#34-guide-creating-a-new-component).
