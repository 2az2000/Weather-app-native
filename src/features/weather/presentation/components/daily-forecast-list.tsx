import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatTemperature, formatWeekday, type Locale } from '@/core/i18n';
import type { TemperatureUnit } from '@/features/settings';
import { Divider, GlassSurface, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import type { DailyPoint } from '../../domain';

/**
 * The multi-day forecast.
 *
 * A short, bounded list rendered with `map` rather than FlashList: CLAUDE.md §21
 * mandates FlashList for DYNAMIC lists, and seven fixed rows inside a scroll
 * view is not one — virtualising it would add a nested scroll container for no
 * gain.
 */
export interface DailyForecastListProps {
  readonly points: readonly DailyPoint[];
  readonly locale: Locale;
  readonly unit: TemperatureUnit;
}

export function DailyForecastList({ points, locale, unit }: DailyForecastListProps) {
  const { t } = useTranslation('weather');

  // The range across the whole week, so every bar shares one scale. Computing
  // it per row would make each bar full-width and meaningless.
  const weekMin = Math.min(...points.map((point) => point.temperatureMin));
  const weekMax = Math.max(...points.map((point) => point.temperatureMax));

  return (
    <GlassSurface padding="none" radius="lg">
      <View
        accessibilityRole="list"
        accessibilityLabel={t('sections.daily', { count: points.length })}
      >
        {points.map((point, index) => (
          <View key={point.date.toISOString()}>
            {index > 0 && <Divider inset="base" />}
            <DailyRow
              point={point}
              isToday={index === 0}
              weekMin={weekMin}
              weekMax={weekMax}
              locale={locale}
              unit={unit}
            />
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

interface DailyRowProps {
  readonly point: DailyPoint;
  readonly isToday: boolean;
  readonly weekMin: number;
  readonly weekMax: number;
  readonly locale: Locale;
  readonly unit: TemperatureUnit;
}

const DailyRow = memo(function DailyRow({
  point,
  isToday,
  weekMin,
  weekMax,
  locale,
  unit,
}: DailyRowProps) {
  const theme = useTheme();
  const { t } = useTranslation('weather');

  const day = isToday ? t('today') : formatWeekday(point.date, locale);
  const high = formatTemperature(point.temperatureMax, locale, unit);
  const low = formatTemperature(point.temperatureMin, locale, unit);
  const condition = t(`conditions.${point.condition}`);

  const span = weekMax - weekMin || 1;
  const startFraction = (point.temperatureMin - weekMin) / span;
  const widthFraction = (point.temperatureMax - point.temperatureMin) / span;

  return (
    <View
      accessible
      accessibilityLabel={t('a11y.dailyPoint', { day, condition, high, low })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
      }}
    >
      <Text
        size="body"
        weight={isToday ? 'semibold' : 'regular'}
        tone="onWeather"
        style={{ width: 56 }}
      >
        {day}
      </Text>

      <Text size="footnote" tone="onWeather" style={{ opacity: 0.75, flex: 1 }}>
        {condition}
      </Text>

      <Text size="body" tone="onWeather" style={{ opacity: 0.75 }}>
        {low}
      </Text>

      {/* The temperature range bar. Decorative — the numbers either side carry
          the same information, so it is hidden from screen readers rather than
          announced as a meaningless view (CLAUDE.md §20). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 64,
          height: 4,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.glassBorder,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            // Logical inset so the bar fills from the correct edge in Persian.
            marginStart: `${startFraction * 100}%`,
            width: `${Math.max(widthFraction * 100, 8)}%`,
            height: '100%',
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.textOnWeather,
          }}
        />
      </View>

      <Text size="body" weight="semibold" tone="onWeather">
        {high}
      </Text>
    </View>
  );
});
