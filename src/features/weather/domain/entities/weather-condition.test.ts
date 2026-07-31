import {
  ALERT_SEVERITIES,
  isAlertActive,
  isPrecipitating,
  isSevereCondition,
  WEATHER_CONDITIONS,
  type SevereAlert,
} from './weather-condition';

function alert(overrides: Partial<SevereAlert> = {}): SevereAlert {
  return {
    id: 'a',
    title: 'Heat',
    description: '',
    severity: 'warning',
    sender: 'IMO',
    startsAt: new Date('2026-07-31T06:00:00Z'),
    endsAt: new Date('2026-07-31T18:00:00Z'),
    ...overrides,
  };
}

describe('isPrecipitating', () => {
  it.each(['drizzle', 'rain', 'heavyRain', 'snow', 'sleet', 'thunderstorm'] as const)(
    'reports %s as precipitating',
    (condition) => {
      expect(isPrecipitating(condition)).toBe(true);
    },
  );

  it.each(['clear', 'partlyCloudy', 'cloudy', 'fog'] as const)(
    'reports %s as not precipitating',
    (condition) => {
      // Fog is water in the air but nothing is FALLING — the distinction
      // matters for particle effects and for the umbrella rule in Phase 7.
      expect(isPrecipitating(condition)).toBe(false);
    },
  );

  it('classifies every declared condition', () => {
    for (const condition of WEATHER_CONDITIONS) {
      expect(typeof isPrecipitating(condition)).toBe('boolean');
    }
  });
});

describe('isSevereCondition', () => {
  it.each(['thunderstorm', 'heavyRain'] as const)('reports %s as severe', (condition) => {
    expect(isSevereCondition(condition)).toBe(true);
  });

  it.each(['clear', 'rain', 'snow', 'fog', 'drizzle'] as const)(
    'reports %s as not severe',
    (condition) => {
      // Ordinary rain is not a caution. Thresholds — how much rain, how cold —
      // belong to the recommendation rules in Phase 7, not here.
      expect(isSevereCondition(condition)).toBe(false);
    },
  );
});

describe('isAlertActive', () => {
  it('reports an alert in effect', () => {
    expect(isAlertActive(alert(), new Date('2026-07-31T12:00:00Z'))).toBe(true);
  });

  it('reports an alert that has not started', () => {
    expect(isAlertActive(alert(), new Date('2026-07-31T05:00:00Z'))).toBe(false);
  });

  it('reports an expired alert', () => {
    expect(isAlertActive(alert(), new Date('2026-07-31T19:00:00Z'))).toBe(false);
  });

  it('is inclusive at both boundaries', () => {
    // An alert that begins exactly now IS in effect; excluding the boundary
    // would blink the banner off for one tick at each end.
    expect(isAlertActive(alert(), new Date('2026-07-31T06:00:00Z'))).toBe(true);
    expect(isAlertActive(alert(), new Date('2026-07-31T18:00:00Z'))).toBe(true);
  });
});

describe('ALERT_SEVERITIES', () => {
  it('is ordered from least to most urgent', () => {
    // `GetSevereAlerts` sorts by index, so the ORDER is load-bearing: reversing
    // it would put an advisory above an emergency.
    expect(ALERT_SEVERITIES).toEqual(['advisory', 'watch', 'warning', 'emergency']);
  });
});
