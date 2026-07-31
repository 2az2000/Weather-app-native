import { openMeteoFixture } from './__fixtures__';
import {
  toCurrentConditions,
  toDailyPoints,
  toForecast,
  toHourlyPoints,
  toMinutelyPoints,
} from './open-meteo-mapper';

/**
 * Mapper coverage is a Phase 4 DoD item (100%).
 *
 * The columnar wire shape is the hazard: parallel arrays indexed by position,
 * where a length mismatch silently pairs the wrong temperature with the wrong
 * hour. These tests exercise exactly that.
 */
describe('open-meteo mapper', () => {
  describe('timezone handling', () => {
    it('applies the UTC offset instead of treating local time as UTC', () => {
      // The fixture is Asia/Tehran (+03:30) and reports 12:00 local. Appending
      // "Z" — the classic bug — would give 12:00Z instead of 08:30Z.
      const current = toCurrentConditions(openMeteoFixture());

      expect(current.observedAt.toISOString()).toBe('2026-07-31T08:30:00.000Z');
    });

    it('anchors a daily entry at local midnight', () => {
      const daily = toDailyPoints(openMeteoFixture());

      // 2026-07-31T00:00 local (+03:30) = 2026-07-30T20:30Z.
      expect(daily[0]?.date.toISOString()).toBe('2026-07-30T20:30:00.000Z');
    });
  });

  describe('absent values', () => {
    it('keeps a missing dew point undefined, NOT zero', () => {
      const dto = openMeteoFixture();
      const { dew_point_2m: _omitted, ...current } = dto.current;

      const mapped = toCurrentConditions({ ...dto, current });

      // A dew point of 0 °C is a real reading; not knowing it is a different
      // fact (CLAUDE.md §11).
      expect(mapped.dewPoint).toBeUndefined();
    });

    it('keeps a missing visibility and UV index undefined', () => {
      const dto = openMeteoFixture();
      const { visibility: _v, uv_index: _u, ...current } = dto.current;

      const mapped = toCurrentConditions({ ...dto, current });

      expect(mapped.visibility).toBeUndefined();
      expect(mapped.uvIndex).toBeUndefined();
    });

    it('leaves sunrise and sunset undefined when the provider omits them', () => {
      const dto = openMeteoFixture();
      const { sunrise: _s, sunset: _t, ...daily } = dto.daily;

      const mapped = toDailyPoints({ ...dto, daily });

      // Absent inside the polar circles — a real astronomical fact.
      expect(mapped[0]?.sunrise).toBeUndefined();
      expect(mapped[0]?.sunset).toBeUndefined();
    });
  });

  describe('the columnar hazard', () => {
    it('DROPS an hour whose temperature is null rather than defaulting it', () => {
      const dto = openMeteoFixture();
      const hourly = { ...dto.hourly, temperature_2m: [31.4, null, 32.6] };

      const points = toHourlyPoints({ ...dto, hourly });

      // A gap in a chart is honest; a fabricated 0 °C is not.
      expect(points).toHaveLength(2);
      expect(points.map((p) => p.temperature)).toEqual([31.4, 32.6]);
    });

    it('survives a series SHORTER than the time array', () => {
      const dto = openMeteoFixture();
      const hourly = { ...dto.hourly, temperature_2m: [31.4] };

      const points = toHourlyPoints({ ...dto, hourly });

      // Naive indexing would pair the wrong values; short reads become drops.
      expect(points).toHaveLength(1);
    });

    it('drops a daily entry missing its high or low', () => {
      const dto = openMeteoFixture();
      const daily = { ...dto.daily, temperature_2m_max: [33.2, null] };

      expect(toDailyPoints({ ...dto, daily })).toHaveLength(1);
    });
  });

  describe('minutely', () => {
    it('marks Asia/Tehran as interpolated', () => {
      // Native 15-minute resolution exists only for North America and Central
      // Europe (ADR-0002).
      const points = toMinutelyPoints(openMeteoFixture());

      expect(points.every((p) => p.isInterpolated)).toBe(true);
    });

    it('marks a European timezone as natively resolved', () => {
      const dto = { ...openMeteoFixture(), timezone: 'Europe/Berlin' };

      expect(toMinutelyPoints(dto).every((p) => !p.isInterpolated)).toBe(true);
    });

    it('returns an empty array when the provider omits the block', () => {
      const { minutely_15: _omitted, ...dto } = openMeteoFixture();

      expect(toMinutelyPoints(dto)).toEqual([]);
    });
  });

  describe('toForecast', () => {
    it('records the provider and fetch time', () => {
      const fetchedAt = new Date('2026-07-31T08:30:00Z');
      const forecast = toForecast(openMeteoFixture(), fetchedAt);

      expect(forecast.provider).toBe('open-meteo');
      expect(forecast.fetchedAt).toBe(fetchedAt);
      expect(forecast.timezone).toBe('Asia/Tehran');
    });

    it('leaves minutely undefined rather than empty when there is none', () => {
      const { minutely_15: _omitted, ...dto } = openMeteoFixture();

      // Undefined says "not offered"; an empty array would say "offered, but no
      // precipitation" — a different claim.
      expect(toForecast(dto).minutely).toBeUndefined();
    });
  });
});
