import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { ContainerProvider, createContainer, type Container } from '@/core/di';
import {
  createQueryClient,
  createQueryPersister,
  PERSIST_BUSTER,
  PERSIST_MAX_AGE_MS,
} from '@/core/query';

/**
 * Root layout — the app's composition point.
 *
 * Route files stay thin (CLAUDE.md §17); this one holds the provider stack and
 * nothing else. Theme, i18n, and the RTL bootstrap join it in Phase 2.
 */
export default function RootLayout() {
  const [container, setContainer] = useState<Container>();
  const [startupError, setStartupError] = useState<Error>();

  useEffect(() => {
    let cancelled = false;

    createContainer()
      .then((created) => {
        if (!cancelled) setContainer(created);
      })
      .catch((cause: unknown) => {
        // A container failure means misconfiguration (e.g. a missing required
        // env var). It must surface immediately and legibly rather than as a
        // confusing failure several screens in (ROADMAP Phase 1 DoD).
        if (!cancelled) {
          setStartupError(cause instanceof Error ? cause : new Error(String(cause)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistOptions = useMemo(
    () =>
      container === undefined
        ? undefined
        : {
            persister: createQueryPersister(container.storage),
            buster: PERSIST_BUSTER,
            maxAge: PERSIST_MAX_AGE_MS,
          },
    [container],
  );

  const queryClient = useMemo(() => createQueryClient(), []);

  if (startupError !== undefined) {
    return <StartupErrorScreen error={startupError} />;
  }

  // Rendering nothing for one frame is correct here: the native splash screen is
  // still up, and MMKV hydration is synchronous once the container exists, so
  // there is no spinner to show.
  if (container === undefined || persistOptions === undefined) {
    return null;
  }

  return (
    <ContainerProvider container={container}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <Stack screenOptions={{ headerShown: false }} />
      </PersistQueryClientProvider>
    </ContainerProvider>
  );
}

/**
 * Deliberately unstyled and untranslated.
 *
 * This renders when configuration is broken — before the theme or i18n are
 * guaranteed to work. Depending on them here could turn a legible error into a
 * blank screen.
 */
function StartupErrorScreen({ error }: { readonly error: Error }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Startup failed</Text>
      <Text style={{ fontSize: 13, lineHeight: 20 }}>{error.message}</Text>
    </View>
  );
}
