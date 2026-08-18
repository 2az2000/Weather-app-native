import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ContainerProvider, type Container } from '@/core/di';
import { createFakeContainer } from '@/core/di/__tests__/fake-container';
import { ok, err, type AppError, type Result } from '@/core/errors';
import { createI18n, type Locale } from '@/core/i18n';
import { useLocationPermissionStore } from '@/features/locations';
import { ThemeProvider } from '@/theme';

import { forecastFixture } from '../../../domain/__fixtures__/forecast';
import type {
  Forecast,
  HistoricalDay,
  SevereAlert,
  WeatherRepository,
} from '../../../domain';
import { HomeScreen } from '../home-screen';

/**
 * The home screen's own tests.
 *
 * Every component this screen renders was already covered individually — and a
 * bug still shipped in which the screen showed a skeleton forever on every
 * fresh install, because nothing ever requested location permission and the
 * screen had no branch for "there is no location". Testing the parts and not
 * the composition tests everything except the decision being made.
 *
 * `expo-location` is mocked because it is the OS boundary: there is no seam
 * below it to inject through, which is the same justification `env.test.ts`
 * uses for `expo-constants`. Everything else — repository, use cases,
 * container — is a real object over a fake, per CLAUDE.md §26 rule 1.
 */
jest.mock('expo-location', () => ({
  __esModule: true,
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush, back: jest.fn() }),
}));

const location = Location as jest.Mocked<typeof Location>;

const TEHRAN = { latitude: 35.6892, longitude: 51.389 };

/**
 * Metrics for `SafeAreaProvider`, so `SafeAreaView` renders without the native
 * measurement pass that never happens under the test renderer.
 *
 * `left` and `right` are react-native-safe-area-context's own `EdgeInsets`
 * contract, not layout written by us. The RTL rule bans physical STYLE
 * properties and cannot tell the two apart, and logical names would not
 * type-check here — so the rule is disabled for this one literal.
 */
const FRAME = { x: 0, y: 0, width: 390, height: 844 };
// eslint-disable-next-line no-restricted-syntax
const INSETS = { top: 47, left: 0, right: 0, bottom: 34 };
const FORECAST = forecastFixture();

/** Permission states, named the way the OS reports them. */
function permissionIs(granted: boolean, canAskAgain = true): void {
  const state = { granted, canAskAgain, status: granted ? 'granted' : 'denied' };

  location.getForegroundPermissionsAsync.mockResolvedValue(
    state as unknown as Location.LocationPermissionResponse,
  );
}

function positionResolves(): void {
  location.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: TEHRAN.latitude, longitude: TEHRAN.longitude },
  } as unknown as Location.LocationObject);

  location.reverseGeocodeAsync.mockResolvedValue([
    { city: 'Tehran', region: 'Tehran', country: 'Iran', isoCountryCode: 'IR' },
  ] as unknown as Location.LocationGeocodedAddress[]);
}

