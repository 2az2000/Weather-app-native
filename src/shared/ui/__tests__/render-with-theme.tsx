import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { ThemeProvider, type ColorScheme, type Script } from '@/theme';

/**
 * Render a component under a specific theme and script.
 *
 * `theme/` takes its inputs as props and imports nothing (CLAUDE.md §7 rule 5),
 * which is exactly what makes this helper two lines instead of a mocked module
 * graph — any component can be rendered under any combination with no other
 * setup.
 */

export interface ThemeCombination {
  readonly name: string;
  readonly scheme: ColorScheme;
  readonly script: Script;
  readonly isRTL: boolean;
}

/**
 * The four combinations every primitive must handle.
 *
 * CLAUDE.md §34 step 7 is explicit that it is FOUR, not two: a component can be
 * correct in light-English and still broken in dark-Persian, and only checking
 * two of the four is how that ships.
 */
export const THEME_COMBINATIONS: readonly ThemeCombination[] = [
  { name: 'light · English (LTR)', scheme: 'light', script: 'latin', isRTL: false },
  { name: 'dark · English (LTR)', scheme: 'dark', script: 'latin', isRTL: false },
  { name: 'light · Persian (RTL)', scheme: 'light', script: 'arabic', isRTL: true },
  { name: 'dark · Persian (RTL)', scheme: 'dark', script: 'arabic', isRTL: true },
];

export function renderWithTheme(
  ui: ReactElement,
  combination: ThemeCombination = THEME_COMBINATIONS[0]!,
  options?: RenderOptions,
) {
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <ThemeProvider
        scheme={combination.scheme}
        script={combination.script}
        isRTL={combination.isRTL}
      >
        {children}
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
