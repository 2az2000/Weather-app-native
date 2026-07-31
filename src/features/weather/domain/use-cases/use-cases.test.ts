import { err, ok, type AppError, type Result } from '@/core/errors';

import { forecastFixture, minutelyPoint } from '../__fixtures__/forecast';
import type { Forecast, HistoricalDay } from '../entities/forecast';
import type { SevereAlert } from '../entities/weather-condition';
import type { WeatherRepository } from '../repositories/weather-repository';

import { GetDailyForecast } from './get-daily-forecast';
import { GetForecast, RefreshForecast } from './get-forecast';
import { GetHistoricalWeather } from './get-historical-weather';
import { GetHourlyForecast } from './get-hourly-forecast';
import { GetMinutelyForecast } from './get-minutely-forecast';
import { GetSevereAlerts } from './get-severe-alerts';

/**
 * Domain tests use NO mocking framework — a hand-written fake implementing the
 * interface is enough (CLAUDE.md §26 rule 1).
 */
const COORDINATES = { latitude: 35.6892, longitude: 51.389 };
const FORECAST = forecastFixture();

function fakeRepository(overrides: Partial<WeatherRepository> = {}): WeatherRepository {
  return {
    getForecast: () => Promise.resolve(ok(FORECAST)),
    refreshForecast: () => Promise.resolve(ok(FORECAST)),
    getAlerts: () => Promise.resolve(ok([])),
    getHistorical: () => Promise.resolve(ok([])),
    ...overrides,
  };
}

function alert(overrides: Partial<SevereAlert> = {}): SevereAlert {
  return {
    id: 'a',
    title: 'Heat',
    description: '',
    severity: 'advisory',
    sender: 'IMO',
    startsAt: new Date('2026-07-31T00:00:00Z'),
    endsAt: new Date('2026-07-31T23:00:00Z'),
    ...overrides,
  };
}

describe('GetForecast', () => {
  it('returns the forecast', async () => {
    const result = await new GetForecast(fakeRepository()).execute(COORDINATES);
    expect(result.isOk()).toBe(true);
  });

  it('propagates a failure as a value rather than throwing', async () => {
    const repository = fakeRepository({
      getForecast: () => Promise.resolve(err({ kind: 'network', retryable: true })),
    });

    const result = await new GetForecast(repository).execute(COORDINATES);
    expect(result.isErr() && result.error.kind).toBe('network');
  });
});

describe('RefreshForecast', () => {
  it('calls refresh, not the cache-first path', async () => {
    const refreshForecast = jest.fn(() => Promise.resolve(ok(FORECAST)));
    const getForecast = jest.fn();

    await new RefreshForecast(fakeRepository({ refreshForecast, getForecast })).execute(
      COORDINATES,
    );

    expect(refreshForecast).toHaveBeenCalled();
    expect(getForecast).not.toHaveBeenCalled();
  });
});

describe('GetHourlyForecast', () => {
  // The fixture covers 12:00, 13:00 and 14:00 local (+03:30).
  const NOON_UTC = new Date('2026-07-31T08:30:00Z');

  it('returns upcoming hours', async () => {
    const result = await new GetHourlyForecast(fakeRepository()).execute(
      COORDINATES,
      24,
      NOON_UTC,
    );

    expect(result.unwrapOr([])).toHaveLength(3);
  });

  it('DROPS hours already past', async () => {
    // A provider response covers whole days, so at 14:00 it still contains
    // 12:00 and 13:00. Rendering those would show the past as upcoming.
    const twoPm = new Date('2026-07-31T10:30:00Z');

    const result = await new GetHourlyForecast(fakeRepository()).execute(
      COORDINATES,
      24,
      twoPm,
    );

    expect(result.unwrapOr([])).toHaveLength(1);
  });

  it('keeps the CURRENT hour, which has not finished yet', async () => {
    const halfPastNoon = new Date('2026-07-31T09:00:00Z');

    const result = await new GetHourlyForecast(fakeRepository()).execute(
      COORDINATES,
      24,
      halfPastNoon,
    );

    expect(result.unwrapOr([])[0]?.time.toISOString()).toBe('2026-07-31T08:30:00.000Z');
  });

  it('respects the requested count', async () => {
    const result = await new GetHourlyForecast(fakeRepository()).execute(
      COORDINATES,
      2,
      NOON_UTC,
    );

    expect(result.unwrapOr([])).toHaveLength(2);
  });

  it('propagates a repository failure', async () => {
    const repository = fakeRepository({
      getForecast: () => Promise.resolve(err({ kind: 'network', retryable: true })),
    });

    const result = await new GetHourlyForecast(repository).execute(COORDINATES);
    expect(result.isErr()).toBe(true);
  });
});

