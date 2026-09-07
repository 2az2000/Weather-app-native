import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useHaptics, useReducedMotion } from '@/shared/hooks';
import {
  catmullRomSegments,
  nearestPointIndex,
  scaleToCanvas,
  type ChartPoint,
} from '@/shared/utils';
import { useTheme } from '@/theme';

import { Text } from '../text';

/**
 * The reusable Skia line chart every metric chart in this feature sits on
 * (ROADMAP Phase 6). Temperature, humidity, wind, pressure, and UV are all
 * this same component with a different colour, domain, and formatter — the
 * chart owns drawing and scrubbing; a caller owns what the numbers MEAN.
 *
 * ## Why the scrub gesture lives here, on the UI thread
 *
 * `Gesture.Pan()` runs its handlers as Reanimated worklets. Finding the
 * nearest point (`nearestPointIndex`) and moving the indicator are pure
 * arithmetic on shared values, so the whole drag tracks the finger without a
 * JS-thread round trip per frame — the DoD requirement that scrubbing must
 * not drop frames waiting on JS (ROADMAP Phase 6). `runOnJS` is used only for
 * the two things that must happen there: a haptic tick when the scrub crosses
 * onto a new point, and updating the value-readout label, which is ordinary
 * RN `<Text>` rather than Skia-drawn text so it gets correct font shaping and
 * Persian-Indic digits for free (CLAUDE.md §19) instead of needing a
 * hand-loaded Skia font.
 *
 * ## Why the x-axis mirrors instead of the data reversing
 *
 * `scaleToCanvas` flips PIXEL PLACEMENT under RTL; the `points` array itself
 * stays chronological. Reversing the array instead would also reverse which
 * end the entry-draw animation starts from, and would make `onScrub`'s index
 * mean a different hour depending on locale — a caller should never have to
 * ask "which direction is index 0 in right now?" (CLAUDE.md §19, ADR-0006).
 */
export interface LineChartProps {
  /** Already in DATA space — the chart handles scaling and RTL mirroring. */
  readonly points: readonly ChartPoint[];
  readonly color: string;
  readonly height?: number;
  /**
   * Read by a screen reader in place of the canvas, which has no accessible
   * content of its own. Should summarise the series, not just name it —
   * "Temperature, 21 to 34 degrees, peaking at 2 PM" rather than
   * "Temperature chart".
   */
  readonly accessibilityLabel: string;
  /** Formats the value under the finger during a scrub, for the readout label. */
  readonly formatValue: (value: number) => string;
  /** Called with the point nearest the current scrub position, or `undefined`
   *  once the gesture ends. */
  readonly onScrub?: (point: ChartPoint | undefined) => void;
  readonly xDomain?: readonly [number, number];
  readonly yDomain?: readonly [number, number];
}

const STROKE_WIDTH = 2.5;
const INDICATOR_RADIUS = 5;
const LABEL_WIDTH = 72;

