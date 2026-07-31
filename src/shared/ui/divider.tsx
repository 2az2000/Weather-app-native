import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Spacing } from '@/theme';

export interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical';
  readonly inset?: Spacing;
  readonly style?: ViewStyle;
}

/**
 * Hairline separator.
 *
 * Inset uses LOGICAL margins (`marginStart`/`marginEnd`) so an inset divider
 * mirrors correctly in Persian — physical properties are banned by lint
 * (CLAUDE.md §19 rule 2).
 */
export function Divider({
  orientation = 'horizontal',
  inset = 'none',
  style,
}: DividerProps) {
  const theme = useTheme();
  const hairline = 1;

  return (
    <View
      accessibilityRole="none"
      importantForAccessibility="no"
      style={[
        orientation === 'horizontal'
          ? {
              height: hairline,
              alignSelf: 'stretch',
              marginStart: theme.spacing[inset],
              marginEnd: theme.spacing[inset],
            }
          : {
              width: hairline,
              alignSelf: 'stretch',
              marginTop: theme.spacing[inset],
              marginBottom: theme.spacing[inset],
            },
        { backgroundColor: theme.colors.separator },
        style,
      ]}
    />
  );
}
