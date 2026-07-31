import { BlurView } from 'expo-blur';
import { Platform, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Radius, Spacing } from '@/theme';

/**
 * Glassmorphism, as a single primitive.
 *
 * Blur props are NOT repeated across components (CLAUDE.md §18) — every frosted
 * panel in the app is this component, so the effect can be retuned in one place.
 *
 * Blur is expensive on Android and historically inconsistent across OEMs, so
 * there it degrades to a solid translucent fill. The visual intent — a legible
 * panel floating over the weather gradient — is preserved either way, which is
 * what matters.
 */
export interface GlassSurfaceProps {
  readonly padding?: Spacing;
  readonly radius?: Radius;
  readonly bordered?: boolean;
  readonly style?: ViewStyle;
  readonly children: React.ReactNode;
}

export function GlassSurface({
  padding = 'base',
  radius = 'lg',
  bordered = true,
  style,
  children,
}: GlassSurfaceProps) {
  const theme = useTheme();

  const shell: ViewStyle = {
    borderRadius: theme.radii[radius],
    // Required: without it the blur bleeds past the rounded corners on iOS.
    overflow: 'hidden',
    ...(bordered ? { borderWidth: 1, borderColor: theme.colors.glassBorder } : {}),
  };

  const inner: ViewStyle = { padding: theme.spacing[padding] };

  if (Platform.OS === 'android') {
    return (
      <View style={[shell, { backgroundColor: theme.colors.glassFill }, style]}>
        <View style={inner}>{children}</View>
      </View>
    );
  }

  return (
    <BlurView
      intensity={theme.colors.glassIntensity}
      tint={theme.scheme === 'dark' ? 'dark' : 'light'}
      style={[shell, style]}
    >
      <View style={[inner, { backgroundColor: theme.colors.glassFill }]}>{children}</View>
    </BlurView>
  );
}
