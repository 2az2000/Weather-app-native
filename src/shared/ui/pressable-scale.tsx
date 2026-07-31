import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useHaptics, useMotionDuration } from '@/shared/hooks';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A pressable that scales slightly on touch.
 *
 * The micro-interaction that makes controls feel physical. Two rules from
 * CLAUDE.md §20 are load-bearing here:
 *
 * 1. **`transform` only** — never `width`/`height`. Transform is GPU-composited;
 *    animating layout forces a reflow every frame and is the main source of jank.
 * 2. **Reduced motion is respected** — the duration collapses to 0, so the press
 *    state still applies instantly rather than the feedback disappearing.
 */
export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** How far to scale down while pressed. */
  readonly scaleTo?: number;
  /** Fire selection haptic on press. Off by default — haptics are punctuation. */
  readonly haptic?: boolean;
  readonly style?: ViewStyle;
  readonly children: React.ReactNode;
}

export function PressableScale({
  scaleTo = 0.96,
  haptic = false,
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const duration = useMotionDuration(120);
  const haptics = useHaptics();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, { duration }) }],
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = scaleTo;
        if (haptic) haptics.selection();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = 1;
        onPressOut?.(event);
      }}
      style={[animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
