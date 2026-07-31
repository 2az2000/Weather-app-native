/**
 * The semantic colour contract — layer 2 of 3.
 *
 * Components bind to MEANING (`colors.textPrimary`), never to a raw palette
 * entry (`palette.grey800`). Dark mode is then a swap of this one mapping, and a
 * palette change never touches a component (CLAUDE.md §18).
 *
 * Light and dark must both implement this interface exactly, so TypeScript
 * catches a token added to one theme and forgotten in the other — the usual
 * cause of "looks right in light, broken in dark".
 */
export interface SemanticColors {
  // ── Surfaces, back to front ────────────────────────────────────────────────
  /** App background. */
  readonly background: string;
  /** Cards and raised content. */
  readonly surface: string;
  /** A surface on top of a surface (nested cards, sheets). */
  readonly surfaceElevated: string;
  /** Pressed/hovered state for an interactive surface. */
  readonly surfacePressed: string;

  // ── Glassmorphism ──────────────────────────────────────────────────────────
  /** Translucent fill layered over the weather background. */
  readonly glassFill: string;
  /** Hairline that gives a glass panel its edge. */
  readonly glassBorder: string;
  /** Blur intensity, 0–100, consumed by expo-blur. */
  readonly glassIntensity: number;

  // ── Text ───────────────────────────────────────────────────────────────────
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  /** Text on an accent-filled surface. */
  readonly textOnAccent: string;
  /** Text over a weather background, where contrast is not guaranteed. */
  readonly textOnWeather: string;
  readonly textDisabled: string;

  // ── Lines ──────────────────────────────────────────────────────────────────
  readonly border: string;
  readonly borderStrong: string;
  readonly separator: string;

  // ── Interaction ────────────────────────────────────────────────────────────
  readonly accent: string;
  readonly accentPressed: string;
  readonly accentSubtle: string;
  readonly focusRing: string;

  // ── Status ─────────────────────────────────────────────────────────────────
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly info: string;
  readonly successSubtle: string;
  readonly warningSubtle: string;
  readonly dangerSubtle: string;

  // ── Utility ────────────────────────────────────────────────────────────────
  readonly shadow: string;
  /** Scrim behind a modal. */
  readonly overlay: string;
  /** Skeleton base and its shimmer highlight. */
  readonly skeletonBase: string;
  readonly skeletonHighlight: string;
}

export type ColorScheme = 'light' | 'dark';