export function LineChart({
  points,
  color,
  height = 160,
  accessibilityLabel,
  formatValue,
  onScrub,
  xDomain,
  yDomain,
}: LineChartProps) {
  const theme = useTheme();
  const haptics = useHaptics();
  const reducedMotion = useReducedMotion();

  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const pixelPoints = useMemo(
    () =>
      width === 0
        ? []
        : scaleToCanvas(points, { width, height, isRTL: theme.isRTL, xDomain, yDomain }),
    [points, width, height, theme.isRTL, xDomain, yDomain],
  );

  const path = useMemo(() => {
    // `Skia.PathBuilder`, not the deprecated mutable `SkPath#moveTo`/`#cubicTo`
    // instance methods this replaced — the builder is immutable-until-`build`,
    // which is the currently-supported API.
    const builder = Skia.PathBuilder.Make();
    if (pixelPoints.length === 0) return builder.build();

    builder.moveTo(pixelPoints[0]!.x, pixelPoints[0]!.y);
    for (const segment of catmullRomSegments(pixelPoints)) {
      builder.cubicTo(
        segment.control1.x,
        segment.control1.y,
        segment.control2.x,
        segment.control2.y,
        segment.end.x,
        segment.end.y,
      );
    }
    return builder.build();
  }, [pixelPoints]);

  // Entry animation: the line draws in from its start toward its end — which,
  // because the path is already mirrored, IS the visually-first point in
  // either direction. Reduced motion skips straight to fully drawn: the DoD
  // requires the animation to be what's disabled, never the chart's content
  // (CLAUDE.md §20).
  const drawProgress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    drawProgress.value = reducedMotion ? 1 : 0;
    drawProgress.value = withTiming(1, { duration: reducedMotion ? 0 : 600 });
  }, [points, reducedMotion, drawProgress]);

  const scrubActive = useSharedValue(false);
  const activeIndex = useSharedValue(-1);

  const [activePoint, setActivePoint] = useState<ChartPoint | undefined>(undefined);

  const reportScrub = useCallback(
    (index: number) => {
      const point = index >= 0 ? points[index] : undefined;
      setActivePoint(point);
      onScrub?.(point);
    },
    [onScrub, points],
  );

  const tick = useCallback(() => {
    haptics.selection();
  }, [haptics]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((event) => {
          'worklet';
          if (pixelPoints.length === 0) return;
          scrubActive.value = true;
          const index = nearestPointIndex(event.x, pixelPoints);
          activeIndex.value = index;
          runOnJS(tick)();
          runOnJS(reportScrub)(index);
        })
        .onUpdate((event) => {
          'worklet';
          if (pixelPoints.length === 0) return;
          const index = nearestPointIndex(event.x, pixelPoints);
          if (index !== activeIndex.value) {
            activeIndex.value = index;
            runOnJS(tick)();
            runOnJS(reportScrub)(index);
          }
        })
        .onFinalize(() => {
          'worklet';
          scrubActive.value = false;
          activeIndex.value = -1;
          runOnJS(reportScrub)(-1);
        }),
    // `scrubActive` and `activeIndex` are deliberately excluded: a
    // `SharedValue`'s IDENTITY is stable for the component's whole lifetime —
    // that stability is the point of `useSharedValue` — so listing it here
    // would only make the gesture rebuild on every mutation of `.value`,
    // which is the opposite of what a worklet-driven gesture is for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pixelPoints, tick, reportScrub],
  );

  const indicatorCx = useDerivedValue(() => {
    if (activeIndex.value < 0 || pixelPoints.length === 0) return -100;
    return pixelPoints[activeIndex.value]?.x ?? -100;
  });
  const indicatorCy = useDerivedValue(() => {
    if (activeIndex.value < 0 || pixelPoints.length === 0) return -100;
    return pixelPoints[activeIndex.value]?.y ?? -100;
  });
  const indicatorOpacity = useDerivedValue(() => (scrubActive.value ? 1 : 0));
  const clipEnd = useDerivedValue(() => drawProgress.value);

  const labelStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    // `left`, not `start`: `indicatorCx` is a raw CANVAS pixel coordinate that
    // `scaleToCanvas` has ALREADY mirrored for RTL (ADR-0006). `start` would
    // hand it to the OS layout system for a SECOND mirroring pass — the exact
    // double-flip the hourly strip's own ADR note warns about — landing the
    // label on the wrong side of the finger in Persian.
    // eslint-disable-next-line no-restricted-syntax
    left: indicatorCx.value - LABEL_WIDTH / 2,
    top: Math.max(0, indicatorCy.value - 32),
    width: LABEL_WIDTH,
    opacity: indicatorOpacity.value,
  }));

  return (
    <View
      onLayout={onLayout}
      style={{ height }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 && (
        <GestureDetector gesture={panGesture}>
          <Animated.View style={StyleSheet.absoluteFill}>
            <Canvas style={StyleSheet.absoluteFill}>
              <Group>
                <Path
                  path={path}
                  style="stroke"
                  strokeWidth={STROKE_WIDTH}
                  strokeCap="round"
                  strokeJoin="round"
                  start={0}
                  end={clipEnd}
                >
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(width, 0)}
                    colors={[color, color]}
                  />
                </Path>
              </Group>

              <Circle
                cx={indicatorCx}
                cy={indicatorCy}
                r={INDICATOR_RADIUS}
                color={color}
                opacity={indicatorOpacity}
              />
              <Circle
                cx={indicatorCx}
                cy={indicatorCy}
                r={INDICATOR_RADIUS + 3}
                style="stroke"
                strokeWidth={1.5}
                color={theme.colors.surface}
                opacity={indicatorOpacity}
              />
            </Canvas>

            <Animated.View style={labelStyle} pointerEvents="none">
              {activePoint !== undefined && (
                <Text
                  size="caption"
                  weight="semibold"
                  align="center"
                  style={{
                    backgroundColor: theme.colors.surfaceElevated,
                    borderRadius: theme.radii.sm,
                    paddingVertical: theme.spacing.xxs,
                    paddingHorizontal: theme.spacing.xs,
                    overflow: 'hidden',
                  }}
                >
                  {formatValue(activePoint.y)}
                </Text>
              )}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}
