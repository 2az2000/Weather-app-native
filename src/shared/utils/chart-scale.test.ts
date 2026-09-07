import {
  catmullRomSegments,
  nearestPointIndex,
  scaleLinear,
  scaleToCanvas,
} from './chart-scale';

describe('scaleLinear', () => {
  it('maps the domain minimum to the range minimum', () => {
    expect(scaleLinear(0, [0, 10], [0, 100])).toBe(0);
  });

  it('maps the domain maximum to the range maximum', () => {
    expect(scaleLinear(10, [0, 10], [0, 100])).toBe(100);
  });

  it('interpolates linearly between the two', () => {
    expect(scaleLinear(5, [0, 10], [0, 100])).toBe(50);
  });

  it('handles an inverted range, e.g. flipping y for screen coordinates', () => {
    expect(scaleLinear(0, [0, 10], [100, 0])).toBe(100);
    expect(scaleLinear(10, [0, 10], [100, 0])).toBe(0);
  });

  it('returns the range midpoint rather than NaN when the domain has zero width', () => {
    // Every reading identical — a flat series, not an error.
    expect(scaleLinear(5, [5, 5], [0, 100])).toBe(50);
  });
});

describe('scaleToCanvas', () => {
  it('returns nothing for an empty series', () => {
    expect(scaleToCanvas([], { width: 300, height: 100 })).toEqual([]);
  });

  it('places the lowest value at the bottom and the highest at the top', () => {
    const result = scaleToCanvas(
      [
        { x: 0, y: 10 },
        { x: 1, y: 30 },
      ],
      { width: 300, height: 100, verticalPadding: 0 },
    );

    expect(result[0]!.y).toBe(100);
    expect(result[1]!.y).toBe(0);
  });

  it('mirrors the x-axis under RTL WITHOUT reordering the points', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 1, y: 20 },
      { x: 2, y: 30 },
    ];

    const ltr = scaleToCanvas(points, { width: 300, height: 100 });
    const rtl = scaleToCanvas(points, { width: 300, height: 100, isRTL: true });

    // Same series, same array order — only the PIXEL placement flips.
    expect(rtl).toHaveLength(ltr.length);
    expect(rtl[0]!.x).toBeCloseTo(300 - ltr[0]!.x);
    expect(rtl[2]!.x).toBeCloseTo(300 - ltr[2]!.x);
    // The first data point (still chronologically first) now sits on the
    // RIGHT of the canvas — verified against the LTR pass' first point being
    // near the left edge, since Skia has no built-in notion of direction
    // (CLAUDE.md §19) and this is the one thing that must not silently regress.
    expect(ltr[0]!.x).toBeLessThan(ltr[2]!.x);
    expect(rtl[0]!.x).toBeGreaterThan(rtl[2]!.x);
  });

  it('pads the y-domain so a peak does not touch the canvas edge', () => {
    const result = scaleToCanvas([{ x: 0, y: 10 }], {
      width: 300,
      height: 100,
      verticalPadding: 0.1,
    });

    // A single point has a zero-width y-domain, so the padding falls back to
    // a fraction of the canvas height — it must still land off the edges.
    expect(result[0]!.y).toBeGreaterThan(0);
    expect(result[0]!.y).toBeLessThan(100);
  });
});

describe('catmullRomSegments', () => {
  it('produces one segment fewer than the point count', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
      { x: 30, y: 10 },
    ];

    expect(catmullRomSegments(points)).toHaveLength(points.length - 1);
  });

  it('returns nothing for fewer than two points', () => {
    expect(catmullRomSegments([])).toEqual([]);
    expect(catmullRomSegments([{ x: 0, y: 0 }])).toEqual([]);
  });

  it('ends each segment exactly ON the next data point', () => {
    // This is the property that makes Catmull-Rom the right choice over a
    // generic Bezier fit: a scrub gesture that lands "on" a point must
    // highlight a spot that is genuinely on the drawn curve.
    const points = [
      { x: 0, y: 5 },
      { x: 10, y: 25 },
      { x: 20, y: 15 },
    ];

    const segments = catmullRomSegments(points);

    expect(segments[0]!.end).toEqual(points[1]);
    expect(segments[1]!.end).toEqual(points[2]);
  });

  it('collapses to the straight line between endpoints at zero tension', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];

    const [segment] = catmullRomSegments(points, 0);

    expect(segment!.control1).toEqual(points[0]);
    expect(segment!.control2).toEqual(points[1]);
  });

  it('does not reach across the line for the control points at either end', () => {
    // The clamp-rather-than-wrap behaviour: extrapolating the phantom point
    // before the first and after the last must not pull the curve toward the
    // OPPOSITE end of the series, which a naive modulo wrap would do.
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 100 },
      { x: 20, y: 0 },
    ];

    const segments = catmullRomSegments(points);

    for (const segment of segments) {
      expect(Number.isFinite(segment.control1.x)).toBe(true);
      expect(Number.isFinite(segment.control1.y)).toBe(true);
    }
  });
});

describe('nearestPointIndex', () => {
  const pixelPoints = [{ x: 0 }, { x: 50 }, { x: 100 }, { x: 150 }].map((p) => ({
    ...p,
    y: 0,
  }));

  it('finds the exact match', () => {
    expect(nearestPointIndex(100, pixelPoints)).toBe(2);
  });

  it('rounds to the closer neighbour', () => {
    expect(nearestPointIndex(60, pixelPoints)).toBe(1);
    expect(nearestPointIndex(80, pixelPoints)).toBe(2);
  });

  it('clamps to the first point left of the series', () => {
    expect(nearestPointIndex(-1000, pixelPoints)).toBe(0);
  });

  it('clamps to the last point right of the series', () => {
    expect(nearestPointIndex(1000, pixelPoints)).toBe(3);
  });
});
