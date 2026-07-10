import type { EdgeLayout, EdgeRoute, Point } from "../model/types";

// The ONE place edge geometry becomes an SVG path. Both engines return abstract
// `EdgeRoute`s; this module is the only thing that emits `M/L/C` strings, so any
// change to how edges are drawn lives here and nowhere else.

// Polyline: straight segments through every point in order.
export const buildPolylinePath = (points: Point[]): string | null => {
  if (points.length < 2) return null;
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
    .join(" ");
};

// Cubic spline: one leading anchor followed by `(control, control, anchor)`
// triples — `[P0, c1, c2, P1, c3, c4, P2, …]`.
export const buildSplinePath = (points: Point[]): string | null => {
  if (points.length < 4 || (points.length - 1) % 3 !== 0) return null;

  let path = `M ${points[0]?.x},${points[0]?.y}`;
  for (let index = 1; index < points.length; index += 3) {
    const c1 = points[index];
    const c2 = points[index + 1];
    const anchor = points[index + 2];
    if (!c1 || !c2 || !anchor) return null;
    path += ` C ${c1.x},${c1.y} ${c2.x},${c2.y} ${anchor.x},${anchor.y}`;
  }
  return path;
};

// Stitches optional arrow anchors onto a spline body as straight segments at
// either end (the anchors sit outside the spline's control points).
const stitchAnchors = (
  body: string,
  points: Point[],
  startAnchor: Point | null,
  endAnchor: Point | null,
): string =>
  [
    startAnchor && points[0]
      ? `M ${startAnchor.x},${startAnchor.y} L ${points[0].x},${points[0].y}`
      : null,
    // Drop the body's leading `M …` move when we've already opened the path at
    // the start anchor.
    startAnchor ? body.replace(/^M [^C]+/, "") : body,
    endAnchor ? `L ${endAnchor.x},${endAnchor.y}` : null,
  ]
    .filter(Boolean)
    .join(" ");

// Turns an abstract route into an absolute SVG path, or `null` when there isn't
// enough geometry to draw one (the projection then falls back to a straight
// line, and failing that the edge renderer draws a self-loop/bezier).
export const routeToPath = (route: EdgeRoute): string | null => {
  const { kind, points, startAnchor, endAnchor } = route;

  if (kind === "spline") {
    const spline = buildSplinePath(points);
    if (spline) return stitchAnchors(spline, points, startAnchor, endAnchor);
  }

  // Polyline body, or the last-resort polyline when a spline couldn't be built:
  // draw straight through the anchors and body points together.
  return buildPolylinePath([
    ...(startAnchor ? [startAnchor] : []),
    ...points,
    ...(endAnchor ? [endAnchor] : []),
  ]);
};

// ── Straight-line fallback ──────────────────────────────────────────────────
const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

// Two centers that resolve to (nearly) the same point — a self-loop, or two
// stacked nodes — can't produce a meaningful straight line.
export const isDegenerate = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y) < 1;

// A straight line between two node centers: the readable last resort when an
// engine couldn't route an edge at all.
export const straightEdgeLayout = (
  source: Point,
  target: Point,
): EdgeLayout => ({
  path: `M ${source.x},${source.y} L ${target.x},${target.y}`,
  startPoint: source,
  endPoint: target,
  labelPosition: midpoint(source, target),
});
