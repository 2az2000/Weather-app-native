import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/shared/hooks';
import { useTheme } from '@/theme';
import type { Radius } from '@/theme';

/**
 * Loading placeholder.
 *
 * **A skeleton matching the real layout, never a bare spinner** (CLAUDE.md §15
 * rule 9). A spinner discards the layout and causes a visible shift when content
 * arrives; a skeleton reserves the space, so loading→loaded is seamless.
 *
 * Animates `opacity` only — GPU-composited, no reflow (CLAUDE.md §20).
 */
export interface SkeletonProps {
  readonly width?: ViewStyle['width'];
  readonly height?: number;
  readonly radius?: Radius;
  readonly style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'sm',
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (reducedMotion) {
      // Static but still visibly a placeholder — the information that content
      // is pending must survive without the animation.
      pulse.value = 0.7;
      return;
    }

    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reducedMotion, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel=""
      // Announced by the container's own loading label, not per-skeleton —
      // otherwise a screen reader reads "loading" once per placeholder.
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: theme.radii[radius],
          backgroundColor: theme.colors.skeletonBase,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Convenience: several skeleton lines approximating a paragraph. */
export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
}: {
  readonly lines?: number;
  readonly lastLineWidth?: ViewStyle['width'];
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height={theme.fontSize.body}
          width={index === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}