describe('GetDailyForecast', () => {
  const NOON_UTC = new Date('2026-07-31T08:30:00Z');

  it('INCLUDES today, which a daily list is expected to start with', async () => {
    const result = await new GetDailyForecast(fakeRepository()).execute(
      COORDINATES,
      7,
      NOON_UTC,
    );

    // Dropping the current day would make the list start tomorrow and look off
    // by one.
    expect(result.unwrapOr([])).toHaveLength(2);
  });

  it('respects the requested count', async () => {
    const result = await new GetDailyForecast(fakeRepository()).execute(
      COORDINATES,
      1,
      NOON_UTC,
    );

    expect(result.unwrapOr([])).toHaveLength(1);
  });

  it('drops days entirely in the past', async () => {
    const nextWeek = new Date('2026-08-07T08:30:00Z');

    const result = await new GetDailyForecast(fakeRepository()).execute(
      COORDINATES,
      7,
      nextWeek,
    );

    expect(result.unwrapOr([])).toHaveLength(0);
  });
});

describe('GetMinutelyForecast', () => {
  const NOON_UTC = new Date('2026-07-31T08:30:00Z');

  it('summarises rather than returning raw points', async () => {
    const result = await new GetMinutelyForecast(fakeRepository()).execute(
      COORDINATES,
      120,
      NOON_UTC,
    );

    const summary = result.unwrapOr(undefined);
    expect(summary?.willPrecipitate).toBe(false);
    expect(summary?.startsAt).toBeUndefined();
  });

  it('reports when precipitation starts', async () => {
    // Built from the fixture helpers rather than object literals, so the
    // branded unit constructors stay the only way to produce a value — no
    // `as never` escape hatches (CLAUDE.md §12).
    const wet = forecastFixture({
      minutely: { points: [minutelyPoint(0, 0), minutelyPoint(15, 0.4)] },
    });

    const result = await new GetMinutelyForecast(
      fakeRepository({ getForecast: () => Promise.resolve(ok(wet)) }),
    ).execute(COORDINATES, 120, NOON_UTC);

    const summary = result.unwrapOr(undefined);
    expect(summary?.willPrecipitate).toBe(true);
    expect(summary?.startsAt?.toISOString()).toBe('2026-07-31T08:45:00.000Z');
  });

  it('reports interpolation, so the UI does not imply false precision', async () => {
    // The fixture is Asia/Tehran, outside the natively-resolved regions
    // (ADR-0002).
    const result = await new GetMinutelyForecast(fakeRepository()).execute(
      COORDINATES,
      120,
      NOON_UTC,
    );

    expect(result.unwrapOr(undefined)?.isInterpolated).toBe(true);
  });

  it('returns undefined when the provider offers no minutely data', async () => {
    const without: Forecast = { ...FORECAST, minutely: undefined };

    const result = await new GetMinutelyForecast(
      fakeRepository({ getForecast: () => Promise.resolve(ok(without)) }),
    ).execute(COORDINATES, 120, NOON_UTC);

    // Absence is normal, not an error.
    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(undefined)).toBeUndefined();
  });
});

