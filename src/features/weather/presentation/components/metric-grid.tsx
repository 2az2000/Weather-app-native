import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatNumber, formatTemperature, type Locale } from '@/core/i18n';
import type { TemperatureUnit } from '@/features/settings';
import { GlassSurface, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import {
  toCompassPoint,
  toKilometers,
  toKilometersPerHour,
  type CurrentConditions,
} from '../../domain';

/**
 * The secondary metrics.
 *
 * Every conversion happens HERE, at display time. Values arrive in canonical
 * units — Celsius, m/s, hPa, metres — because that is what is cached, and
 * converting before storage would corrupt the cache the moment a preference
 * changed (CLAUDE.md §11).
 *
 * A metric the provider did not report is OMITTED rather than shown as zero:
 * an unknown dew point and a dew point of 0 °C are different facts.
 */
export interface MetricGridProps {
  readonly conditions: CurrentConditions;
  readonly locale: Locale;
  readonly unit: TemperatureUnit;
}

interface Metric {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}

export function MetricGrid({ conditions, locale, unit }: MetricGridProps) {
  const theme = useTheme();
  const { t } = useTranslation('weather');

  const metrics: Metric[] = [
    {
      key: 'feelsLike',
      label: t('metrics.feelsLike'),
      value: formatTemperature(conditions.apparentTemperature, locale, unit),
    },
    {
      key: 'humidity',
      label: t('metrics.humidity'),
      value: `${formatNumber(conditions.humidity, locale)}%`,
    },
    {
      key: 'wind',
      label: t('metrics.wind'),
      value: `${formatNumber(toKilometersPerHour(conditions.windSpeed), locale)} km/h`,
      // The compass point is NEVER mirrored under RTL — north is north in every
      // language (CLAUDE.md §19).
      detail: toCompassPoint(conditions.windDirection),
    },
    {
      key: 'pressure',
      label: t('metrics.pressure'),
      value: `${formatNumber(conditions.pressure, locale)} hPa`,
    },
    {
      key: 'cloudCover',
      label: t('metrics.cloudCover'),
      value: `${formatNumber(conditions.cloudCover, locale)}%`,
    },
  ];

  if (conditions.visibility !== undefined) {
    metrics.push({
      key: 'visibility',
      label: t('metrics.visibility'),
      value: `${formatNumber(toKilometers(conditions.visibility), locale, { maximumFractionDigits: 1 })} km`,
    });
  }

  if (conditions.dewPoint !== undefined) {
    metrics.push({
      key: 'dewPoint',
      label: t('metrics.dewPoint'),
      value: formatTemperature(conditions.dewPoint, locale, unit),
    });
  }

  if (conditions.uvIndex !== undefined) {
    metrics.push({
      key: 'uvIndex',
      label: t('metrics.uvIndex'),
      value: formatNumber(Math.round(conditions.uvIndex), locale),
      detail: t(`uv.${uvBand(conditions.uvIndex)}`),
    });
  }

  return (
    <View
      accessibilityRole="list"
      accessibilityLabel={t('sections.details')}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
      }}
    >
      {metrics.map((metric) => (
        <GlassSurface
          key={metric.key}
          padding="base"
          radius="lg"
          // Two per row with the gap accounted for. Percentage widths mirror
          // correctly without any physical positioning.
          style={{ flexGrow: 1, flexBasis: '47%' }}
        >
          <View
            accessible
            accessibilityLabel={t('a11y.metric', {
              label: metric.label,
              value:
                metric.detail === undefined
                  ? metric.value
                  : `${metric.value} ${metric.detail}`,
            })}
            style={{ gap: theme.spacing.xxs }}
          >
            <Text size="footnote" tone="onWeather" style={{ opacity: 0.75 }}>
              {metric.label}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: theme.spacing.xs,
              }}
            >
              <Text size="title3" weight="medium" tone="onWeather">
                {metric.value}
              </Text>

              {metric.detail !== undefined && (
                <Text size="footnote" tone="onWeather" style={{ opacity: 0.75 }}>
                  {metric.detail}
                </Text>
              )}
            </View>
          </View>
        </GlassSurface>
      ))}
    </View>
  );
}

/**
 * UV exposure band.
 *
 * Thresholds are the WHO/WMO Global Solar UV Index standard — the same bands
 * every weather service uses, so they are comparable across apps.
 *
 * @see https://www.who.int/publications/i/item/9241590076
 */
function uvBand(index: number): 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme' {
  if (index < 3) return 'low';
  if (index < 6) return 'moderate';
  if (index < 8) return 'high';
  if (index < 11) return 'veryHigh';
  return 'extreme';
}
