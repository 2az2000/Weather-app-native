import { I18nManager } from 'react-native';

import {
  applyLayoutDirection,
  axisDirection,
  isNativeRTL,
  localeIsRTL,
  mirrorHorizontal,
  needsRestartForLocale,
} from './rtl';

/**
 * ROADMAP Phase 2 DoD: "Language switch triggers the RTL restart flow and layout
 * mirrors correctly."
 *
 * The two helpers at the bottom cover ADR-0006's most dangerous traps: gestures
 * and chart axes do NOT mirror automatically, and both fail in ways that look
 * correct to a developer testing in English.
 */
describe('RTL', () => {
  const setNativeRTL = (value: boolean): void => {
    Object.defineProperty(I18nManager, 'isRTL', { value, configurable: true });
  };

  afterEach(() => {
    setNativeRTL(false);
    jest.restoreAllMocks();
  });

  describe('localeIsRTL', () => {
    it('reports Persian as right-to-left', () => {
      expect(localeIsRTL('fa')).toBe(true);
    });

    it('reports English as left-to-right', () => {
      expect(localeIsRTL('en')).toBe(false);
    });
  });

  describe('isNativeRTL', () => {
    it('reflects the native layout engine, not the selected locale', () => {
      setNativeRTL(true);
      expect(isNativeRTL()).toBe(true);

      setNativeRTL(false);
      expect(isNativeRTL()).toBe(false);
    });
  });

  describe('needsRestartForLocale', () => {
    it('requires a restart when switching en → fa', () => {
      setNativeRTL(false);
      expect(needsRestartForLocale('fa')).toBe(true);
    });

    it('requires a restart when switching fa → en', () => {
      setNativeRTL(true);
      expect(needsRestartForLocale('en')).toBe(true);
    });

    it('requires NO restart when the direction is already correct', () => {
      setNativeRTL(true);
      expect(needsRestartForLocale('fa')).toBe(false);

      setNativeRTL(false);
      expect(needsRestartForLocale('en')).toBe(false);
    });
  });

  describe('applyLayoutDirection', () => {
    it('enables RTL for Persian', () => {
      const allowRTL = jest
        .spyOn(I18nManager, 'allowRTL')
        .mockImplementation(() => undefined);
      const forceRTL = jest
        .spyOn(I18nManager, 'forceRTL')
        .mockImplementation(() => undefined);

      applyLayoutDirection('fa');

      expect(forceRTL).toHaveBeenCalledWith(true);
      // Without allowRTL(true), forceRTL is silently ignored on iOS — a common
      // and confusing cause of "RTL does nothing".
      expect(allowRTL).toHaveBeenCalledWith(true);
    });

    it('disables RTL for English', () => {
      const forceRTL = jest
        .spyOn(I18nManager, 'forceRTL')
        .mockImplementation(() => undefined);
      jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => undefined);

      applyLayoutDirection('en');

      expect(forceRTL).toHaveBeenCalledWith(false);
    });
  });

  describe('mirrorHorizontal — ADR-0006 trap #1', () => {
    it('inverts a gesture translation under RTL', () => {
      // A "swipe to next day" written for English moves the wrong way in
      // Persian, and looks correct to a developer testing in English.
      expect(mirrorHorizontal(100, true)).toBe(-100);
      expect(mirrorHorizontal(-40, true)).toBe(40);
    });

    it('leaves a translation untouched under LTR', () => {
      expect(mirrorHorizontal(100, false)).toBe(100);
    });

    it('leaves zero as zero rather than producing -0', () => {
      expect(Object.is(mirrorHorizontal(0, true), -0)).toBe(false);
    });
  });

  describe('axisDirection — ADR-0006 trap #2', () => {
    it('inverts a chart x-axis under RTL', () => {
      // Skia has no layout direction. Without this, a Persian chart silently
      // claims time runs backwards — visually plausible and easy to miss.
      expect(axisDirection(true)).toBe(-1);
    });

    it('leaves the axis forward under LTR', () => {
      expect(axisDirection(false)).toBe(1);
    });
  });
});
