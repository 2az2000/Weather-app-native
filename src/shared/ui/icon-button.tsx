import type { ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Radius } from '@/theme';

import { PressableScale } from './pressable-scale';

/**
 * Icon-only control.
 *
 * `accessibilityLabel` is REQUIRED and has no default: an icon-only button is
 * completely unlabelled to a screen reader, so omitting it makes the control
 * unusable rather than merely degraded (CLAUDE.md §15 rule 8).
 */
export interface IconButtonProps {
  /** Already translated. Not optional — see above. */
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly icon: React.ReactNode;
  readonly variant?: 'plain' | 'filled' | 'glass';
  readonly size?: number;
  readonly radius?: Radius;
  readonly disabled?: boolean;
  readonly haptic?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: ViewStyle;
}

export function IconButton({
  accessibilityLabel,
  onPress,
  icon,
  variant = 'plain',
  size,
  radius = 'full',
  disabled = false,
  haptic = true,
  accessibilityHint,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const dimension = Math.max(size ?? theme.minTouchTarget, theme.minTouchTarget);

  const surface: Record<NonNullable<IconButtonProps['variant']>, ViewStyle> = {
    plain: { backgroundColor: 'transparent' },
    filled: { backgroundColor: theme.colors.surfaceElevated },
    glass: {
      backgroundColor: theme.colors.glassFill,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
    },
  };

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      accessibilityState={{ disabled }}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: theme.radii[radius],
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        ...surface[variant],
        ...style,
      }}
    >
      {icon}
    </PressableScale>
  );
}
