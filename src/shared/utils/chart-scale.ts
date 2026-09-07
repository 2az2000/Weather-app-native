/**
 * Pure chart math — no Skia, no React, no device.
 *
 * Kept separate from the chart components deliberately: `@shopify/react-native-skia`
 * has no Jest-compatible runtime in this project, so anything worth unit testing
 * has to be free of it. Scaling a value onto a pixel range and building smooth
 * curve control points are exactly that kind of logic — arithmetic with no
 * rendering dependency — so they live here, testable with plain Jest, and the
 * chart components (`shared/ui/charts/`) call them rather than reimplementing
 * the same numbers inline where a mistake would only ever be caught by eye.
 */

/** A single point in DATA space — a real value at a position along the axis. */
export interface ChartPoint {
  /** Position along the x-axis, e.g. an hour index or a millisecond timestamp. */
  readonly x: number;
  readonly y: number;
}

/** A point already mapped into PIXEL space, ready to feed a path builder. */
export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Map a value from a data domain onto a pixel range.
 *
 * A domain of zero width (every point has the same value) would divide by
 * zero; the midpoint of the range is returned instead — a flat line drawn
 * dead-center, which is the honest picture of "no variation" rather than a
 * `NaN` that breaks the whole path.
 */
export function scaleLinear(
  value: number,
  domain: readonly [number, number],
  range: readonly [number, number],
): number {
  const [domainMin, domainMax] = domain;
  const [rangeMin, rangeMax] = range;
  const domainSpan = domainMax - domainMin;

  if (domainSpan === 0) return (rangeMin + rangeMax) / 2;

  const t = (value - domainMin) / domainSpan;
  return rangeMin + t * (rangeMax - rangeMin);
}

/**
 * Map a chart's data points onto a pixel canvas.
 *
 * The y-axis domain defaults to the points' own min/max, WITH padding — a
 * series that peaks at the top pixel row would clip its own peak.
 */
export interface ScaleToCanvasOptions {
  readonly width: number;
  readonly height: number;
  /** Fraction of the height reserved above the highest and below the lowest
   *  point, so a peak or trough never touches the canvas edge. */
  readonly verticalPadding?: number;
  /** Mirrors the x-axis — CLAUDE.md §19: Skia has no concept of layout
   *  direction, so RTL has to be applied explicitly here. */
  readonly isRTL?: boolean;
  readonly xDomain?: readonly [number, number] | undefined;
  readonly yDomain?: readonly [number, number] | undefined;
}

export function scaleToCanvas(
  points: readonly ChartPoint[],
  options: ScaleToCanvasOptions,
): readonly PixelPoint[] {
  const { width, height, verticalPadding = 0.12, isRTL = false } = options;
  if (points.length === 0) return [];

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const xDomain = options.xDomain ?? [Math.min(...xs), Math.max(...xs)];
  const yDomain = options.yDomain ?? [Math.min(...ys), Math.max(...ys)];

  const padY = (yDomain[1] - yDomain[0]) * verticalPadding || height * verticalPadding;
  const paddedYDomain: [number, number] = [yDomain[0] - padY, yDomain[1] + padY];

  return points.map((point) => {
    const rawX = scaleLinear(point.x, xDomain, [0, width]);
    return {
      // Inverted, not reflected data order: the SERIES stays chronological,
      // only its pixel placement mirrors (ADR-0006). Reversing the array
      // instead would also flip which end animates in first.
      x: isRTL ? width - rawX : rawX,
      // Screen y grows downward; a higher VALUE must draw HIGHER on screen.
      y: scaleLinear(point.y, paddedYDomain, [height, 0]),
    };
  });
}

/**
 * Cubic Bezier control points for a Catmull-Rom spline through `points`.
 *
 * A weather series drawn as straight segments between hours reads as jagged
 * and mechanical; the eye expects a curve, because temperature does not
 * actually step discontinuously between readings. Catmull-Rom is the standard
 * choice for this: unlike a generic Bezier fit, the curve is guaranteed to
 * pass exactly through every data point, so a scrub gesture landing "on" a
 * point highlights a spot that is really on the drawn line.
 *
 * @param tension - 0 produces a straight-line polyline (each segment's control
 *   points collapse onto its endpoints); higher values round the curve more.
 *   1/6 is the standard Catmull-Rom-to-Bezier conversion constant.
 * @returns One entry per segment (`points.length - 1`), each the pair of
 *   control points a consumer feeds to `Path#cubicTo`.
 */
export interface CubicSegment {
  readonly control1: PixelPoint;
  readonly control2: PixelPoint;
  readonly end: PixelPoint;
}

export function catmullRomSegments(
  points: readonly PixelPoint[],
  tension = 1 / 6,
): readonly CubicSegment[] {
  if (points.length < 2) return [];

  const at = (index: number): PixelPoint => {
    // Clamp rather than wrap: a weather series is a line, not a loop, so the
    // segment before the first point and after the last should extrapolate
    // flat rather than reaching across to the opposite end.
    const clamped = Math.max(0, Math.min(points.length - 1, index));
    return points[clamped]!;
  };

  const segments: CubicSegment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);

    segments.push({
      control1: { x: p1.x + (p2.x - p0.x) * tension, y: p1.y + (p2.y - p0.y) * tension },
      control2: { x: p2.x - (p3.x - p1.x) * tension, y: p2.y - (p3.y - p1.y) * tension },
      end: p2,
    });
  }

  return segments;
}

/**
 * Which data point a scrub position is closest to, by x-distance.
 *
 * Used on the UI thread during a pan gesture, so it must be cheap and it must
 * not allocate per frame beyond the single result — a linear scan is fine at
 * the point counts these charts actually hold (at most a few hundred).
 */
export function nearestPointIndex(
  pixelX: number,
  pixelPoints: readonly PixelPoint[],
): number {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < pixelPoints.length; i++) {
    const distance = Math.abs(pixelPoints[i]!.x - pixelX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = i;
    }
  }

  return nearest;
}
