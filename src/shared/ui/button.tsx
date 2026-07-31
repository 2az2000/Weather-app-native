import { ActivityIndicator, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/**
 * Primary action control.
 *
 * `accessibilityLabel` is REQUIRED rather than optional and must arrive already
 * translated — an untranslated or missing label is invisible in a visual review
 * but is the entire experience for a screen-reader user (CLAUDE.md §15 rule 8).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly fullWidth?: boolean;
  /** Translated. Defaults to `label`, which is already translated by the caller. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isInactive = disabled || loading;

  const height = { small: 36, medium: 44, large: 52 }[size];
  const paddingHorizontal = {
    small: theme.spacing.md,
    medium: theme.spacing.base,
    large: theme.spacing.xl,
  }[size];
  const textSize = { small: 'footnote', medium: 'body', large: 'callout' } as const;

  const surface: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: theme.colors.accent },
    secondary: {
      backgroundColor: theme.colors.accentSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: theme.colors.danger },
  };

  const tone = {
    primary: 'onAccent',
    secondary: 'accent',
    ghost: 'accent',
    danger: 'onAccent',
  } as const;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isInactive}
      haptic
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={{
        // Never below the 44pt floor, whatever `size` asks for.
        minHeight: Math.max(height, theme.minTouchTarget),
        paddingHorizontal,
        borderRadius: theme.radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isInactive ? 0.5 : 1,
        ...(fullWidth ? { alignSelf: 'stretch' } : {}),
        ...surface[variant],
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'danger'
              ? theme.colors.textOnAccent
              : theme.colors.accent
          }
        />
      ) : (
        <View>
          <Text size={textSize[size]} weight="semibold" tone={tone[variant]}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}
