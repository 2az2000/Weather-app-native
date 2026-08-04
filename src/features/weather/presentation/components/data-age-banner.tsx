import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatRelativeTime, type Locale } from '@/core/i18n';
import { GlassSurface, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

/**
 * How old the data on screen is.
 *
 * **Stale data beats no data, PROVIDED its age is visible** (CLAUDE.md §24
 * rule 1). This banner is what makes that trade honest — without it, a
 * six-hour-old forecast is indistinguishable from a live one.
 *
 * Offline is a DESIGNED state, not an error: a calm informational treatment,
 * never the red of a failure (CLAUDE.md §24 rule 6).
 */
export interface DataAgeBannerProps {
  readonly fetchedAt: Date;
  readonly isOffline: boolean;
  readonly locale: Locale;
  /** Injected so a test can pin the age without faking timers. */
  readonly now?: Date;
}

export function DataAgeBanner({ fetchedAt, isOffline, locale, now }: DataAgeBannerProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');

  const age = formatRelativeTime(fetchedAt, locale, now ?? new Date());

  // Online and fresh needs no banner: chrome that says "everything is normal"
  // is noise the user learns to ignore.
  if (!isOffline) return null;

  return (
    <GlassSurface padding="md" radius="md">
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`${t('state.offline')}. ${t('state.updatedAt', { time: age })}`}
        style={{ gap: theme.spacing.xxs }}
      >
        <Text size="footnote" weight="medium" tone="onWeather">
          {t('state.offline')}
        </Text>
        <Text size="caption" tone="onWeather" style={{ opacity: 0.75 }}>
          {t('state.updatedAt', { time: age })}
        </Text>
      </View>
    </GlassSurface>
  );
}
