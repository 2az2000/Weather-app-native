import { FlashList } from '@shopify/flash-list';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatTemperature, formatTime, type Locale } from '@/core/i18n';
import type { TemperatureUnit } from '@/features/settings';
import { GlassSurface, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import type { HourlyPoint } from '../../domain';

/**
 * The horizontal hourly forecast.
 *
 * ⚠️ **ADR-0006 trap #3 has changed shape.** That ADR prescribed setting
 * `inverted` from `isRTL` — but **FlashList v2 removed the `inverted` prop
 * entirely**, so that workaround no longer compiles.
 *
 * The current correct handling is to rely on the platform: React Native's
 * native scroll view mirrors a HORIZONTAL list automatically when
 * `I18nManager.isRTL` is set, so the first item lands on the right and the
 * initial offset is already at that end. Inverting on top of that would
 * DOUBLE-flip and put the strip back into English order.
 *
 * The per-item spacing still needs explicit care, which is why the cell below
 * uses `marginEnd` rather than a physical margin.
 *
 * ⚠️ **Needs on-device confirmation in Persian** — it is the one part of this
 * that a unit test cannot prove, and it is carried as an open item.
 *
 * FlashList v2 also measures items itself; `estimatedItemSize` was removed and
 * passing it is a type error (CLAUDE.md §21).
 */
export interface HourlyStripProps {
  readonly points: readonly HourlyPoint[];
  readonly locale: Locale;
  readonly unit: TemperatureUnit;
}

export function HourlyStrip({ points, locale, unit }: HourlyStripProps) {
  const theme = useTheme();
  const { t } = useTranslation('weather');

  return (
    <View accessibilityRole="list" accessibilityLabel={t('sections.hourly')}>
      <FlashList
        horizontal
        data={[...points]}
        keyExtractor={(point) => point.time.toISOString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.base }}
        renderItem={({ item, index }) => (
          <HourCell point={item} isFirst={index === 0} locale={locale} unit={unit} />
        )}
      />
    </View>
  );
}

interface HourCellProps {
  readonly point: HourlyPoint;
  readonly isFirst: boolean;
  readonly locale: Locale;
  readonly unit: TemperatureUnit;
}

/**
 * Memoised: this renders inside a scrolling list, which is exactly where
 * `React.memo` earns its cost (CLAUDE.md §21).
 */
const HourCell = memo(function HourCell({ point, isFirst, locale, unit }: HourCellProps) {
  const theme = useTheme();
  const { t } = useTranslation('weather');

  const time = isFirst ? t('now') : formatTime(point.time, locale);
  const temperature = formatTemperature(point.temperature, locale, unit);
  const condition = t(`conditions.${point.condition}`);

  return (
    <GlassSurface
      padding="md"
      radius="lg"
      style={{
        // Logical margin: mirrors correctly in Persian. `marginRight` is banned
        // by lint (CLAUDE.md §19 rule 2).
        marginEnd: theme.spacing.sm,
        minWidth: 72,
        alignItems: 'center',
      }}
    >
      <View
        accessible
        accessibilityLabel={t('a11y.hourlyPoint', { time, condition, temperature })}
        style={{ alignItems: 'center', gap: theme.spacing.xs }}
      >
        <Text size="footnote" tone="onWeather" style={{ opacity: 0.85 }}>
          {time}
        </Text>
        <Text size="callout" weight="semibold" tone="onWeather">
          {temperature}
        </Text>
      </View>
    </GlassSurface>
  );
});
