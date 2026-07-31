import { distanceKm, isValidCoordinates } from './coordinates';
import { describePlace, type Place } from './place';

describe('isValidCoordinates', () => {
  it.each([
    { latitude: 0, longitude: 0 },
    { latitude: 90, longitude: 180 },
    { latitude: -90, longitude: -180 },
    { latitude: 35.6892, longitude: 51.389 },
  ])('accepts %j', (coordinates) => {
    expect(isValidCoordinates(coordinates)).toBe(true);
  });

  it.each([
    { latitude: 91, longitude: 0 },
    { latitude: -91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: 0, longitude: -181 },
  ])('rejects out-of-range %j', (coordinates) => {
    expect(isValidCoordinates(coordinates)).toBe(false);
  });

  it.each([
    { latitude: Number.NaN, longitude: 0 },
    { latitude: 0, longitude: Number.NaN },
    { latitude: Number.POSITIVE_INFINITY, longitude: 0 },
    { latitude: 0, longitude: Number.NEGATIVE_INFINITY },
  ])('rejects non-finite %j', (coordinates) => {
    // A NaN latitude propagates silently into a cache key and a URL before
    // failing somewhere unrelated.
    expect(isValidCoordinates(coordinates)).toBe(false);
  });
});

describe('distanceKm', () => {
  const tehran = { latitude: 35.6892, longitude: 51.389 };
  const shiraz = { latitude: 29.5918, longitude: 52.5837 };

  it('is zero for the same point', () => {
    expect(distanceKm(tehran, tehran)).toBe(0);
  });

  it('matches a known distance', () => {
    // Tehran to Shiraz is ~680 km great-circle.
    expect(distanceKm(tehran, shiraz)).toBeGreaterThan(650);
    expect(distanceKm(tehran, shiraz)).toBeLessThan(720);
  });

  it('is symmetric', () => {
    expect(distanceKm(tehran, shiraz)).toBeCloseTo(distanceKm(shiraz, tehran), 6);
  });

  it('handles antipodal points without overflowing the arcsine', () => {
    const distance = distanceKm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 180 },
    );

    // Half the Earth's circumference, ~20,015 km. Without the clamp on
    // sqrt(h), floating-point error makes asin() return NaN here.
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThan(19_000);
  });
});

describe('describePlace', () => {
  const base: Place = {
    coordinates: { latitude: 0, longitude: 0 },
    name: 'Shiraz',
    admin1: 'Fars',
    countryCode: 'IR',
    country: 'Iran',
    timezone: 'Asia/Tehran',
    elevation: undefined,
  };

  it('prefers the region as the qualifier', () => {
    expect(describePlace(base)).toBe('Shiraz, Fars');
  });

  it('falls back to the country when there is no region', () => {
    expect(describePlace({ ...base, admin1: undefined })).toBe('Shiraz, Iran');
  });

  it('does not repeat the name when it equals the qualifier', () => {
    // City-states: "Singapore, Singapore" reads as a mistake.
    expect(describePlace({ ...base, name: 'Singapore', admin1: 'Singapore' })).toBe(
      'Singapore',
    );
  });
});
