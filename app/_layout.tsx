import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider } from 'react-i18next';

import { ContainerProvider, createContainer, type Container } from '@/core/di';
import { createI18n, isNativeRTL, LOCALE_META } from '@/core/i18n';
import {
  createQueryClient,
  createQueryPersister,
  PERSIST_BUSTER,
  PERSIST_MAX_AGE_MS,
} from '@/core/query';
import { usePreferencesStore } from '@/features/settings';
import { ThemeProvider, type ColorScheme } from '@/theme';

/**
 * Root layout — the app's composition point.
 *
 * Route files stay thin (CLAUDE.md §17); this one holds the provider stack and
 * nothing else. It is also where cross-cutting concerns are COMPOSED: `theme/`
 * imports nothing and `core/i18n` knows nothing about preferences, so this is
 * the only place that knows all three (CLAUDE.md §7 rule 5).
 */
export default function RootLayout() {
  const [container, setContainer] = useState<Container>();
  const [startupError, setStartupError] = useState<Error>();

  const themeMode = usePreferencesStore((state) => state.themeMode);
  const locale = usePreferencesStore((state) => state.locale);
  const systemScheme = useColorScheme();

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

  const i18n = useMemo(() => createI18n(locale), [locale]);

  const queryClient = useMemo(() => createQueryClient(), []);

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

  // `useColorScheme()` can also report 'unspecified' or null, so narrow rather
  // than assuming it is always 'light' | 'dark'.
  const scheme: ColorScheme =
    themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;

  // Direction comes from the NATIVE layout engine, not from the selected locale.
  // Until the app restarts they can disagree, and rendering against the locale
  // would mirror text inside an unmirrored layout (ADR-0006).
  const isRTL = isNativeRTL();

  if (startupError !== undefined) {
    return <StartupErrorScreen error={startupError} />;
  }

  // Rendering nothing for one frame is correct: the native splash is still up,
  // and MMKV hydration is synchronous once the container exists, so there is no
  // spinner to show.
  if (container === undefined || persistOptions === undefined) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ContainerProvider container={container}>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider
            scheme={scheme}
            script={LOCALE_META[locale].script}
            isRTL={isRTL}
          >
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={persistOptions}
            >
              <Stack screenOptions={{ headerShown: false }} />
            </PersistQueryClientProvider>
          </ThemeProvider>
        </I18nextProvider>
      </ContainerProvider>
    </GestureHandlerRootView>
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
