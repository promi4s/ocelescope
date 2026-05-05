import type { ElkEdgeSection } from "../layout/elkTypes";

// ELK SPLINES bend points are control points for a piecewise cubic spline.
// See: https://eclipse.dev/elk/reference/options/org-eclipse-elk-edgeRouting.html
export const buildSplinePath = (section: ElkEdgeSection): string | null => {
  const start = section.startPoint;
  const end = section.endPoint;
  if (!start || !end) return null;

  const bendPoints = section.bendPoints ?? [];
  if (bendPoints.length === 0) {
    return `M ${start.x},${start.y} L ${end.x},${end.y}`;
  }

  let path = `M ${start.x},${start.y}`;

  for (let index = 0; index < bendPoints.length; index += 3) {
    const cp1 = bendPoints[index];
    const cp2 = bendPoints[index + 1];
    if (!cp1 || !cp2) return null;

    const anchor = bendPoints[index + 2] ?? end;
    path += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${anchor.x},${anchor.y}`;
  }

  return path;
};