describe('GetHistoricalWeather', () => {
  const NOW = new Date('2026-07-31T12:00:00Z');

  it('fetches a valid past range', async () => {
    const getHistorical = jest.fn((): Promise<Result<HistoricalDay[], AppError>> =>
      Promise.resolve(ok([])),
    );

    const result = await new GetHistoricalWeather(
      fakeRepository({ getHistorical }),
    ).execute(COORDINATES, new Date('2026-07-01'), new Date('2026-07-10'), NOW);

    expect(result.isOk()).toBe(true);
    expect(getHistorical).toHaveBeenCalled();
  });

  describe('range validation before the network', () => {
    it('rejects a reversed range', async () => {
      const getHistorical = jest.fn();

      const result = await new GetHistoricalWeather(
        fakeRepository({ getHistorical }),
      ).execute(COORDINATES, new Date('2026-07-10'), new Date('2026-07-01'), NOW);

      expect(result.isErr() && result.error.kind).toBe('validation');
      expect(getHistorical).not.toHaveBeenCalled();
    });

    it('rejects a future end date', async () => {
      const getHistorical = jest.fn();

      const result = await new GetHistoricalWeather(
        fakeRepository({ getHistorical }),
      ).execute(COORDINATES, new Date('2026-07-01'), new Date('2027-01-01'), NOW);

      // "Historical" and "future" are different questions with different
      // endpoints; silently clamping would answer the wrong one.
      expect(result.isErr()).toBe(true);
      expect(getHistorical).not.toHaveBeenCalled();
    });

    it('rejects a date before the archive begins in 1940', async () => {
      const result = await new GetHistoricalWeather(fakeRepository()).execute(
        COORDINATES,
        new Date('1900-01-01'),
        new Date('1900-02-01'),
        NOW,
      );

      expect(result.isErr()).toBe(true);
    });

    it('reports every problem at once, not just the first', async () => {
      const result = await new GetHistoricalWeather(fakeRepository()).execute(
        COORDINATES,
        new Date('1800-01-01'),
        new Date('1700-01-01'),
        NOW,
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.kind === 'validation') {
        expect(result.error.issues.length).toBeGreaterThan(1);
      }
    });
  });
});

describe('GetSevereAlerts', () => {
  const NOW = new Date('2026-07-31T12:00:00Z');

  it('DROPS expired alerts', async () => {
    const expired = alert({
      id: 'old',
      startsAt: new Date('2026-07-01T00:00:00Z'),
      endsAt: new Date('2026-07-02T00:00:00Z'),
    });

    const result = await new GetSevereAlerts(
      fakeRepository({ getAlerts: () => Promise.resolve(ok([expired])) }),
    ).execute(COORDINATES, NOW);

    // A warning that ended a month ago is safety-critical noise, and noise
    // trains users to ignore the banner.
    expect(result.unwrapOr([])).toHaveLength(0);
  });

  it('keeps an alert currently in effect', async () => {
    const result = await new GetSevereAlerts(
      fakeRepository({ getAlerts: () => Promise.resolve(ok([alert()])) }),
    ).execute(COORDINATES, NOW);

    expect(result.unwrapOr([])).toHaveLength(1);
  });

  it('sorts most urgent FIRST', async () => {
    const alerts = [
      alert({ id: 'a', severity: 'advisory' }),
      alert({ id: 'e', severity: 'emergency' }),
      alert({ id: 'w', severity: 'watch' }),
      alert({ id: 'r', severity: 'warning' }),
    ];

    const result = await new GetSevereAlerts(
      fakeRepository({ getAlerts: () => Promise.resolve(ok(alerts)) }),
    ).execute(COORDINATES, NOW);

    // If only one alert fits on screen it must be the most urgent one.
    expect(result.unwrapOr([]).map((item) => item.severity)).toEqual([
      'emergency',
      'warning',
      'watch',
      'advisory',
    ]);
  });

  it('propagates a repository failure', async () => {
    const repository = fakeRepository({
      getAlerts: () => Promise.resolve(err({ kind: 'network', retryable: true })),
    });

    const result = await new GetSevereAlerts(repository).execute(COORDINATES, NOW);
    expect(result.isErr()).toBe(true);
  });
});
