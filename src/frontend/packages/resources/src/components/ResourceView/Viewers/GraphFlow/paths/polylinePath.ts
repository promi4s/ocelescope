import type { ElkPoint } from "../layout/elkTypes";

export const buildPolylinePath = (points: ElkPoint[]): string | null => {
  if (points.length < 2) return null;

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
    .join(" ");
};
