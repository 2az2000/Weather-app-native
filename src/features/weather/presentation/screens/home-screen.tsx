import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useContainer } from '@/core/di';
import { asAppError } from '@/core/errors';
import {
  describePlace,
  useCurrentLocation,
  useLocationPermission,
  useSavedLocations,
  useSelectedLocationStore,
} from '@/features/locations';
import { usePreferencesStore } from '@/features/settings';
import { useHaptics } from '@/shared/hooks';
import { IconButton, Text } from '@/shared/ui';
import { getWeatherPalette, useTheme } from '@/theme';

import { AwaitingLocation } from '../components/awaiting-location';
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
  const router = useRouter();
  const { network } = useContainer();

  // ── Which place are we showing? ────────────────────────────────────────────
  const selectedId = useSelectedLocationStore((state) => state.selectedId);
  const savedLocations = useSavedLocations();

  const selectedPlace = useMemo(
    () =>
      selectedId === undefined
        ? undefined
        : savedLocations.data?.find((location) => location.id === selectedId),
    [selectedId, savedLocations.data],
  );

  // A selection can outlive the location it points at — removed on another
  // screen, or dropped when the database was rebuilt. Following the device
  // instead is self-healing; the alternative is a screen that waits forever for
  // a place that no longer exists.
  const followsDevice =
    selectedId === undefined ||
    (savedLocations.data !== undefined && selectedPlace === undefined);

  const currentLocation = useCurrentLocation(followsDevice);

  const place = followsDevice ? currentLocation.data : selectedPlace;
  const coordinates = place?.coordinates;

  // ── Location access ────────────────────────────────────────────────────────
  // Asked automatically, once, on the first launch — this screen is useless
  // without a position, and a weather app asking on open is what users expect.
  // Not asked at all when a saved city is being shown: that view needs no GPS,
  // so prompting for it would be an interruption with no purpose.
  const permission = useLocationPermission({ autoRequest: followsDevice });

  /**
   * Why we have no position, if we have none.
   *
   * A permission refusal surfaces here too, as `kind: 'permissionDenied'`.
   * `AwaitingLocation` checks the permission status FIRST and never reaches
   * this, because a refusal deserves the prompt that can undo it rather than an
   * error screen offering a retry that would fail identically.
   */
  const locationError = followsDevice
    ? currentLocation.isError
      ? asAppError(currentLocation.error)
      : undefined
    : savedLocations.isError
      ? asAppError(savedLocations.error)
      : undefined;

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
              onPress={
                coordinates === undefined
                  ? undefined
                  : () => {
                      router.push({
                        pathname: '/weather/hourly',
                        params: {
                          latitude: String(coordinates.latitude),
                          longitude: String(coordinates.longitude),
                        },
                      });
                    }
              }
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

    // Checked BEFORE the forecast's own states, because with no coordinates the
    // forecast query is disabled: it is neither loading nor failed, it simply
    // never runs. Falling through to a skeleton here is what left the screen
    // loading forever when location access had not been granted.
    if (coordinates === undefined) {
      return (
        <AwaitingLocation
          permissionStatus={permission.status}
          isRequestingPermission={permission.isRequesting}
          onRequestPermission={() => {
            void permission.request();
          }}
          error={locationError}
          onRetry={() => {
            void currentLocation.refetch();
          }}
        />
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

    // Reached only with coordinates in hand, so the forecast really is in
    // flight. A skeleton now means something is actually happening.
    return <HomeSkeleton />;
  })();

  return (
    <WeatherBackground palette={appearance?.palette ?? FALLBACK_PALETTE}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Outside the ScrollView so it is reachable in EVERY state — including
            the one where location was refused. Without a way to reach the city
            search from here, declining GPS would leave the app with nothing the
            user could do next. */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: theme.spacing.sm,
          }}
        >
          <IconButton
            accessibilityLabel={t('a11y.changeLocation')}
            onPress={() => {
              router.push('/locations');
            }}
            variant="glass"
            icon={<Text tone="onWeather">☰</Text>}
          />
        </View>

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
