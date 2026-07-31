import { Redirect } from 'expo-router';

import { ShowcaseScreen } from '@/shared/ui/showcase/showcase-screen';

/**
 * Development-only component gallery.
 *
 * Redirected away in production builds so the gallery cannot ship — it is a
 * developer tool, and its presence in a release would be a needless surface.
 */
export default function Showcase() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ShowcaseScreen />;
}
