import { createContext, useContext, type ReactNode } from 'react';

import type { Container } from './container';

/**
 * React access to the container.
 *
 * Components and hooks resolve dependencies through {@link useContainer} rather
 * than importing a singleton, so a test can render a subtree against fakes with
 * no module mocking (CLAUDE.md §26).
 */

const ContainerContext = createContext<Container | undefined>(undefined);

interface ContainerProviderProps {
  readonly container: Container;
  readonly children: ReactNode;
}

export function ContainerProvider({ container, children }: ContainerProviderProps) {
  return (
    <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
  );
}

/**
 * Resolve the container.
 *
 * @throws When called outside a {@link ContainerProvider}. This is a programming
 *   error, not a runtime condition — failing loudly in development is correct
 *   (CLAUDE.md §31), and it keeps the return type non-nullable so no call site
 *   needs a null check.
 */
export function useContainer(): Container {
  const container = useContext(ContainerContext);

  if (container === undefined) {
    throw new Error(
      'useContainer() was called outside a <ContainerProvider>. Wrap the tree in app/_layout.tsx.',
    );
  }

  return container;
}

/** Convenience accessor — the logger is needed almost everywhere. */
export function useLogger() {
  return useContainer().logger;
}
