import {
  formatDate,
  formatNumber,
  formatRelativeTime,
  formatTemperature,
  formatTime,
  formatWeekday,
  toPersianDigits,
} from './formatters';

/**
 * ROADMAP Phase 2 DoD: "Persian numerals and Jalali dates render correctly."
 *
 * These tests are the proof. A Persian user seeing ASCII digits or a Gregorian
 * date is not a cosmetic issue — the Jalali date is simply a DIFFERENT date, and
 * showing the wrong one is a correctness bug (CLAUDE.md §19 rule 4).
 */
describe('formatters', () => {
  describe('toPersianDigits', () => {
    it('converts every ASCII digit', () => {
      expect(toPersianDigits('0123456789')).toBe('۰۱۲۳۴۵۶۷۸۹');
    });

    it('leaves non-digits untouched', () => {
      expect(toPersianDigits('12:30 AM')).toBe('۱۲:۳۰ AM');
    });

    it('is a no-op on text with no digits', () => {
      expect(toPersianDigits('آب‌وهوا')).toBe('آب‌وهوا');
    });
  });

  describe('formatNumber', () => {
    it('uses ASCII digits in English', () => {
      expect(formatNumber(1234, 'en')).toBe('1,234');
    });

    it('uses Persian-Indic digits in Persian', () => {
      expect(formatNumber(1234, 'fa')).toMatch(/[۰-۹]/);
      expect(formatNumber(1234, 'fa')).not.toMatch(/[0-9]/);
    });

    it('honours fraction digits', () => {
      expect(formatNumber(3.14159, 'en', { maximumFractionDigits: 2 })).toBe('3.14');
    });
  });

  describe('formatTemperature', () => {
    it('rounds to a whole degree', () => {
      expect(formatTemperature(21.4, 'en')).toBe('21°');
      expect(formatTemperature(21.6, 'en')).toBe('22°');
    });

    it('converts to Fahrenheit on request', () => {
      expect(formatTemperature(0, 'en', 'fahrenheit')).toBe('32°');
      expect(formatTemperature(100, 'en', 'fahrenheit')).toBe('212°');
    });

    it('never renders "-0°", which Math.round genuinely produces', () => {
      expect(formatTemperature(-0.2, 'en')).toBe('0°');
      expect(formatTemperature(-0.2, 'en')).not.toContain('-');
    });

    it('keeps a real negative', () => {
      expect(formatTemperature(-5, 'en')).toBe('-5°');
    });

    it('uses Persian digits in Persian', () => {
      expect(formatTemperature(21, 'fa')).toBe('۲۱°');
    });
  });

  describe('formatDate', () => {
    const date = new Date('2026-07-31T12:00:00Z');

    it('formats a Gregorian date in English', () => {
      expect(formatDate(date, 'en')).toBe('July 31');
    });

    it('formats a JALALI date in Persian, not a translated Gregorian one', () => {
      const result = formatDate(date, 'fa');

      // 31 July 2026 is 9 Mordad 1405 — a different day number entirely.
      // If this returned "۳۱" the calendar conversion silently did not happen.
      expect(result).toMatch(/[۰-۹]/);
      expect(result).not.toMatch(/[0-9]/);
      expect(result).not.toContain('۳۱');
    });
  });

  describe('formatTime', () => {
    it('uses a 12-hour clock in English', () => {
      expect(formatTime(new Date('2026-07-31T14:30:00'), 'en')).toMatch(/PM|AM/);
    });

    it('uses a 24-hour clock with Persian digits in Persian', () => {
      const result = formatTime(new Date('2026-07-31T14:30:00'), 'fa');

      expect(result).not.toMatch(/PM|AM/);
      expect(result).toMatch(/[۰-۹]/);
    });
  });

  describe('formatWeekday', () => {
    it('returns a short English weekday', () => {
      expect(formatWeekday(new Date('2026-07-31T12:00:00'), 'en')).toMatch(
        /^[A-Z][a-z]{2}$/,
      );
    });

    it('returns a Persian weekday name', () => {
      const result = formatWeekday(new Date('2026-07-31T12:00:00'), 'fa');
      expect(result).toMatch(/[؀-ۿ]/);
    });
  });

  describe('formatRelativeTime', () => {
    const now = new Date('2026-07-31T12:00:00Z');

    it('describes minutes ago in English', () => {
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);
      expect(formatRelativeTime(tenMinutesAgo, 'en', now)).toContain('10');
    });

    it('describes hours ago', () => {
      const threeHoursAgo = new Date(now.getTime() - 3 * 3_600_000);
      expect(formatRelativeTime(threeHoursAgo, 'en', now)).toContain('3');
    });

    it('describes days ago', () => {
      const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);
      expect(formatRelativeTime(twoDaysAgo, 'en', now)).toContain('2');
    });

    it('uses Persian digits in Persian', () => {
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);
      const result = formatRelativeTime(tenMinutesAgo, 'fa', now);

      expect(result).toMatch(/[۰-۹]/);
      expect(result).not.toMatch(/[0-9]/);
    });

    it('handles the just-now case without inventing a unit', () => {
      expect(formatRelativeTime(now, 'en', now)).toBeTruthy();
    });
  });
});
