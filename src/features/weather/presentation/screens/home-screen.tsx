import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useContainer } from '@/core/di';
import { asAppError } from '@/core/errors';
import {
  describePlace,
  useCurrentLocation,
  useSavedLocations,
  useSelectedLocationStore,
} from '@/features/locations';
import { usePreferencesStore } from '@/features/settings';
import { useHaptics } from '@/shared/hooks';
import { getWeatherPalette, useTheme } from '@/theme';

import { CurrentConditionsHero } from '../components/current-conditions-hero';
import { DailyForecastList } from '../components/daily-forecast-list';
import { DataAgeBanner } from '../components/data-age-banner';
import { HomeSkeleton } from '../components/home-skeleton';
import { HourlyStrip } from '../components/hourly-strip';
import { MetricGrid } from '../components/metric-grid';
import { SunMoonCard } from '../components/sun-moon-card';
import { WeatherBackground } from '../components/weather-background';
import { WeatherErrorState } from '../components/weather-error-state';
import { useForecast, useRefreshForecast } from '../hooks/use-forecast';
import { useWeatherAppearance } from '../hooks/use-weather-appearance';

/**
 * The sky shown before a location resolves.
 *
 * Comes from the theme's own palette function rather than literal colours —
 * hardcoding a gradient here would be exactly the drift CLAUDE.md §18 exists to
 * prevent. A plausible daytime sky beats a flash of white on the first frame of
 * a cold start, when there are no coordinates yet.
 */
const FALLBACK_PALETTE = getWeatherPalette('clear', 'day');

/**
 * The home screen.
 *
 * **Screens compose; components render** (CLAUDE.md §15 rule 3). This file calls
 * hooks and arranges the result — it contains no business logic, no unit
 * conversion, and no decision about what the weather means. Every such decision
 * lives in a use case or a domain service.
 *
 * It is also where several features are COMPOSED — weather, locations,
 * settings — which is exactly where cross-feature composition belongs
 * (CLAUDE.md §7 rule 5). Each is reached through its public barrel.
 */
export function HomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation('weather');
  const haptics = useHaptics();
  const { network } = useContainer();

  // ── Which place are we showing? ────────────────────────────────────────────
  const selectedId = useSelectedLocationStore((state) => state.selectedId);
  const savedLocations = useSavedLocations();
  const currentLocation = useCurrentLocation(selectedId === undefined);

  const place = useMemo(() => {
    if (selectedId === undefined) return currentLocation.data;
    return savedLocations.data?.find((location) => location.id === selectedId);
  }, [selectedId, savedLocations.data, currentLocation.data]);

  const coordinates = place?.coordinates;

  // ── Weather ────────────────────────────────────────────────────────────────
  const forecast = useForecast(coordinates);
  const { refresh, isRefreshing } = useRefreshForecast();

  // Derived from astronomy, so it is correct before any forecast arrives — the
  // background paints on the first frame rather than waiting (ADR-0008).
  const appearance = useWeatherAppearance(coordinates, forecast.data?.current.condition);

  const handleRefresh = useCallback(() => {
    if (coordinates === undefined) return;

    void refresh(coordinates).then(
      // Haptics are punctuation: bound to a completed refresh, never to the
      // scroll that triggered it (CLAUDE.md §20).
      () => {
        haptics.success();
      },
      () => {
        haptics.error();
      },
    );
  }, [coordinates, refresh, haptics]);

  const locale = usePreferencesStore((state) => state.locale);
  const unit = usePreferencesStore((state) => state.temperatureUnit);

  // Rendering never waits on connectivity — it only adjusts BEHAVIOUR
  // (CLAUDE.md §24 rule 2).
  const isOffline = !network.isOnline;

  const body = (() => {
    if (forecast.data !== undefined) {
      const { current, hourly, daily, fetchedAt } = forecast.data;

      return (
        <View style={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}>
          <CurrentConditionsHero
            conditions={current}
            today={daily.points[0]}
            locationName={place === undefined ? '' : describePlace(place)}
            locale={locale}
            unit={unit}
          />

          <View style={{ paddingHorizontal: theme.spacing.base }}>
            <DataAgeBanner fetchedAt={fetchedAt} isOffline={isOffline} locale={locale} />
          </View>

          {hourly.points.length > 0 && (
            <HourlyStrip
              points={hourly.points.slice(0, 24)}
              locale={locale}
              unit={unit}
            />
          )}

          <View style={{ paddingHorizontal: theme.spacing.base, gap: theme.spacing.xl }}>
            {daily.points.length > 0 && (
              <DailyForecastList
                points={daily.points.slice(0, 7)}
                locale={locale}
                unit={unit}
              />
            )}

            {appearance !== undefined && (
              <SunMoonCard sun={appearance.sun} moon={appearance.moon} locale={locale} />
            )}

            <MetricGrid conditions={current} locale={locale} unit={unit} />
          </View>
        </View>
      );
    }

    if (forecast.isError) {
      return (
        <WeatherErrorState
          error={asAppError(forecast.error)}
          onRetry={() => {
            void forecast.refetch();
          }}
        />
      );
    }

    return <HomeSkeleton />;
  })();

  return (
    <WeatherBackground palette={appearance?.palette ?? FALLBACK_PALETTE}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.textOnWeather}
              accessibilityLabel={t('a11y.refresh')}
            />
          }
        >
          {body}
        </ScrollView>
      </SafeAreaView>
    </WeatherBackground>
  );
}
