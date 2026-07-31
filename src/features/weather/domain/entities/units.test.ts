import {
  celsius,
  COMPASS_POINTS,
  degrees,
  hectopascals,
  meters,
  metersPerSecond,
  percent,
  toCompassPoint,
  toFahrenheit,
  toInchesOfMercury,
  toKilometers,
  toKilometersPerHour,
  toKnots,
  toMiles,
  toMilesPerHour,
  toMillimetersOfMercury,
} from './units';

/**
 * Unit conversions, checked against published reference values rather than
 * against this implementation's own output.
 *
 * These numbers propagate into the cache, every chart, and both widgets
 * (ROADMAP Phase 4), so a wrong factor here is wrong everywhere at once.
 */
describe('unit conversions', () => {
  describe('temperature', () => {
    it.each([
      [0, 32],
      [100, 212],
      [-40, -40], // the one point where the two scales meet
      [37, 98.6],
    ])('converts %s °C to %s °F', (input, expected) => {
      expect(toFahrenheit(celsius(input))).toBeCloseTo(expected, 5);
    });
  });

  describe('speed', () => {
    it('converts m/s to km/h', () => {
      expect(toKilometersPerHour(metersPerSecond(1))).toBeCloseTo(3.6, 5);
      expect(toKilometersPerHour(metersPerSecond(10))).toBeCloseTo(36, 5);
    });

    it('converts m/s to mph', () => {
      expect(toMilesPerHour(metersPerSecond(1))).toBeCloseTo(2.23694, 4);
    });

    it('converts m/s to knots', () => {
      // 1 knot = 1 nautical mile per hour = 1852 m / 3600 s.
      expect(toKnots(metersPerSecond(1))).toBeCloseTo(1.94384, 4);
    });

    it('leaves zero at zero across every conversion', () => {
      expect(toKilometersPerHour(metersPerSecond(0))).toBe(0);
      expect(toMilesPerHour(metersPerSecond(0))).toBe(0);
      expect(toKnots(metersPerSecond(0))).toBe(0);
    });
  });

  describe('pressure', () => {
    it('converts hPa to inHg', () => {
      // Standard atmosphere: 1013.25 hPa = 29.92 inHg.
      expect(toInchesOfMercury(hectopascals(1013.25))).toBeCloseTo(29.92, 2);
    });

    it('converts hPa to mmHg', () => {
      // Standard atmosphere: 1013.25 hPa = 760 mmHg.
      expect(toMillimetersOfMercury(hectopascals(1013.25))).toBeCloseTo(760, 0);
    });
  });

  describe('distance', () => {
    it('converts metres to kilometres', () => {
      expect(toKilometers(meters(1500))).toBe(1.5);
    });

    it('converts metres to miles', () => {
      expect(toMiles(meters(1609.344))).toBeCloseTo(1, 6);
    });
  });

  describe('percent', () => {
    it('passes a valid value through', () => {
      expect(percent(55)).toBe(55);
    });

    it('clamps above 100 and below 0', () => {
      // A humidity of 103% is a provider bug, not a reading.
      expect(percent(103)).toBe(100);
      expect(percent(-2)).toBe(0);
    });
  });
});

describe('toCompassPoint', () => {
  it.each([
    [0, 'N'],
    [90, 'E'],
    [180, 'S'],
    [270, 'W'],
    [45, 'NE'],
    [225, 'SW'],
    [22.5, 'NNE'],
    [337.5, 'NNW'],
  ] as const)('maps %s° to %s', (bearing, expected) => {
    expect(toCompassPoint(degrees(bearing))).toBe(expected);
  });

  it('wraps past 360 rather than falling off the end', () => {
    expect(toCompassPoint(degrees(360))).toBe('N');
    expect(toCompassPoint(degrees(450))).toBe('E');
  });

  it('handles a negative bearing', () => {
    expect(toCompassPoint(degrees(-90))).toBe('W');
  });

  it('centres each sector on its label', () => {
    // 11.24° is still N; 11.26° tips into NNE. Getting the offset wrong shifts
    // every reading by half a sector.
    expect(toCompassPoint(degrees(11.2))).toBe('N');
    expect(toCompassPoint(degrees(11.3))).toBe('NNE');
  });

  it('covers all sixteen points across a full turn', () => {
    const seen = new Set<string>();
    for (let bearing = 0; bearing < 360; bearing += 1) {
      seen.add(toCompassPoint(degrees(bearing)));
    }

    expect(seen.size).toBe(COMPASS_POINTS.length);
  });
});
