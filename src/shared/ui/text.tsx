import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useTheme } from '@/theme';
import type { FontSize, FontWeight } from '@/theme';

/**
 * The only way text is rendered in this app.
 *
 * Using `react-native`'s `Text` directly is a review blocker: it would bypass
 * script-aware font selection and line height, which is what makes Persian
 * render correctly rather than cramped (CLAUDE.md §18).
 */

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'onAccent'
  | 'onWeather'
  | 'disabled'
  | 'success'
  | 'warning'
  | 'danger';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  readonly size?: FontSize;
  readonly weight?: FontWeight;
  readonly tone?: TextTone;
  readonly align?: TextStyle['textAlign'];
  /** Escape hatch for layout only — colour and font must come from props. */
  readonly style?: TextStyle;
  readonly children: React.ReactNode;
}

export function Text({
  size = 'body',
  weight = 'regular',
  tone = 'primary',
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();

  const toneColor: Record<TextTone, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    onAccent: theme.colors.textOnAccent,
    onWeather: theme.colors.textOnWeather,
    disabled: theme.colors.textDisabled,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  };

  const fontSize = theme.fontSize[size];

  return (
    <RNText
      style={[
        {
          ...theme.font(weight),
          fontSize,
          // Script-aware: Persian needs ~12% more leading than Latin at the
          // same point size, or diacritics clip.
          lineHeight: theme.lineHeight(fontSize),
          color: toneColor[tone],
          // `auto` resolves to the layout direction, so text aligns correctly in
          // Persian without any `left`/`right` anywhere (CLAUDE.md §19 rule 2).
          textAlign: align ?? 'auto',
          writingDirection: theme.isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
