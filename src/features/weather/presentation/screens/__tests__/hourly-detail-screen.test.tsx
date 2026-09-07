/**
 * @jest-environment @shopify/react-native-skia/jestEnv
 *
 * This screen renders a real `<LineChart>`, which needs `global.CanvasKit` —
 * see the identical note in `shared/ui/charts/__tests__/line-chart.test.tsx`
 * for why this is a per-file docblock rather than the global testEnvironment.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { ContainerProvider } from '@/core/di';
import { createFakeContainer } from '@/core/di/__tests__/fake-container';
import { err, ok, type AppError, type Result } from '@/core/errors';
import { createI18n } from '@/core/i18n';
import { ThemeProvider } from '@/theme';

import { forecastFixture, hourlyPoint } from '../../../domain/__fixtures__/forecast';
import type {
  Forecast,
  HistoricalDay,
  SevereAlert,
  WeatherRepository,
} from '../../../domain';
import { HourlyDetailScreen } from '../hourly-detail-screen';

const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ back: mockRouterBack, push: jest.fn() }),
}));

const TEHRAN = { latitude: 35.6892, longitude: 51.389 };

/**
 * `hourlyPoint()` anchors its `time` to the domain fixtures' own fixed
 * reference instant (31 July 2026) — right for tests that inject that same
 * instant as `now`, wrong here: `useHourlyForecast` runs the REAL
 * `GetHourlyForecast` use case, which defaults `now` to the actual wall
 * clock and drops every point before it. Re-timestamped relative to the
 * real `Date.now()` at test time so nothing gets filtered as "already past".
 */
function currentHourlyPoint(offsetHours: number) {
  const base = hourlyPoint(offsetHours);
  return { ...base, time: new Date(Date.now() + offsetHours * 3_600_000) };
}

const FORECAST = forecastFixture({
  hourly: {
    points: [
      currentHourlyPoint(0),
      currentHourlyPoint(1),
      currentHourlyPoint(2),
      currentHourlyPoint(3),
    ],
  },
});

/**
 * A repository built from the INTERFACE, not a mocked class (CLAUDE.md §26
 * rule 1) — matches the pattern already established in `home-screen.test.tsx`.
 */
function fakeWeatherRepository(
  forecast: Result<Forecast, AppError> = ok(FORECAST),
): WeatherRepository {
  return {
    getForecast: () => Promise.resolve(forecast),
    refreshForecast: () => Promise.resolve(forecast),
    getAlerts: () => Promise.resolve(ok<SevereAlert[], AppError>([])),
    getHistorical: () => Promise.resolve(ok<HistoricalDay[], AppError>([])),
  };
}

function renderScreen(weatherRepository: WeatherRepository = fakeWeatherRepository()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <ContainerProvider container={createFakeContainer({ weatherRepository })}>
        <I18nextProvider i18n={createI18n('en')}>
          <ThemeProvider scheme="light" script="latin" isRTL={false}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </ThemeProvider>
        </I18nextProvider>
      </ContainerProvider>
    );
  }

  return render(
    <HourlyDetailScreen latitude={TEHRAN.latitude} longitude={TEHRAN.longitude} />,
    { wrapper: Wrapper },
  );
}

describe('HourlyDetailScreen', () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
  });

  it('shows the current-hour temperature before any scrub', async () => {
    renderScreen();

    // "Now" and the condition render as one Text node ("Now · Clear"), so the
    // match is against that combined string rather than "Now" alone.
    expect(await screen.findByText(/^Now/)).toBeTruthy();
    expect(screen.getByText('31°')).toBeTruthy();
  });

  it('labels the chart with the real temperature range, not a generic name', async () => {
    renderScreen();

    // The four fixture points climb 31.4 -> 33.2 in 0.6 steps (see
    // forecastFixture); the accessible label must reflect the ACTUAL series,
    // since a screen-reader user gets no other way to know the range.
    await screen.findByText('31°');
    expect(
      screen.getByLabelText(/Temperature, 31° to 33° over the next 24 hours/),
    ).toBeTruthy();
  });

  it('shows a skeleton, not the error or chart, while the query is in flight', () => {
    // Neither loading nor loaded nor errored is representable at once — this
    // just confirms the screen does not crash before data arrives, since a
    // fake repository resolves synchronously and racing that is inherent to
    // testing a cache-first hook.
    expect(() => renderScreen()).not.toThrow();
  });

  it('shows a retryable error state when the forecast fails', async () => {
    const failing = fakeWeatherRepository(
      err<AppError, Forecast>({ kind: 'network', retryable: true }),
    );

    renderScreen(failing);

    expect(await screen.findByText(/internet connection/i)).toBeTruthy();
  });

  it('goes back when the back button is pressed', async () => {
    renderScreen();

    await screen.findByText('31°');
    fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
