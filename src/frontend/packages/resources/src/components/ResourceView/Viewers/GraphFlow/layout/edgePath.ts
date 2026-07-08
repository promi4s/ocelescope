import type { GraphLayoutResult, GraphPoint } from "../model/types";

// The layout for a single edge: an absolute SVG `path` plus the anchors the
// renderer needs (arrow endpoints and the label position). Both layout engines
// produce these — this is the one shape the renderer consumes.
export type EdgeLayout = GraphLayoutResult["edgeLayouts"][string];

// Polyline: straight segments through every point in order.
export const buildPolylinePath = (points: GraphPoint[]): string | null => {
  if (points.length < 2) return null;
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
    .join(" ");
};

// Cubic spline: the point list is one leading anchor followed by
// `(control, control, anchor)` triples — `[P0, c1, c2, P1, c3, c4, P2, …]`.
// Both ELK (`[startPoint, ...bendPoints]`) and Graphviz (the parsed `pos`
// points) emit exactly this convention, so a single builder serves both.
export const buildSplinePath = (points: GraphPoint[]): string | null => {
  if (points.length < 4 || (points.length - 1) % 3 !== 0) return null;

  let path = `M ${points[0]?.x},${points[0]?.y}`;
  for (let index = 1; index < points.length; index += 3) {
    const control1 = points[index];
    const control2 = points[index + 1];
    const anchor = points[index + 2];
    if (!control1 || !control2 || !anchor) return null;
    path += ` C ${control1.x},${control1.y} ${control2.x},${control2.y} ${anchor.x},${anchor.y}`;
  }
  return path;
};

const midpoint = (a: GraphPoint, b: GraphPoint): GraphPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

// Two centers that resolve to (nearly) the same point — a self-loop, or two
// nodes the engine stacked — can't produce a meaningful straight line.
const isDegenerate = (a: GraphPoint, b: GraphPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y) < 1;

// A straight line between two points: the readable last-resort route used when
// an engine can't emit a usable path for an edge.
export const straightEdgeLayout = (
  source: GraphPoint,
  target: GraphPoint,
): EdgeLayout => ({
  path: `M ${source.x},${source.y} L ${target.x},${target.y}`,
  labelPosition: midpoint(source, target),
  startPoint: source,
  endPoint: target,
});

// Both engines funnel every edge through here so the outcome is uniform and no
// edge is ever left without an explicit, readable path:
//   - if the engine routed the edge, keep that path (with its anchors/label);
//   - otherwise draw a straight line between the two node centers;
//   - if even the centers are unusable (unknown, or a self-loop), return null
//     and let the renderer fall back (e.g. its dedicated self-loop path).
export const finalizeEdgeLayout = ({
  path,
  labelPosition,
  startPoint,
  endPoint,
  sourceCenter,
  targetCenter,
}: {
  path: string | null;
  labelPosition: GraphPoint | null;
  startPoint: GraphPoint | null;
  endPoint: GraphPoint | null;
  sourceCenter: GraphPoint | null;
  targetCenter: GraphPoint | null;
}): EdgeLayout | null => {
  if (path) return { path, labelPosition, startPoint, endPoint };
  if (sourceCenter && targetCenter && !isDegenerate(sourceCenter, targetCenter))
    return straightEdgeLayout(sourceCenter, targetCenter);
  return null;
};
