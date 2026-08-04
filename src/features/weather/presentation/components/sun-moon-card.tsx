import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatNumber, formatTime, type Locale } from '@/core/i18n';
import { GlassSurface, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import type { MoonInfo, SunTimes } from '../../domain';

/**
 * Sun times and moon phase.
 *
 * Everything here is computed on-device (ADR-0008), so this card renders
 * correctly with no network at all — including for a location whose forecast
 * has never been fetched.
 *
 * Polar day and polar night are REAL states, not failures: inside the Arctic
 * and Antarctic circles the sun genuinely does not cross the horizon, and the
 * card says so rather than showing a blank or a wrong time.
 */
export interface SunMoonCardProps {
  readonly sun: SunTimes;
  readonly moon: MoonInfo;
  readonly locale: Locale;
}

export function SunMoonCard({ sun, moon, locale }: SunMoonCardProps) {
  const theme = useTheme();
  const { t } = useTranslation('weather');

  const phase = t(`moon.${moon.phase}`);
  const illumination = `${formatNumber(Math.round(moon.illumination), locale)}%`;

  return (
    <GlassSurface padding="base" radius="lg">
      <View style={{ gap: theme.spacing.base }}>
        <Text size="footnote" weight="medium" tone="onWeather" style={{ opacity: 0.75 }}>
          {t('sections.sunAndMoon')}
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing.base }}>
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            {sun.polarState !== 'normal' ? (
              <Text size="body" tone="onWeather" style={{ opacity: 0.85 }}>
                {/* Which state applies is an astronomical determination, made
                    by the domain — a component guessing it from the absence of
                    a sunrise would get the southern hemisphere wrong. */}
                {t(sun.polarState === 'polarDay' ? 'sun.polarDay' : 'sun.polarNight')}
              </Text>
            ) : (
              <>
                <SunRow
                  label={t('sun.sunrise')}
                  time={sun.sunrise}
                  locale={locale}
                  fallback={t('sun.polarNight')}
                />
                <SunRow
                  label={t('sun.sunset')}
                  time={sun.sunset}
                  locale={locale}
                  fallback={t('sun.polarDay')}
                />
              </>
            )}
          </View>

          <View
            accessible
            accessibilityLabel={t('a11y.moonPhase', { phase, illumination })}
            style={{ flex: 1, gap: theme.spacing.xxs }}
          >
            <Text size="footnote" tone="onWeather" style={{ opacity: 0.75 }}>
              {t('moon.title')}
            </Text>
            <Text size="body" weight="medium" tone="onWeather">
              {phase}
            </Text>
            <Text size="footnote" tone="onWeather" style={{ opacity: 0.75 }}>
              {t('moon.illumination', { value: illumination })}
            </Text>
          </View>
        </View>
      </View>
    </GlassSurface>
  );
}

interface SunRowProps {
  readonly label: string;
  readonly time: Date | undefined;
  readonly locale: Locale;
  readonly fallback: string;
}

function SunRow({ label, time, locale, fallback }: SunRowProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${time === undefined ? fallback : formatTime(time, locale)}`}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
      }}
    >
      <Text size="footnote" tone="onWeather" style={{ opacity: 0.75 }}>
        {label}
      </Text>
      <Text size="body" weight="medium" tone="onWeather">
        {time === undefined ? fallback : formatTime(time, locale)}
      </Text>
    </View>
  );
}
