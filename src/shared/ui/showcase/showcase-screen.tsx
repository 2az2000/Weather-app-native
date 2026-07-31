import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  formatDate,
  formatRelativeTime,
  formatTemperature,
  formatTime,
  formatWeekday,
  LOCALE_META,
  type Locale,
} from '@/core/i18n';
import {
  getWeatherPalette,
  ThemeProvider,
  useTheme,
  WEATHER_CONDITIONS,
  type ColorScheme,
  type TimeOfDay,
} from '@/theme';

import { Button } from '../button';
import { Card } from '../card';
import { Divider } from '../divider';
import { GlassSurface } from '../glass-surface';
import { IconButton } from '../icon-button';
import { Skeleton, SkeletonText } from '../skeleton';
import { Text } from '../text';

/**
 * Development-only component gallery.
 *
 * ROADMAP Phase 2 asks for every primitive rendered in all four locale × theme
 * combinations. Automated tests assert BEHAVIOUR (roles, labels, line heights);
 * this exists for the half no test can cover — whether Persian text sits
 * comfortably, whether dark-mode contrast actually reads, whether a glass panel
 * looks right over a night sky.
 *
 * Reachable at `/showcase` in development only.
 */

const SAMPLE_DATE = new Date();

/** Fixed at module load: calling `Date.now()` during render is impure. */
const SAMPLE_RECENT = new Date(SAMPLE_DATE.getTime() - 12 * 60_000);

export function ShowcaseScreen() {
  const [scheme, setScheme] = useState<ColorScheme>('light');
  const [locale, setLocale] = useState<Locale>('en');

  const meta = LOCALE_META[locale];

  return (
    <ThemeProvider scheme={scheme} script={meta.script} isRTL={meta.isRTL}>
      <ShowcaseBody
        scheme={scheme}
        locale={locale}
        onToggleScheme={() => {
          setScheme((current) => (current === 'light' ? 'dark' : 'light'));
        }}
        onToggleLocale={() => {
          setLocale((current) => (current === 'en' ? 'fa' : 'en'));
        }}
      />
    </ThemeProvider>
  );
}

interface ShowcaseBodyProps {
  readonly scheme: ColorScheme;
  readonly locale: Locale;
  readonly onToggleScheme: () => void;
  readonly onToggleLocale: () => void;
}

function ShowcaseBody({
  scheme,
  locale,
  onToggleScheme,
  onToggleLocale,
}: ShowcaseBodyProps) {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.base, gap: theme.spacing.xl }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text size="title2" weight="bold">
          Component gallery
        </Text>
        <Text size="footnote" tone="secondary">
          {`${scheme} · ${LOCALE_META[locale].nativeName} · ${
            theme.isRTL ? 'RTL' : 'LTR'
          }`}
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button label="Toggle theme" onPress={onToggleScheme} size="small" />
          <Button
            label="Toggle language"
            onPress={onToggleLocale}
            size="small"
            variant="secondary"
          />
        </View>
      </View>

      <Section title="Typography">
        <Text size="hero" weight="bold">
          {formatTemperature(21.4, locale)}
        </Text>
        <Text size="title1">Title</Text>
        <Text size="headline" weight="semibold">
          Headline
        </Text>
        <Text size="body">
          {locale === 'fa'
            ? 'آسمان صاف با وزش باد ملایم از سمت شمال غربی.'
            : 'Clear skies with a light breeze from the north-west.'}
        </Text>
        <Text size="footnote" tone="secondary">
          Secondary footnote
        </Text>
        <Text size="caption" tone="tertiary">
          Tertiary caption
        </Text>
      </Section>

      <Section title="Locale formatting">
        <Row label="Date">{formatDate(SAMPLE_DATE, locale)}</Row>
        <Row label="Weekday">{formatWeekday(SAMPLE_DATE, locale, false)}</Row>
        <Row label="Time">{formatTime(SAMPLE_DATE, locale)}</Row>
        <Row label="Temperature">{formatTemperature(-3.6, locale)}</Row>
        <Row label="Relative">{formatRelativeTime(SAMPLE_RECENT, locale)}</Row>
      </Section>

      <Section title="Buttons">
        <Button label="Primary" onPress={noop} />
        <Button label="Secondary" onPress={noop} variant="secondary" />
        <Button label="Ghost" onPress={noop} variant="ghost" />
        <Button label="Danger" onPress={noop} variant="danger" />
        <Button label="Loading" onPress={noop} loading />
        <Button label="Disabled" onPress={noop} disabled />

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <IconButton
            accessibilityLabel="Refresh"
            onPress={noop}
            icon={<Text tone="accent">↻</Text>}
          />
          <IconButton
            accessibilityLabel="Add location"
            onPress={noop}
            variant="filled"
            icon={<Text tone="accent">+</Text>}
          />
        </View>
      </Section>

      <Section title="Surfaces">
        <Card>
          <Text>Card · resting</Text>
        </Card>
        <Card elevation="lg" bordered>
          <Text>Card · elevated and bordered</Text>
        </Card>
        <Divider />
        <Text size="footnote" tone="tertiary">
          Divider above
        </Text>
      </Section>

      <Section title="Glass over weather">
        {(['clear', 'rain', 'snow'] as const).map((condition) => (
          <WeatherSample key={condition} condition={condition} timeOfDay="day" />
        ))}
        <WeatherSample condition="clear" timeOfDay="night" />
        <WeatherSample condition="thunderstorm" timeOfDay="dusk" />
      </Section>

      <Section title="Loading">
        <Skeleton height={theme.fontSize.title1} width="50%" />
        <SkeletonText lines={3} />
      </Section>

      <Section title="Every weather palette">
        {WEATHER_CONDITIONS.map((condition) => (
          <View key={condition} style={{ gap: theme.spacing.xs }}>
            <Text size="caption" tone="tertiary">
              {condition}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.xxs }}>
              {(['dawn', 'day', 'dusk', 'night'] as const).map((time) => (
                <LinearGradient
                  key={time}
                  colors={[...getWeatherPalette(condition, time).gradient]}
                  style={{ flex: 1, height: 40, borderRadius: theme.radii.sm }}
                />
              ))}
            </View>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text size="footnote" weight="semibold" tone="tertiary">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Row({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.base,
      }}
    >
      <Text size="footnote" tone="secondary">
        {label}
      </Text>
      <Text size="footnote" weight="medium">
        {children}
      </Text>
    </View>
  );
}

function WeatherSample({
  condition,
  timeOfDay,
}: {
  readonly condition: (typeof WEATHER_CONDITIONS)[number];
  readonly timeOfDay: TimeOfDay;
}) {
  const theme = useTheme();
  const palette = getWeatherPalette(condition, timeOfDay);

  return (
    <LinearGradient
      colors={[...palette.gradient]}
      style={{ padding: theme.spacing.base, borderRadius: theme.radii.lg }}
    >
      <GlassSurface>
        <Text
          size="footnote"
          weight="semibold"
          tone={palette.prefersLightContent ? 'onWeather' : 'primary'}
        >
          {`${condition} · ${timeOfDay}`}
        </Text>
      </GlassSurface>
    </LinearGradient>
  );
}

const noop = (): void => undefined;
