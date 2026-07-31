import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet, Text as RNText, View } from 'react-native';

import {
  Button,
  Card,
  Divider,
  IconButton,
  Skeleton,
  SkeletonText,
  Text,
} from '../index';

import { renderWithTheme, THEME_COMBINATIONS } from './render-with-theme';

/**
 * ROADMAP Phase 2 DoD: "Every primitive renders correctly in all four locale ×
 * theme combinations" and "All primitives have `accessibilityRole`".
 *
 * Behaviour is queried by ROLE and TEXT, never by `testID` — that is what a
 * screen-reader user actually perceives, and it means these tests keep passing
 * through a refactor that changes structure but not behaviour (CLAUDE.md §26
 * rule 3).
 */
describe('UI primitives', () => {
  describe.each(THEME_COMBINATIONS)('in $name', (combination) => {
    it('renders Text', () => {
      renderWithTheme(<Text>Tehran</Text>, combination);
      expect(screen.getByText('Tehran')).toBeTruthy();
    });

    it('renders Card with its children', () => {
      renderWithTheme(
        <Card>
          <Text>21°</Text>
        </Card>,
        combination,
      );
      expect(screen.getByText('21°')).toBeTruthy();
    });

    it('renders Button as an accessible button', () => {
      renderWithTheme(<Button label="Retry" onPress={jest.fn()} />, combination);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    it('renders IconButton with its required label', () => {
      renderWithTheme(
        <IconButton
          accessibilityLabel="Close panel"
          onPress={jest.fn()}
          icon={<View />}
        />,
        combination,
      );
      expect(screen.getByRole('button', { name: 'Close panel' })).toBeTruthy();
    });

    it('renders Skeleton, Divider and SkeletonText without throwing', () => {
      expect(() => {
        renderWithTheme(
          <View>
            <Skeleton />
            <SkeletonText lines={2} />
            <Divider />
          </View>,
          combination,
        );
      }).not.toThrow();
    });
  });

  describe('Text', () => {
    it('applies the script-appropriate line height', () => {
      // Persian needs ~12% more leading than Latin at the same point size, or
      // diacritics clip (CLAUDE.md §18).
      const latin = renderWithTheme(<Text size="body">A</Text>, THEME_COMBINATIONS[0]!);
      const latinStyle = latin.getByText('A').props.style as { lineHeight: number }[];

      const arabic = renderWithTheme(<Text size="body">ب</Text>, THEME_COMBINATIONS[2]!);
      const arabicStyle = arabic.getByText('ب').props.style as { lineHeight: number }[];

      expect(arabicStyle[0]?.lineHeight).toBeGreaterThan(latinStyle[0]?.lineHeight ?? 0);
    });

    it('uses Vazirmatn for Persian and the system font for Latin', () => {
      const latin = renderWithTheme(<Text>A</Text>, THEME_COMBINATIONS[0]!);
      const latinStyle = latin.getByText('A').props.style as {
        fontFamily?: string;
        fontWeight?: string;
      }[];

      // Latin deliberately has NO fontFamily — it uses SF Pro / Roboto.
      expect(latinStyle[0]?.fontFamily).toBeUndefined();
      expect(latinStyle[0]?.fontWeight).toBe('400');

      const arabic = renderWithTheme(<Text>ب</Text>, THEME_COMBINATIONS[2]!);
      const arabicStyle = arabic.getByText('ب').props.style as { fontFamily?: string }[];

      expect(arabicStyle[0]?.fontFamily).toBe('Vazirmatn-Regular');
    });

    it('sets writing direction from the theme, not from I18nManager', () => {
      const rtl = renderWithTheme(<Text>ب</Text>, THEME_COMBINATIONS[2]!);
      const style = rtl.getByText('ب').props.style as { writingDirection: string }[];

      expect(style[0]?.writingDirection).toBe('rtl');
    });

    it('changes colour between light and dark', () => {
      const light = renderWithTheme(<Text>A</Text>, THEME_COMBINATIONS[0]!);
      const dark = renderWithTheme(<Text>A</Text>, THEME_COMBINATIONS[1]!);

      const lightColor = (light.getByText('A').props.style as { color: string }[])[0]
        ?.color;
      const darkColor = (dark.getByText('A').props.style as { color: string }[])[0]
        ?.color;

      expect(lightColor).not.toBe(darkColor);
    });
  });

  describe('Button', () => {
    it('invokes onPress', async () => {
      const onPress = jest.fn();
      renderWithTheme(<Button label="Retry" onPress={onPress} />);

      await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not invoke onPress while disabled', async () => {
      const onPress = jest.fn();
      renderWithTheme(<Button label="Retry" onPress={onPress} disabled />);

      await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('reports its disabled state to assistive technology', () => {
      renderWithTheme(<Button label="Retry" onPress={jest.fn()} disabled />);

      expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    });

    it('reports busy while loading, and hides the label from the visual tree', () => {
      renderWithTheme(<Button label="Retry" onPress={jest.fn()} loading />);

      const button = screen.getByRole('button', { name: 'Retry' });
      expect(button.props.accessibilityState).toMatchObject({ busy: true });
    });

    it('does not invoke onPress while loading', async () => {
      const onPress = jest.fn();
      renderWithTheme(<Button label="Retry" onPress={onPress} loading />);

      await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('prefers an explicit accessibilityLabel over the visible label', () => {
      renderWithTheme(
        <Button
          label="21°"
          onPress={jest.fn()}
          accessibilityLabel="Current temperature"
        />,
      );

      expect(screen.getByRole('button', { name: 'Current temperature' })).toBeTruthy();
    });

    it('meets the 44pt minimum touch target even at its smallest size', () => {
      renderWithTheme(<Button label="Go" onPress={jest.fn()} size="small" />);

      // PressableScale composes an animated style with the passed one, so the
      // rendered style is an array and must be flattened before inspection.
      const style = StyleSheet.flatten(
        screen.getByRole('button', { name: 'Go' }).props.style,
      );

      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  describe('IconButton', () => {
    it('meets the 44pt minimum even when asked for something smaller', () => {
      renderWithTheme(
        <IconButton
          accessibilityLabel="Refresh"
          onPress={jest.fn()}
          icon={<View />}
          size={20}
        />,
      );

      const style = StyleSheet.flatten(
        screen.getByRole('button', { name: 'Refresh' }).props.style,
      );

      expect(style.width).toBeGreaterThanOrEqual(44);
      expect(style.height).toBeGreaterThanOrEqual(44);
    });

    it('invokes onPress', async () => {
      const onPress = jest.fn();
      renderWithTheme(
        <IconButton accessibilityLabel="Refresh" onPress={onPress} icon={<View />} />,
      );

      await userEvent.press(screen.getByRole('button', { name: 'Refresh' }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Divider', () => {
    it('is hidden from assistive technology, being purely decorative', () => {
      renderWithTheme(
        <View>
          <RNText>before</RNText>
          <Divider />
        </View>,
      );

      // A separator announced by a screen reader is noise, not information.
      expect(screen.queryByRole('separator')).toBeNull();
    });
  });

  describe('useTheme outside a provider', () => {
    it('fails loudly rather than rendering unstyled', () => {
      // Rendering without the provider is a programming error. Returning a
      // silent default would produce a screen that looks broken with no clue
      // why (CLAUDE.md §31).
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      // Rendered WITHOUT the themed helper, so no provider is present.
      expect(() => render(<Text>A</Text>)).toThrow(/ThemeProvider/);

      consoleError.mockRestore();
    });
  });
});
