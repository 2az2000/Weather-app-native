import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useReducedMotion } from '@/shared/hooks';
import type { WeatherPalette } from '@/theme';

/**
 * The dynamic weather background.
 *
 * Renders the gradient the palette derives from condition and solar elevation
 * (CLAUDE.md §18). It is a pure presentation of that derivation — the decision
 * about WHICH sky to show lives in `useWeatherAppearance`.
 *
 * The gradient CROSS-FADES rather than cutting: the sky changing colour
 * instantly at a condition boundary reads as a glitch. Keyed on the gradient so
 * a new palette mounts a new layer over the old one.
 */
export interface WeatherBackgroundProps {
  readonly palette: WeatherPalette;
  readonly style?: ViewStyle;
  readonly children?: React.ReactNode;
}

export function WeatherBackground({ palette, style, children }: WeatherBackgroundProps) {
  const reducedMotion = useReducedMotion();

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        // Remounts when the gradient changes, which is what drives the fade.
        key={palette.gradient.join()}
        // Conditional spread rather than `entering={undefined}`: under
        // `exactOptionalPropertyTypes` an explicit undefined is not the same as
        // an absent prop, and Reanimated's type rejects it.
        {...(reducedMotion ? {} : { entering: FadeIn.duration(600) })}
        style={StyleSheet.absoluteFill}
        // Decorative: the sky is conveyed by the condition text, never by
        // colour alone (CLAUDE.md §20).
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <LinearGradient
          colors={[...palette.gradient]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
