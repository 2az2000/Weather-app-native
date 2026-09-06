import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { ContainerProvider } from '@/core/di';
import { createFakeContainer } from '@/core/di/__tests__/fake-container';
import { err, ok, type AppError } from '@/core/errors';
import { createI18n } from '@/core/i18n';
import { ThemeProvider } from '@/theme';

import type {
  LocationRepository,
  LocationSearchResult,
  Place,
  SavedLocation,
} from '../../../domain';
import { useSelectedLocationStore } from '../../stores/selected-location-store';
import { LocationSearchScreen } from '../location-search-screen';

/**
 * Selecting a search result used to save the city but never SELECT it, so the
 * home screen kept following the device's GPS — and on a device where GPS
 * never resolves, saving a city sent the user right back to the same "no
 * location" screen they searched to escape. That regression is what this file
 * pins.
 */

const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ back: mockRouterBack, push: jest.fn() }),
}));

const TEHRAN: LocationSearchResult = {
  id: 'search-tehran',
  name: 'Tehran',
  admin1: 'Tehran',
  country: 'Iran',
  countryCode: 'IR',
  coordinates: { latitude: 35.6892, longitude: 51.389 },
  timezone: 'Asia/Tehran',
  elevation: undefined,
  population: undefined,
};

const SAVED_TEHRAN: SavedLocation = {
  ...TEHRAN,
  id: 'saved-real-id',
  sortOrder: 0,
  isCurrentLocation: false,
  savedAt: new Date('2026-08-01T00:00:00Z'),
};

function fakeLocationRepository(
  overrides: Partial<LocationRepository> = {},
): LocationRepository {
  return {
    getCurrentLocation: () =>
      Promise.resolve(
        err({ kind: 'permissionDenied', permission: 'location', retryable: false }),
      ),
    searchCities: () => Promise.resolve(ok<LocationSearchResult[], AppError>([TEHRAN])),
    reverseGeocode: () => Promise.resolve(ok({} as Place)),
    getSavedLocations: () => Promise.resolve(ok<SavedLocation[], AppError>([])),
    saveLocation: () => Promise.resolve(ok(SAVED_TEHRAN)),
    removeLocation: () => Promise.resolve(ok(undefined)),
    reorderLocations: () => Promise.resolve(ok(undefined)),
    getRecentSearches: () => Promise.resolve(ok<string[], AppError>([])),
    recordSearch: () => Promise.resolve(ok(undefined)),
    clearRecentSearches: () => Promise.resolve(ok(undefined)),
    ...overrides,
  };
}

function renderScreen(locationRepository: LocationRepository) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <ContainerProvider container={createFakeContainer({ locationRepository })}>
        <I18nextProvider i18n={createI18n('en')}>
          <ThemeProvider scheme="light" script="latin" isRTL={false}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </ThemeProvider>
        </I18nextProvider>
      </ContainerProvider>
    );
  }

  return render(<LocationSearchScreen />, { wrapper: Wrapper });
}

describe('LocationSearchScreen', () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
    useSelectedLocationStore.setState({ selectedId: undefined });
  });

  it('selects the REAL saved location, not the optimistic placeholder, once saving resolves', async () => {
    renderScreen(fakeLocationRepository());

    fireEvent.changeText(screen.getByPlaceholderText('Search for a city'), 'Tehran');

    const result = await screen.findByLabelText('Tehran');
    fireEvent.press(result);

    // THE REGRESSION: before this fix, nothing ever called `select`, so the
    // home screen kept following the device position after a save — the exact
    // dead end this pins.
    await waitFor(() => {
      expect(useSelectedLocationStore.getState().selectedId).toBe('saved-real-id');
    });

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('does not select or navigate away when the save fails', async () => {
    renderScreen(
      fakeLocationRepository({
        saveLocation: () =>
          Promise.resolve(
            err({ kind: 'storage', operation: 'save location', retryable: false }),
          ),
      }),
    );

    fireEvent.changeText(screen.getByPlaceholderText('Search for a city'), 'Tehran');

    const result = await screen.findByLabelText('Tehran');
    fireEvent.press(result);

    // A failed save must not navigate the user away from a screen that still
    // shows their unsaved search — there is nothing to show them elsewhere.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(useSelectedLocationStore.getState().selectedId).toBeUndefined();
  });
});
