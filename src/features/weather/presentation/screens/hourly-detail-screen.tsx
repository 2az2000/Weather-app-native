import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useContainer } from '@/core/di';
import { asAppError } from '@/core/errors';
import { formatTemperature, formatTime } from '@/core/i18n';
import { usePreferencesStore } from '@/features/settings';
import type { Coordinates } from '@/shared/types';
import { Card, IconButton, SkeletonText, Text } from '@/shared/ui';
import { LineChart } from '@/shared/ui/charts';
import type { ChartPoint } from '@/shared/utils';
import { useTheme } from '@/theme';

import type { HourlyPoint } from '../../domain';
import { WeatherErrorState } from '../components/weather-error-state';
import { useHourlyForecast } from '../hooks/use-forecast';

/**
 * The hourly detail screen — the temperature chart behind "hourly forecast"
 * (ROADMAP Phase 6).
 *
 * Reached by coordinates alone, not a serialized forecast: this screen calls
 * `useHourlyForecast` itself, exactly as `HomeScreen` does. TanStack Query
 * already holds the data under the same key, so this resolves from cache
 * instantly in the common case — the alternative, passing the whole forecast
 * through route params, would mean re-serializing dozens of `Date` and
 * branded-unit fields through a URL string for no benefit.
 */
export interface HourlyDetailScreenParams {
  readonly latitude: number;
  readonly longitude: number;
}

export function HourlyDetailScreen({ latitude, longitude }: HourlyDetailScreenParams) {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation(['weather', 'common']);
  const { network } = useContainer();

  const locale = usePreferencesStore((state) => state.locale);
  const unit = usePreferencesStore((state) => state.temperatureUnit);

  const coordinates: Coordinates = { latitude, longitude };
  const hourly = useHourlyForecast(coordinates, 24);
  const points: readonly HourlyPoint[] = hourly.data ?? [];

  // The index scrubbed to, not the point itself: `LineChart` reports points by
  // the same `x` it was given, and an index is trivial and unambiguous to
  // resolve back to an `HourlyPoint` — no `indexOf`, no reference-equality
  // assumption about a value that passed through the chart's own state.
  const [scrubbedIndex, setScrubbedIndex] = useState<number | undefined>(undefined);
  const displayedIndex = scrubbedIndex ?? 0;
  const displayed = points[displayedIndex];

  const chartPoints: readonly ChartPoint[] = points.map((point, index) => ({
    x: index,
    y: point.temperature,
  }));

  const temperatures = points.map((point) => point.temperature);
  const chartAccessibilityLabel =
    temperatures.length === 0
      ? t('sections.hourly')
      : t('a11y.hourlyChart', {
          low: formatTemperature(Math.min(...temperatures), locale, unit),
          high: formatTemperature(Math.max(...temperatures), locale, unit),
        });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.sm,
        }}
      >
        <IconButton
          accessibilityLabel={t('common:a11y.back')}
          onPress={() => {
            router.back();
          }}
          variant="plain"
          icon={<Text tone="primary">{theme.isRTL ? '→' : '←'}</Text>}
        />
        <Text size="title3" weight="bold">
          {t('sections.hourly')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.base, gap: theme.spacing.lg }}
      >
        {hourly.isLoading && points.length === 0 ? (
          <SkeletonText lines={6} />
        ) : hourly.isError ? (
          <WeatherErrorState
            error={asAppError(hourly.error)}
            onRetry={() => {
              void hourly.refetch();
            }}
          />
        ) : (
          <>
            <Card padding="lg" style={{ gap: theme.spacing.base }}>
              <View>
                <Text size="title1" weight="bold">
                  {displayed !== undefined
                    ? formatTemperature(displayed.temperature, locale, unit)
                    : '—'}
                </Text>
                <Text size="footnote" tone="secondary">
                  {displayed !== undefined
                    ? displayedIndex === 0
                      ? t('now')
                      : formatTime(displayed.time, locale)
                    : ''}
                  {displayed !== undefined
                    ? ` · ${t(`conditions.${displayed.condition}`)}`
                    : ''}
                </Text>
              </View>

              <LineChart
                points={chartPoints}
                color={theme.colors.accent}
                height={200}
                accessibilityLabel={chartAccessibilityLabel}
                formatValue={(value) => formatTemperature(value, locale, unit)}
                onScrub={(point) => {
                  setScrubbedIndex(point?.x);
                }}
              />
            </Card>

            {!network.isOnline && (
              <Text size="footnote" tone="secondary" align="center">
                {t('common:state.offline')}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
