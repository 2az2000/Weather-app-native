import { Stack } from 'expo-router';

/**
 * Root layout.
 *
 * Route files stay thin (CLAUDE.md §17). This will grow to host the provider
 * stack — QueryClientProvider, theme, i18n + RTL bootstrap, error boundary —
 * as those land in Phases 1 and 2. It must not accumulate UI.
 */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
