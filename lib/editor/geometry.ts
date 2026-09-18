export type Rect = { x: number; y: number; width: number; height: number };

export type GuideAxis = "x" | "y";

export type Guide = {
  axis: GuideAxis;
  /** Position along the axis, in document space. */
  position: number;
  /** Extent of the drawn line, covering both participants. */
  start: number;
  end: number;
  /** How far the moving rect was nudged to meet this guide. */
  delta: number;
};

export type Measurement = {
  axis: GuideAxis;
  /** Along-axis start and end of the gap being measured. */
  from: number;
  to: number;
  /** Cross-axis position of the measurement line. */
  cross: number;
  distance: number;
};

/** Within how many document-space pixels a snap engages. */
export const SNAP_THRESHOLD = 6;

const edgesX = (rect: Rect) => [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
const edgesY = (rect: Rect) => [rect.y, rect.y + rect.height / 2, rect.y + rect.height];

export const right = (rect: Rect) => rect.x + rect.width;
export const bottom = (rect: Rect) => rect.y + rect.height;
export const centreX = (rect: Rect) => rect.x + rect.width / 2;
export const centreY = (rect: Rect) => rect.y + rect.height / 2;

/**
 * Finds the strongest snap for a moving rectangle against a set of
 * candidates.
 *
 * Each axis is resolved independently and only the single closest
 * alignment per axis is returned. Returning every near-match produces a
 * thicket of pink lines that tells the user nothing; one line per axis
 * is a statement about where the element actually landed.
 */
export function findSnaps(
  moving: Rect,
  candidates: Rect[],
  threshold = SNAP_THRESHOLD,
): { guides: Guide[]; offset: { x: number; y: number } } {
  let bestX: Guide | null = null;
  let bestY: Guide | null = null;

  for (const candidate of candidates) {
    for (const movingEdge of edgesX(moving)) {
      for (const candidateEdge of edgesX(candidate)) {
        const delta = candidateEdge - movingEdge;
        if (Math.abs(delta) > threshold) continue;
        if (bestX && Math.abs(bestX.delta) <= Math.abs(delta)) continue;
        bestX = {
          axis: "x",
          position: candidateEdge,
          start: Math.min(moving.y, candidate.y),
          end: Math.max(bottom(moving), bottom(candidate)),
          delta,
        };
      }
    }

    for (const movingEdge of edgesY(moving)) {
      for (const candidateEdge of edgesY(candidate)) {
        const delta = candidateEdge - movingEdge;
        if (Math.abs(delta) > threshold) continue;
        if (bestY && Math.abs(bestY.delta) <= Math.abs(delta)) continue;
        bestY = {
          axis: "y",
          position: candidateEdge,
          start: Math.min(moving.x, candidate.x),
          end: Math.max(right(moving), right(candidate)),
          delta,
        };
      }
    }
  }

  return {
    guides: [bestX, bestY].filter((guide): guide is Guide => guide !== null),
    offset: { x: bestX?.delta ?? 0, y: bestY?.delta ?? 0 },
  };
}

/**
 * Gaps between a target and its nearest neighbours on each side.
 *
 * Only neighbours that actually overlap on the cross axis are measured:
 * the distance to an element sitting diagonally away is not a spacing
 * relationship a designer is trying to read.
 */
export function measureNeighbours(
  target: Rect,
  neighbours: Rect[],
): Measurement[] {
  const results: Measurement[] = [];

  const overlapsY = (rect: Rect) =>
    Math.min(bottom(target), bottom(rect)) - Math.max(target.y, rect.y) > 0;
  const overlapsX = (rect: Rect) =>
    Math.min(right(target), right(rect)) - Math.max(target.x, rect.x) > 0;

  const leftNeighbour = neighbours
    .filter((rect) => overlapsY(rect) && right(rect) <= target.x)
    .sort((a, b) => right(b) - right(a))[0];
  if (leftNeighbour) {
    results.push({
      axis: "x",
      from: right(leftNeighbour),
      to: target.x,
      cross: centreY(target),
      distance: target.x - right(leftNeighbour),
    });
  }

  const rightNeighbour = neighbours
    .filter((rect) => overlapsY(rect) && rect.x >= right(target))
    .sort((a, b) => a.x - b.x)[0];
  if (rightNeighbour) {
    results.push({
      axis: "x",
      from: right(target),
      to: rightNeighbour.x,
      cross: centreY(target),
      distance: rightNeighbour.x - right(target),
    });
  }

  const above = neighbours
    .filter((rect) => overlapsX(rect) && bottom(rect) <= target.y)
    .sort((a, b) => bottom(b) - bottom(a))[0];
  if (above) {
    results.push({
      axis: "y",
      from: bottom(above),
      to: target.y,
      cross: centreX(target),
      distance: target.y - bottom(above),
    });
  }

  const below = neighbours
    .filter((rect) => overlapsX(rect) && rect.y >= bottom(target))
    .sort((a, b) => a.y - b.y)[0];
  if (below) {
    results.push({
      axis: "y",
      from: bottom(target),
      to: below.y,
      cross: centreX(target),
      distance: below.y - bottom(target),
    });
  }

  // Sub-pixel gaps are noise from fractional layout, not real spacing.
  return results.filter((measurement) => measurement.distance >= 1);
}

/** Smallest rectangle containing all the given rectangles. */
export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  return {
    x,
    y,
    width: Math.max(...rects.map(right)) - x,
    height: Math.max(...rects.map(bottom)) - y,
  };
}
