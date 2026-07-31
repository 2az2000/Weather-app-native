import { darkColors } from './semantic/dark';
import { lightColors } from './semantic/light';
import type { SemanticColors } from './semantic/types';
import { createTheme } from './theme';

describe('createTheme', () => {
  it('selects the light palette for the light scheme', () => {
    const theme = createTheme({ scheme: 'light', script: 'latin', isRTL: false });
    expect(theme.colors).toBe(lightColors);
  });

  it('selects the dark palette for the dark scheme', () => {
    const theme = createTheme({ scheme: 'dark', script: 'latin', isRTL: false });
    expect(theme.colors).toBe(darkColors);
  });

  it('carries script and direction, so components never read I18nManager', () => {
    const theme = createTheme({ scheme: 'light', script: 'arabic', isRTL: true });

    expect(theme.script).toBe('arabic');
    expect(theme.isRTL).toBe(true);
  });

  describe('font resolution', () => {
    it('uses the system font for Latin, with a numeric weight', () => {
      const theme = createTheme({ scheme: 'light', script: 'latin', isRTL: false });

      // No bundled Latin face — SF Pro / Roboto, the same choice Apple Weather
      // makes, at zero bundle cost.
      expect(theme.font('regular')).toEqual({ fontFamily: undefined, fontWeight: '400' });
      expect(theme.font('bold')).toEqual({ fontFamily: undefined, fontWeight: '700' });
    });

    it('uses a Vazirmatn family for Persian, with no numeric weight', () => {
      const theme = createTheme({ scheme: 'light', script: 'arabic', isRTL: true });

      // Weight is baked into the family name; also setting fontWeight would
      // double-bold a face that is already bold.
      expect(theme.font('bold')).toEqual({
        fontFamily: 'Vazirmatn-Bold',
        fontWeight: undefined,
      });
    });
  });

  describe('line height', () => {
    it('gives Persian more leading than Latin at the same size', () => {
      const latin = createTheme({ scheme: 'light', script: 'latin', isRTL: false });
      const arabic = createTheme({ scheme: 'light', script: 'arabic', isRTL: true });

      expect(arabic.lineHeight(16)).toBeGreaterThan(latin.lineHeight(16));
    });

    it('returns whole points, since fractional line heights render inconsistently', () => {
      const theme = createTheme({ scheme: 'light', script: 'arabic', isRTL: true });
      expect(Number.isInteger(theme.lineHeight(15))).toBe(true);
    });
  });

  describe('shadows', () => {
    it('applies the scheme’s shadow colour', () => {
      const light = createTheme({ scheme: 'light', script: 'latin', isRTL: false });
      const dark = createTheme({ scheme: 'dark', script: 'latin', isRTL: false });

      expect(light.shadow('md').shadowColor).toBe(lightColors.shadow);
      expect(dark.shadow('md').shadowColor).toBe(darkColors.shadow);
    });

    it('sets both iOS and Android depth, which cannot be derived from each other', () => {
      const theme = createTheme({ scheme: 'light', script: 'latin', isRTL: false });
      const shadow = theme.shadow('lg');

      expect(shadow.shadowRadius).toBeGreaterThan(0);
      expect(shadow.elevation).toBeGreaterThan(0);
    });

    it('produces no shadow at the none level', () => {
      const theme = createTheme({ scheme: 'light', script: 'latin', isRTL: false });
      expect(theme.shadow('none').shadowOpacity).toBe(0);
    });
  });

  it('exposes the 44pt minimum touch target', () => {
    const theme = createTheme({ scheme: 'light', script: 'latin', isRTL: false });
    expect(theme.minTouchTarget).toBe(44);
  });
});

describe('semantic palettes', () => {
  const tokenNames = Object.keys(lightColors) as (keyof SemanticColors)[];

  it('implement identical token sets', () => {
    // A token added to one theme and forgotten in the other is the usual cause
    // of "looks right in light, broken in dark".
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it.each(tokenNames)('defines %s in both themes', (token) => {
    expect(lightColors[token]).toBeDefined();
    expect(darkColors[token]).toBeDefined();
  });

  it('differs between themes for every colour token', () => {
    const identical = tokenNames.filter(
      (token) =>
        typeof lightColors[token] === 'string' &&
        lightColors[token] === darkColors[token],
    );

    // Text over a weather gradient stays white in both themes — those gradients
    // run dark regardless of the app's scheme.
    expect(identical).toEqual(['textOnAccent', 'textOnWeather']);
  });

  it('raises dark surfaces above the dark background, since shadows do not read there', () => {
    expect(darkColors.background).not.toBe(darkColors.surface);
    expect(darkColors.surface).not.toBe(darkColors.surfaceElevated);
  });

  it('uses a stronger blur in dark, where a pale wash would glow', () => {
    expect(darkColors.glassIntensity).toBeGreaterThan(lightColors.glassIntensity);
  });
});
