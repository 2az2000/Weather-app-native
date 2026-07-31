import { View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Elevation, Radius, Spacing } from '@/theme';

/** Standard content surface. Opaque — see `GlassSurface` for translucent panels. */
export interface CardProps extends Omit<ViewProps, 'style'> {
  readonly padding?: Spacing;
  readonly radius?: Radius;
  readonly elevation?: Elevation;
  readonly bordered?: boolean;
  /** Layout only — colour and spacing come from props. */
  readonly style?: ViewStyle;
  readonly children: React.ReactNode;
}

export function Card({
  padding = 'base',
  radius = 'base',
  elevation = 'sm',
  bordered = false,
  style,
  children,
  ...rest
}: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          padding: theme.spacing[padding],
          borderRadius: theme.radii[radius],
          ...theme.shadow(elevation),
          ...(bordered ? { borderWidth: 1, borderColor: theme.colors.border } : {}),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
