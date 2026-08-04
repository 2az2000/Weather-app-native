import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatTemperature, type Locale } from '@/core/i18n';
import type { TemperatureUnit } from '@/features/settings';
import { Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import type { CurrentConditions, DailyPoint } from '../../domain';

/**
 * The current temperature, as the screen's focal point.
 *
 * Presentational: it receives an entity and renders it. Unit conversion happens
 * HERE, at display time, driven by the user's preference — canonical Celsius is
 * what is stored and cached (CLAUDE.md §11).
 */
export interface CurrentConditionsHeroProps {
  readonly conditions: CurrentConditions;
  readonly today: DailyPoint | undefined;
  readonly locationName: string;
  readonly locale: Locale;
  readonly unit: TemperatureUnit;
}

export function CurrentConditionsHero({
  conditions,
  today,
  locationName,
  locale,
  unit,
}: CurrentConditionsHeroProps) {
  const theme = useTheme();
  const { t } = useTranslation('weather');

  const temperature = formatTemperature(conditions.temperature, locale, unit);
  const apparent = formatTemperature(conditions.apparentTemperature, locale, unit);
  const condition = t(`conditions.${conditions.condition}`);

  return (
    <View
      style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}
      // One label for the whole block: a screen reader reading five separate
      // fragments turns the focal point into a list (CLAUDE.md §15 rule 8).
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('a11y.currentConditions', {
        condition,
        temperature,
        apparent,
      })}
    >
      <Text size="callout" weight="medium" tone="onWeather" style={{ opacity: 0.9 }}>
        {locationName}
      </Text>

      <Text size="hero" weight="regular" tone="onWeather">
        {temperature}
      </Text>

      <Text size="headline" weight="medium" tone="onWeather" style={{ opacity: 0.95 }}>
        {condition}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.md,
          marginTop: theme.spacing.xs,
        }}
      >
        <Text size="body" tone="onWeather" style={{ opacity: 0.85 }}>
          {t('hero.feelsLike', { value: apparent })}
        </Text>

        {today !== undefined && (
          <Text size="body" tone="onWeather" style={{ opacity: 0.85 }}>
            {t('hero.highLow', {
              high: formatTemperature(today.temperatureMax, locale, unit),
              low: formatTemperature(today.temperatureMin, locale, unit),
            })}
          </Text>
        )}
      </View>
    </View>
  );
}
