# ADR-0006 — RTL-first layout from day one

**Status:** Accepted
**Date:** 2026-07-29
**Revised:** 2026-08-04 — the FlashList guidance below changed when v2 removed
the `inverted` prop. The DECISION is unchanged; only one prescribed technique
was wrong, and leaving it would have sent a future reader after an API that no
longer exists.

## Context

The application must support **English and Persian as equal, first-class locales**. Persian is written right-to-left, which affects far more than text direction: layout order, spacing, icon direction, gesture direction, chart axis direction, and scroll behaviour all mirror.

React Native provides `I18nManager` and automatic mirroring for *some* properties, but the support is partial and the gaps are exactly where the bugs live.

**The core problem is timing, not difficulty.** RTL is not hard to implement — it is hard to *retrofit*. Every `marginLeft` written before RTL support becomes a defect that can only be found by manually reviewing every screen in Persian. On a codebase of any size, that audit is more expensive than the original implementation, and it is never fully complete because new violations are written faster than old ones are found.

## Decision

**Treat RTL as a day-one architectural constraint, established in Phase 2 before any product screen exists**, and enforce it mechanically.

### 1. Logical properties only — enforced by lint

`marginStart`, `paddingEnd`, `start`, `end`.

**`left`, `right`, `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight` are banned by an ESLint rule that fails CI.**

This is the single highest-leverage decision in this ADR. A convention would be violated within a week; a lint rule cannot be.

### 2. The known traps are documented before they are hit

These do **not** mirror automatically. They are the most common RTL bugs in weather apps specifically, and each is documented in CLAUDE.md §19 before the code that would hit them is written:

| Component | Trap | Required handling |
|---|---|---|
| **Reanimated gestures** | Swipe direction is not mirrored — "swipe to next day" goes backwards in Persian | Multiply translation by `isRTL ? -1 : 1` |
| **Skia charts** | The canvas has no layout direction. A time series renders left-to-right regardless of locale, so **time appears to run backwards in Persian** | Explicitly invert the x-axis scale when `isRTL` |
| **FlashList horizontal** | ⚠️ **The old fix no longer exists** — FlashList v2 removed the `inverted` prop | Rely on the platform: RN mirrors a horizontal scroll view natively when `I18nManager.isRTL` is set. Inverting on top of that DOUBLE-flips. Per-item spacing still needs `marginEnd` |
| **Directional icons** | Arrows and chevrons must mirror | Mirror them — but **never mirror the compass**: north is north in every language |
| **`I18nManager.forceRTL`** | Requires a full app restart to take effect | Confirmation dialog, then `expo-updates.reloadAsync()` |

The Skia chart trap is worth singling out: it produces a chart that is visually plausible but silently wrong about the direction of time. It is easy to ship and hard to notice.

### 3. Locale-aware formatting everywhere

All numbers, dates, and units flow through `core/i18n/formatters`. Persian uses Persian-Indic digits (۰۱۲۳۴۵۶۷۸۹) and optionally the Jalali calendar via Day.js plugins. String concatenation of numbers is forbidden.

### 4. Persian review is a merge gate

**Every screen must be reviewed in Persian before its PR merges** — the whole screen, not a spot check. It is a checklist item in CLAUDE.md §28 and §29, and PR screenshots must show all four combinations (light/dark × en/fa).

### 5. `isRTL` comes from one place

Read from `core/i18n`, never from `I18nManager` directly in a component. One accessor means one place to change if the mechanism does.

## Consequences

**Positive**
- Persian is genuinely first-class rather than a degraded translation, which is a meaningful differentiator for this app.
- **No RTL audit is ever required**, because violations cannot enter the codebase — the lint rule rejects them at commit time.
- Adding a third RTL language (Arabic, Hebrew) later costs translation work only, with no layout work at all.
- Forces cleaner layout code generally: logical properties are the modern standard and read better than physical ones.

**Negative**
- Slightly higher up-front cost in Phase 2, and a small ongoing cost per component.
- Charts and gesture handlers carry genuine additional complexity that an LTR-only app would avoid.
- Every PR with UI needs four screenshots rather than one.
- Developers unfamiliar with logical properties need a short ramp-up — mitigated by the lint rule teaching the correct form at the moment of the mistake.

## Alternatives considered

**Ship English first, add Persian later** — the tempting option, and the reason so many apps have poor RTL support. It converts a small continuous cost into a large one-time cost that also degrades quality, because retrofitted RTL is audited rather than designed. Explicitly rejected.

**Translate strings but keep LTR layout** — cheap, and produces an app that reads as obviously broken to a Persian speaker. Numbers, punctuation, and alignment all end up wrong. Rejected as failing the "first-class locale" goal.

**A separate RTL stylesheet layer** — duplicates every style definition and doubles the surface where the two can drift out of sync. Logical properties achieve the same result with one definition.
