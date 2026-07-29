# `theme/` — Design tokens and palettes

Every visual value in the application originates here. **Zero literal colours, spacing, or font sizes appear in components** — enforced by lint.

## Structure

```
theme/
├── tokens/
│   ├── colors.ts        # raw palette — NEVER referenced by a component
│   ├── spacing.ts       # 4pt scale
│   ├── typography.ts    # per-script families (Inter / Vazirmatn), sizes, weights
│   ├── radii.ts
│   └── elevation.ts
├── semantic/
│   ├── light.ts         # raw → meaning: surface, textPrimary, accent…
│   └── dark.ts
├── weather/
│   └── conditions.ts    # (condition, timeOfDay, solarElevation) → gradient set
└── index.ts             # useTheme()
```

## Three token layers

| Layer | Example | Used by components? |
|---|---|---|
| **Raw** | `blue500` | ❌ Never |
| **Semantic** | `colors.surface`, `colors.textPrimary` | ✅ Always |
| **Dynamic weather** | `getWeatherPalette(condition, timeOfDay)` | ✅ Backgrounds |

**Why the indirection?** Components bind to *meaning*, not to a colour. Dark mode then becomes a swap of the semantic layer, and changing the palette never touches a component.

## Rules

1. **Access through `useTheme()`.** Never import a palette file into a component.
2. **Both light and dark must be correct.** A component that only looks right in one is unfinished.
3. **`getWeatherPalette` is a pure function** and unit-tested across all conditions × times of day. The background is a *derivation* of weather state, not ad-hoc styling scattered across screens.
4. **Typography is script-aware.** Persian uses Vazirmatn with its own line-height — Persian glyphs need more vertical room than Latin at the same point size.
5. **Glassmorphism is a `<GlassSurface>` primitive** in `shared/ui/`, not repeated blur props.

## Depends on

**Nothing.** `theme/` is a leaf in the dependency graph.

See [CLAUDE.md §18](../../CLAUDE.md#18-theme-architecture).
