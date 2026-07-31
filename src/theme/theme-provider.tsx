import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createTheme, type Theme } from './theme';
import type { ColorScheme } from './semantic/types';
import type { Script } from './tokens/typography';

/**
 * Theme access for components.
 *
 * `theme/` sits at the bottom of the dependency graph and imports NOTHING —
 * not the settings store, not i18n. The provider receives its inputs as props,
 * and `app/_layout.tsx` composes them (CLAUDE.md §7 rule 5).
 *
 * That is what keeps `theme/` a leaf, and what lets a test render any component
 * under any of the four locale × scheme combinations with no other setup.
 */

const ThemeContext = createContext<Theme | undefined>(undefined);

interface ThemeProviderProps {
  readonly scheme: ColorScheme;
  readonly script: Script;
  readonly isRTL: boolean;
  readonly children: ReactNode;
}

export function ThemeProvider({ scheme, script, isRTL, children }: ThemeProviderProps) {
  // Memoised on its inputs: the theme object is read on the render path of
  // every styled component, so a new identity each render would defeat every
  // downstream memo.
  const theme = useMemo(
    () => createTheme({ scheme, script, isRTL }),
    [scheme, script, isRTL],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/**
 * Resolve the active theme.
 *
 * @throws When called outside a {@link ThemeProvider} — a programming error, so
 *   it fails loudly rather than returning a silent default that would produce
 *   an unstyled screen (CLAUDE.md §31).
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (theme === undefined) {
    throw new Error(
      'useTheme() was called outside a <ThemeProvider>. Wrap the tree in app/_layout.tsx.',
    );
  }

  return theme;
}
