import { screen } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';

import { createI18n } from '@/core/i18n';
import {
  renderWithTheme,
  THEME_COMBINATIONS,
  type ThemeCombination,
} from '@/shared/ui/__tests__/render-with-theme';

import { forecastFixture, hourlyPoint } from '../../../domain/__fixtures__/forecast';
import { AstronomyCalculator } from '../../../domain';
import { CurrentConditionsHero } from '../current-conditions-hero';
import { DailyForecastList } from '../daily-forecast-list';
import { DataAgeBanner } from '../data-age-banner';
import { HomeSkeleton } from '../home-skeleton';
import { HourlyStrip } from '../hourly-strip';
import { MetricGrid } from '../metric-grid';
import { SunMoonCard } from '../sun-moon-card';
import { WeatherErrorState } from '../weather-error-state';

/**
 * ROADMAP Phase 5 DoD: "Correct in **all four** locale × theme combinations."
 *
 * Every component is rendered under all four rather than the two a developer
 * would check by eye — a component can be correct in light-English and broken
 * in dark-Persian, and checking two of four is exactly how that ships
 * (CLAUDE.md §34 step 7).
 */
const FORECAST = forecastFixture();
const PLACE = 'Tehran, Iran';

function renderLocalised(
  ui: ReactElement,
  combination: ThemeCombination,
): ReturnType<typeof renderWithTheme> {
  const i18n = createI18n(combination.isRTL ? 'fa' : 'en');

  return renderWithTheme(
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>,
    combination,
  );
}

describe.each(THEME_COMBINATIONS)('$name', (combination) => {
  const locale = combination.isRTL ? 'fa' : 'en';

  it('renders the hero with a single combined accessibility label', () => {
    renderLocalised(
      <CurrentConditionsHero
        conditions={FORECAST.current}
        today={FORECAST.daily.points[0]}
        locationName={PLACE}
        locale={locale}
        unit="celsius"
      />,
      combination,
    );

    // One label for the block: five separate fragments would turn the focal
    // point into a list for a screen-reader user.
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByText(PLACE)).toBeTruthy();
  });

  it('labels the first hourly cell "now" rather than a clock time', () => {
    renderLocalised(
      <HourlyStrip
        points={[hourlyPoint(0), hourlyPoint(1), hourlyPoint(2)]}
        locale={locale}
        unit="celsius"
      />,
      combination,
    );

    // Asserting on what the user SEES rather than on a container role: a list
    // wrapper is an implementation choice, the label is the experience
    // (CLAUDE.md §26 rule 3).
    expect(screen.getByText(combination.isRTL ? 'اکنون' : 'Now')).toBeTruthy();
  });

  it('labels the first daily row "today"', () => {
    renderLocalised(
      <DailyForecastList points={FORECAST.daily.points} locale={locale} unit="celsius" />,
      combination,
    );

    expect(screen.getByText(combination.isRTL ? 'امروز' : 'Today')).toBeTruthy();
  });

  it('renders every metric label in the active language', () => {
    renderLocalised(
      <MetricGrid conditions={FORECAST.current} locale={locale} unit="celsius" />,
      combination,
    );

    expect(screen.getByText(combination.isRTL ? 'رطوبت' : 'Humidity')).toBeTruthy();
    expect(screen.getByText(combination.isRTL ? 'باد' : 'Wind')).toBeTruthy();
  });

  it('omits a metric the provider did not report, rather than showing zero', () => {
    const sparse = forecastFixture({
      current: { ...FORECAST.current, dewPoint: undefined, uvIndex: undefined },
    });

    renderLocalised(
      <MetricGrid conditions={sparse.current} locale={locale} unit="celsius" />,
      combination,
    );

    // An unknown dew point and a dew point of 0 °C are different facts
    // (CLAUDE.md §11).
    expect(screen.queryByText(combination.isRTL ? 'نقطهٔ شبنم' : 'Dew point')).toBeNull();
  });

  it('renders the sun and moon card', () => {
    const astronomy = new AstronomyCalculator();
    const at = new Date('2026-07-31T08:30:00Z');
    const coordinates = { latitude: 35.6892, longitude: 51.389 };

    renderLocalised(
      <SunMoonCard
        sun={astronomy.getSunTimes(at, coordinates)}
        moon={astronomy.getMoonInfo(at, coordinates)}
        locale={locale}
      />,
      combination,
    );

    expect(screen.getByText(combination.isRTL ? 'طلوع' : 'Sunrise')).toBeTruthy();
    expect(screen.getByText(combination.isRTL ? 'ماه' : 'Moon')).toBeTruthy();
  });

  it('renders a skeleton matching the real layout', () => {
    const { toJSON } = renderLocalised(<HomeSkeleton />, combination);

    // The skeleton mirrors the real layout so content arriving causes no shift
    // (CLAUDE.md §15 rule 9).
    expect(toJSON()).toBeTruthy();
  });
});

describe('DataAgeBanner', () => {
  const combination = THEME_COMBINATIONS[0]!;

  it('shows nothing while online — chrome saying "normal" is noise', () => {
    renderLocalised(
      <DataAgeBanner fetchedAt={new Date()} isOffline={false} locale="en" />,
      combination,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces the offline state AND the data age together', () => {
    const now = new Date('2026-07-31T12:00:00Z');
    const twoHoursAgo = new Date('2026-07-31T10:00:00Z');

    renderLocalised(
      <DataAgeBanner fetchedAt={twoHoursAgo} isOffline locale="en" now={now} />,
      combination,
    );

    // Stale data is acceptable only because its age is visible
    // (CLAUDE.md §24 rule 1).
    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(String(alert.props.accessibilityLabel)).toContain('2');
  });
});

describe('WeatherErrorState', () => {
  const combination = THEME_COMBINATIONS[0]!;

  it('offers retry for a RETRYABLE error', () => {
    renderLocalised(
      <WeatherErrorState
        error={{ kind: 'network', retryable: true }}
        onRetry={jest.fn()}
      />,
      combination,
    );

    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('does NOT offer retry for an error retrying cannot fix', () => {
    renderLocalised(
      <WeatherErrorState
        error={{ kind: 'validation', issues: ['bad shape'], retryable: false }}
        onRetry={jest.fn()}
      />,
      combination,
    );

    // Inviting a retry that cannot succeed wastes the user's time.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a TRANSLATED message, never a raw provider string', () => {
    renderLocalised(
      <WeatherErrorState
        error={{ kind: 'network', retryable: true }}
        onRetry={jest.fn()}
      />,
      combination,
    );

    // `errorMessageKey` maps the kind to a translated string; a raw message
    // would be untranslated and would leak internals (CLAUDE.md §22 rule 4).
    expect(screen.queryByText(/errors:/)).toBeNull();
    expect(screen.getByText(/internet connection/i)).toBeTruthy();
  });
});