/**
 * A repository built from the INTERFACE, not a mocked class.
 *
 * Two lines of fake is the payoff dependency inversion was for (CLAUDE.md §10);
 * the real `GetForecast` use case runs on top of it inside the container.
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

function renderHome(
  { container, locale = 'en' }: { container: Container; locale?: Locale } = {
    container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
  },
) {
  // `retry: false` so a deliberate failure surfaces as an error immediately
  // instead of after TanStack's backoff schedule.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: INSETS }}>
        <ContainerProvider container={container}>
          <I18nextProvider i18n={createI18n(locale)}>
            <ThemeProvider
              scheme="light"
              script={locale === 'fa' ? 'arabic' : 'latin'}
              isRTL={locale === 'fa'}
            >
              <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </ThemeProvider>
          </I18nextProvider>
        </ContainerProvider>
      </SafeAreaProvider>
    );
  }

  return render(<HomeScreen />, { wrapper: Wrapper });
}

describe('HomeScreen', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();

    // The store is persisted, so it survives between tests in the same module.
    // Every test starts from a fresh install unless it says otherwise.
    useLocationPermissionStore.setState({ hasRequested: false });

    permissionIs(false);
    positionResolves();
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: 'denied',
    } as unknown as Location.LocationPermissionResponse);
  });

  describe('when there is no location yet', () => {
    it('shows the permission prompt, never an endless skeleton, when access is refused', async () => {
      // THE REGRESSION. With permission refused the forecast query is disabled,
      // so it is neither loading nor failed — it never runs. The screen used to
      // fall through to a skeleton that could never resolve, leaving the user
      // waiting for work that was not happening.
      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      expect(await screen.findByText('Use your location?')).toBeTruthy();
      expect(screen.getByText('Allow location access')).toBeTruthy();
    });

    it('offers a way to carry on WITHOUT location, so a refusal is not a dead end', async () => {
      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      // Declining location is a legitimate choice (CLAUDE.md §22 rule 6): a
      // searched city gives a full forecast with no GPS at all.
      expect(await screen.findByText('Add location')).toBeTruthy();
    });

    it('sends the user to Settings, not to a useless button, once the OS stops asking', async () => {
      permissionIs(false, false);

      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      expect(await screen.findByText('Open Settings')).toBeTruthy();
      expect(screen.queryByText('Allow location access')).toBeNull();
    });

    it('requests permission automatically on a first launch', async () => {
      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      await waitFor(() => {
        expect(location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
      });
    });

    it('goes straight to the forecast when the auto-request is granted', async () => {
      // The FIRST-LAUNCH HAPPY PATH, end to end: the screen starts with no
      // permission, asks unprompted, is granted, and must then resolve a
      // position and render — without the user touching anything.
      //
      // This works only because granting invalidates the location query, which
      // has already FAILED by that point. An errored query that is never
      // retried would leave the screen stuck behind a permission the user just
      // gave.
      location.requestForegroundPermissionsAsync.mockImplementation(() => {
        permissionIs(true);
        return Promise.resolve({
          granted: true,
          canAskAgain: true,
          status: 'granted',
        } as unknown as Location.LocationPermissionResponse);
      });

      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      expect(await screen.findByText('Tehran')).toBeTruthy();
    });

    it('does NOT ask again on a later launch, once the dialog has been shown', async () => {
      useLocationPermissionStore.setState({ hasRequested: true });

      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      // Re-prompting on every launch is how an app trains users to dismiss it
      // reflexively. Android also converts repeated asks into a permanent block.
      expect(await screen.findByText('Use your location?')).toBeTruthy();
      expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('never auto-asks when the OS will no longer show a dialog', async () => {
      permissionIs(false, false);

      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      // `request` would resolve instantly with no dialog, burning the one-shot
      // flag and leaving the user with no explanation.
      expect(await screen.findByText('Open Settings')).toBeTruthy();
      expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('shows a retryable error, not a prompt, when GPS itself fails', async () => {
      permissionIs(true);
      location.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));

      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      // Permission is granted, so this is a genuine failure rather than a
      // decision — an error screen is the honest answer, and a skeleton is not.
      expect(await screen.findByText('Something went wrong')).toBeTruthy();
      expect(screen.queryByText('Allow location access')).toBeNull();
    });
  });

  describe('when a location resolves', () => {
    beforeEach(() => {
      permissionIs(true);
    });

    it('renders the forecast', async () => {
      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
      });

      // The place name comes from the OS geocoder; the metric comes from the
      // forecast. Asserting both proves the whole chain resolved, not just the
      // half that needed no network.
      expect(await screen.findByText('Tehran')).toBeTruthy();
      expect(screen.getByText('Humidity')).toBeTruthy();
    });

    it('shows the forecast error state when the forecast itself fails', async () => {
      const failing = fakeWeatherRepository(
        err<AppError, Forecast>({ kind: 'network', retryable: true }),
      );

      renderHome({ container: createFakeContainer({ weatherRepository: failing }) });

      expect(await screen.findByText(/internet connection/i)).toBeTruthy();
    });

    it('renders in Persian', async () => {
      renderHome({
        container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
        locale: 'fa',
      });

      // This screen had never been rendered in either language before, let
      // alone Persian (ROADMAP Phase 5 DoD).
      expect(await screen.findByText('رطوبت')).toBeTruthy();
    });
  });

  it('keeps the locations button reachable even with no location at all', async () => {
    renderHome({
      container: createFakeContainer({ weatherRepository: fakeWeatherRepository() }),
    });

    // Without this the app is a dead end for anyone who declines GPS: no
    // forecast, and no way to reach the city search either.
    const button = await screen.findByLabelText('Change location');
    expect(button).toBeTruthy();
  });
});
