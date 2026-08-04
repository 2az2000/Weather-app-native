import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { GC_TIME, STALE_TIME } from '@/core/config';
import { useContainer } from '@/core/di';
import type { AppError, Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import { weatherKeys } from './query-keys';

/**
 * Weather query hooks.
 *
 * Hooks call USE CASES, never repositories or data sources (CLAUDE.md §16), and
 * the use cases come from the container — so a test renders against fakes with
 * no module mocking.
 *
 * `staleTime` is set deliberately per data type from CLAUDE.md §25. The
 * repository ALSO applies its own freshness check, and the two are
 * complementary: TanStack decides whether to re-run the query at all, the
 * repository decides whether that run touches the network.
 */

/**
 * The single sanctioned unwrap point.
 *
 * A failure is thrown HERE, at the query boundary, so TanStack's error state
 * works normally. Everything below has already handled failure as a value.
 */
function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isErr()) throw result.error;
  return result.value;
}

/**
 * Key for a location that has not resolved yet.
 *
 * A query with no coordinates is disabled and never runs, but TanStack still
 * requires a key. A stable sentinel is used rather than a fabricated `{0, 0}`,
 * which would be a real place off the coast of Africa and would collide with a
 * genuine forecast for it.
 */
const PENDING_LOCATION_KEY = [...weatherKeys.all, 'pending-location'] as const;

const forecastKey = (coordinates: Coordinates | undefined) =>
  coordinates === undefined ? PENDING_LOCATION_KEY : weatherKeys.forecast(coordinates);

/** The full forecast for a place. Cache-first; never blocks on the network. */
export function useForecast(coordinates: Coordinates | undefined) {
  const { weather } = useContainer();

  return useQuery({
    queryKey: forecastKey(coordinates),
    queryFn: async () => {
      // Narrowing inside the function rather than asserting outside it: the
      // `enabled` flag and the type system are checked independently, so a
      // non-null assertion here would be trusting one to cover the other.
      if (coordinates === undefined) throw new Error('no location selected');
      return unwrap(await weather.getForecast.execute(coordinates));
    },
    enabled: coordinates !== undefined,
    staleTime: STALE_TIME.current,
    gcTime: GC_TIME.current,
  });
}

/** The next N hours, with past hours already dropped by the use case. */
export function useHourlyForecast(coordinates: Coordinates | undefined, hours = 24) {
  const { weather } = useContainer();

  return useQuery({
    queryKey: [...forecastKey(coordinates), 'hourly', hours],
    queryFn: async () => {
      if (coordinates === undefined) throw new Error('no location selected');
      return unwrap(await weather.getHourlyForecast.execute(coordinates, hours));
    },
    enabled: coordinates !== undefined,
    staleTime: STALE_TIME.hourly,
    gcTime: GC_TIME.hourly,
  });
}

/** The next N days, including today. */
export function useDailyForecast(coordinates: Coordinates | undefined, days = 7) {
  const { weather } = useContainer();

  return useQuery({
    queryKey: [...forecastKey(coordinates), 'daily', days],
    queryFn: async () => {
      if (coordinates === undefined) throw new Error('no location selected');
      return unwrap(await weather.getDailyForecast.execute(coordinates, days));
    },
    enabled: coordinates !== undefined,
    staleTime: STALE_TIME.daily,
    gcTime: GC_TIME.daily,
  });
}

/** Near-term precipitation, summarised. `undefined` where unavailable. */
export function useMinutelyForecast(coordinates: Coordinates | undefined) {
  const { weather } = useContainer();

  return useQuery({
    queryKey: [...forecastKey(coordinates), 'minutely'],
    queryFn: async () => {
      if (coordinates === undefined) throw new Error('no location selected');
      return unwrap(await weather.getMinutelyForecast.execute(coordinates));
    },
    enabled: coordinates !== undefined,
    // Changes fastest and is the most time-sensitive (CLAUDE.md §25).
    staleTime: STALE_TIME.minutely,
    gcTime: GC_TIME.minutely,
  });
}

/** Active severe weather alerts, most urgent first. */
export function useSevereAlerts(coordinates: Coordinates | undefined) {
  const { weather } = useContainer();

  return useQuery({
    queryKey:
      coordinates === undefined
        ? [...PENDING_LOCATION_KEY, 'alerts']
        : weatherKeys.alerts(coordinates),
    queryFn: async () => {
      if (coordinates === undefined) throw new Error('no location selected');
      return unwrap(await weather.getSevereAlerts.execute(coordinates));
    },
    enabled: coordinates !== undefined,
    // Safety-critical — freshness matters more here than anywhere else.
    staleTime: STALE_TIME.alerts,
    gcTime: GC_TIME.alerts,
  });
}

/**
 * Pull-to-refresh.
 *
 * Invalidates only THIS location's keys, not the whole cache (CLAUDE.md §25):
 * refreshing Tehran must not discard a forecast for Shiraz that the user is
 * about to swipe back to.
 */
export function useRefreshForecast() {
  const { weather } = useContainer();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (coordinates: Coordinates) =>
      unwrap(await weather.refreshForecast.execute(coordinates)),

    onSuccess: async (_data, coordinates) => {
      await queryClient.invalidateQueries({
        queryKey: weatherKeys.forecast(coordinates),
      });
      await queryClient.invalidateQueries({
        queryKey: weatherKeys.alerts(coordinates),
      });
    },
  });

  const { mutateAsync } = mutation;

  const refresh = useCallback(
    async (coordinates: Coordinates) => {
      await mutateAsync(coordinates);
    },
    [mutateAsync],
  );

  return { refresh, isRefreshing: mutation.isPending };
}
